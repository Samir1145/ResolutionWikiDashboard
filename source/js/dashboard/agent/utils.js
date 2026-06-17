// utils.js - Agent execution filesystem and markdown helper functions
"use strict";

const fs = require("fs");
const path = require("path");

const TAG = "[AgentUtils]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

function stripHtml(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|td|th|blockquote)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'");
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function readReportContent(filePath) {
  dbg("readReportContent:", filePath);
  if (!fs.existsSync(filePath)) {
    dbgErr("File not found:", filePath);
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);

  if (stat.isDirectory()) {
    dbg("Path is a directory — treating as TW5 wiki folder");
    const twInfo = path.join(filePath, "tiddlywiki.info");
    if (!fs.existsSync(twInfo)) {
      throw new Error(`Not a valid TiddlyWiki folder: ${filePath}`);
    }
    const tiddlersDir = path.join(filePath, "tiddlers");
    const result = [];
    if (fs.existsSync(tiddlersDir)) {
      const files = fs.readdirSync(tiddlersDir).filter(f => /\.(tid|txt|md)$/.test(f));
      dbg(`Found ${files.length} tiddlers, reading up to 50`);
      files.slice(0, 50).forEach(f => {
        try {
          const content = fs.readFileSync(path.join(tiddlersDir, f), "utf8");
          result.push(`--- Tiddler: ${f} ---\n${content}`);
        } catch {}
      });
    }
    const joined = result.join("\n\n") || "[Empty wiki folder]";
    dbg(`Returning ${joined.length} chars from TW5 wiki`);
    return joined;
  }

  // Single HTML file
  const raw = fs.readFileSync(filePath, "utf8");
  dbg(`Read ${raw.length} bytes from HTML file`);
  const text = stripHtml(raw);
  dbg(`After strip: ${text.length} chars`);
  const capped = text.length > 30000 ? text.slice(0, 30000) + "\n\n[...content truncated...]" : text;
  dbg(`Sending ${capped.length} chars to LLM`);
  return capped;
}

function listReportFiles(boardPath) {
  dbg("listReportFiles:", boardPath);
  if (!fs.existsSync(boardPath)) {
    dbg("Board path does not exist:", boardPath);
    return [];
  }
  const items = fs.readdirSync(boardPath);
  const reports = [];
  items.forEach(item => {
    if (item.startsWith(".")) return;
    const itemPath = path.join(boardPath, item);
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isFile() && /\.(html|htm)$/i.test(item)) {
        reports.push({ name: item, path: itemPath });
      } else if (stat.isDirectory() && fs.existsSync(path.join(itemPath, "tiddlywiki.info"))) {
        reports.push({ name: item + " (TW5 Wiki)", path: itemPath });
      }
    } catch (e) {
      dbgErr("statSync error for", itemPath, ":", e.message);
    }
  });
  dbg(`Found ${reports.length} reports in ${boardPath}`);
  return reports;
}

function markdownToHtml(markdown) {
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm,   "<h1>$1</h1>");

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g,          "<em>$1</em>");

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    const isHeader = /^[\|\s\-:]+$/.test(line.replace(/[^|\-:]/g, ""));
    if (isHeader) return "";
    const cells = line.split("|").filter((c, i, a) => i > 0 && i < a.length - 1);
    return "<tr>" + cells.map(c => `<td>${c.trim()}</td>`).join("") + "</tr>";
  });
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g,
    "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%;margin:1rem 0;font-size:0.9rem;'>$1</table>");

  // Lists
  html = html.replace(/^\- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

  // HR
  html = html.replace(/^---+$/gm, "<hr>");

  // Paragraphs
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const t = block.trim();
    if (!t) return "";
    if (/^<(h[1-6]|ul|ol|table|hr|p)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return html;
}

function sanitizeHtml(htmlString) {
  if (typeof DOMParser === "undefined") {
    let safe = htmlString.replace(/<script[\s\S]*?<\/script>/gi, "");
    safe = safe.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
    safe = safe.replace(/on\w+\s*=\s*(['"])(.*?)\1/gi, "");
    safe = safe.replace(/href\s*=\s*(['"])javascript:(.*?)\1/gi, "");
    return safe;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, link[rel="stylesheet"]').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        if (attr.name.toLowerCase() === 'href' && attr.value.toLowerCase().trim().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  } catch (e) {
    console.error("DOMParser sanitization failed, using regex fallback:", e);
    let safe = htmlString.replace(/<script[\s\S]*?<\/script>/gi, "");
    safe = safe.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
    safe = safe.replace(/on\w+\s*=\s*(['"])(.*?)\1/gi, "");
    safe = safe.replace(/href\s*=\s*(['"])javascript:(.*?)\1/gi, "");
    return safe;
  }
}

function buildReportHtml(title, contentMarkdown, skillName, timestamp) {
  const contentHtml = markdownToHtml(contentMarkdown);
  const sanitizedHtml = sanitizeHtml(contentHtml);
  const sanitizedTitle = sanitizeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizedTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px; margin: 0 auto; padding: 2rem;
      background: #0b0f19; color: #f8fafc; line-height: 1.6;
    }
    .report-header { border-bottom: 2px solid rgba(59,130,246,0.4); padding-bottom: 1.5rem; margin-bottom: 2rem; }
    .report-header h1 { margin: 0 0 0.5rem 0; font-size: 1.8rem; background: linear-gradient(135deg,#fff 30%,#94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .report-meta { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem; }
    .meta-badge { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); border-radius: 20px; padding: 0.2rem 0.75rem; font-size: 0.8rem; color: #93c5fd; }
    h2 { color: #60a5fa; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.4rem; margin-top: 2rem; }
    h3 { color: #94a3b8; margin-top: 1.5rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }
    td, th { border: 1px solid rgba(255,255,255,0.1); padding: 0.5rem 0.75rem; text-align: left; }
    th { background: rgba(59,130,246,0.2); color: #93c5fd; }
    tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
    ul { padding-left: 1.5rem; } li { margin-bottom: 0.3rem; }
    p { color: #cbd5e1; } strong { color: #f1f5f9; }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 2rem 0; }
    em { color: #a5b4fc; }
    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; color: #475569; text-align: center; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${sanitizedTitle}</h1>
    <div class="report-meta">
      <span class="meta-badge">🤖 AI Generated</span>
      <span class="meta-badge">📋 Skill: ${skillName}</span>
      <span class="meta-badge">🕐 ${timestamp}</span>
    </div>
  </div>
  <div class="report-body">${sanitizedHtml}</div>
  <div class="footer">Generated by Resolution Bazaar Agentic Engine · ${timestamp}</div>
</body>
</html>`;
}

module.exports = {
  stripHtml,
  readReportContent,
  listReportFiles,
  markdownToHtml,
  sanitizeHtml,
  buildReportHtml
};
