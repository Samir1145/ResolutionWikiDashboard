// kaiban.service.js – KaibanJS Multi-Agent Orchestration Service for TiddlyDesk
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
// Dynamic/Lazy imports are used below to avoid Blink renderer crashes in mixed-context on app boot

const TAG = "[KaibanSvc]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

// Load Environment Variables (GEMINI_API_KEY)
const pathsToTry = [
  path.join(__dirname, "../../../.env"),
  path.join(__dirname, "../../../../.env"),
  path.join(process.cwd(), ".env")
];
for (const p of pathsToTry) {
  if (fs.existsSync(p)) {
    dbg("Found .env at:", p);
    try {
      const envContent = fs.readFileSync(p, "utf8");
      envContent.split("\n").forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || "";
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val.trim();
        }
      });
    } catch (e) {
      dbgErr("Error reading .env:", e);
    }
    break;
  }
}

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// ─── Tool Execution Helpers ──────────────────────────────────────────────────

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

function tiddlerToTidString(tiddler) {
  let headers = "";
  let text = "";
  for (const [key, value] of Object.entries(tiddler)) {
    if (key === "text") {
      text = value;
    } else {
      const cleanValue = String(value).replace(/\r?\n/g, " ");
      headers += `${key}: ${cleanValue}\n`;
    }
  }
  return `${headers}\n${text}`;
}

function readSinglePageWikiAsFolder(filePath, rawHtml) {
  const tempDir = path.join(path.dirname(filePath), ".kaiban-tmp-" + path.basename(filePath) + "-" + Date.now() + ".wiki");
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, "tiddlywiki.info"), JSON.stringify({ description: "Temp Wiki" }, null, 2), "utf8");
    const tiddlersDir = path.join(tempDir, "tiddlers");
    fs.mkdirSync(tiddlersDir, { recursive: true });

    let count = 0;
    const matches = rawHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
    for (const match of matches) {
      const attrs = match[1];
      const body = match[2];
      if (attrs.includes("tiddlywiki-tiddler-store")) {
        try {
          const tiddlers = JSON.parse(body.trim());
          for (const tiddler of tiddlers) {
            if (tiddler.title) {
              // Exclude system tiddlers to eliminate framework/plugin/theme bloat
              if (tiddler.title.startsWith("$:/")) {
                continue;
              }
              const safeTitle = tiddler.title.replace(/[^a-zA-Z0-9_\-]/g, "_");
              const tidName = `${safeTitle}.tid`;
              const tidContent = tiddlerToTidString(tiddler);
              fs.writeFileSync(path.join(tiddlersDir, tidName), tidContent, "utf8");
              count++;
            }
          }
        } catch (e) {
          dbgErr("Failed to parse store script JSON:", e.message);
        }
      }
    }

    dbg(`Extracted ${count} user tiddlers from single-page wiki into temp folder: ${tempDir}`);

    // Read the temp directory using the directory logic in readReportContent
    const resultText = readReportContent(tempDir);
    return resultText;
  } finally {
    // Always clean up temp files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        dbg("Cleaned up temp wiki folder:", tempDir);
      }
    } catch (e) {
      dbgErr("Failed to clean up temp wiki folder:", e.message);
    }
  }
}

function extractWikiToFolder(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File or directory does not exist: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const tiddlersDir = path.join(filePath, "tiddlers");
    if (!fs.existsSync(tiddlersDir)) {
      throw new Error(`Directory is not a valid TiddlyWiki folder (no tiddlers/ subdirectory found).`);
    }
    let count = 0;
    try {
      const files = fs.readdirSync(tiddlersDir).filter(f => /\.(tid|txt|md)$/.test(f));
      count = files.length;
    } catch (e) {
      throw new Error(`Failed to read directory: ${e.message}`);
    }
    return { count, targetDir: filePath, isAlreadyFolder: true };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".html" && ext !== ".htm") {
    throw new Error("Only .html or .htm TiddlyWiki files, or valid TiddlyWiki folders are supported.");
  }
  const rawHtml = fs.readFileSync(filePath, "utf8");
  if (!rawHtml.includes("tiddlywiki-tiddler-store")) {
    throw new Error("Not a valid TiddlyWiki 5 single-page file (no tiddler store found).");
  }

  const baseDir = path.dirname(filePath);
  const baseName = path.basename(filePath, ext);
  const targetDir = path.join(baseDir, baseName + ".wiki");

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "tiddlywiki.info"), JSON.stringify({
    description: `Extracted from ${baseName}`,
    plugins: [
      "tiddlywiki/filesystem",
      "tiddlywiki/tiddlyweb"
    ],
    themes: [
      "tiddlywiki/snowwhite",
      "tiddlywiki/vanilla"
    ]
  }, null, 2), "utf8");

  const tiddlersDir = path.join(targetDir, "tiddlers");
  fs.mkdirSync(tiddlersDir, { recursive: true });

  let count = 0;
  const matches = rawHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const match of matches) {
    const attrs = match[1];
    const body = match[2];
    if (attrs.includes("tiddlywiki-tiddler-store")) {
      try {
        const tiddlers = JSON.parse(body.trim());
        for (const tiddler of tiddlers) {
          if (tiddler.title) {
            // Exclude system tiddlers to eliminate framework/plugin/theme bloat
            if (tiddler.title.startsWith("$:/")) {
              continue;
            }
            const safeTitle = tiddler.title.replace(/[^a-zA-Z0-9_\-]/g, "_");
            const tidName = `${safeTitle}.tid`;
            const tidContent = tiddlerToTidString(tiddler);
            fs.writeFileSync(path.join(tiddlersDir, tidName), tidContent, "utf8");
            count++;
          }
        }
      } catch (e) {
        throw new Error(`Failed to parse tiddlers store JSON: ${e.message}`);
      }
    }
  }

  return { count, targetDir };
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
    return joined;
  }

  // Check if it is a single-page HTML TiddlyWiki
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html" || ext === ".htm") {
    const rawHtml = fs.readFileSync(filePath, "utf8");
    if (rawHtml.includes("tiddlywiki-tiddler-store")) {
      return readSinglePageWikiAsFolder(filePath, rawHtml);
    }
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const text = stripHtml(raw);
  const capped = text.length > 30000 ? text.slice(0, 30000) + "\n\n[...content truncated...]" : text;
  return capped;
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

  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    const isHeader = /^[\|\s\-:]+$/.test(line.replace(/[^|\-:]/g, ""));
    if (isHeader) return "";
    const cells = line.split("|").filter((c, i, a) => i > 0 && i < a.length - 1);
    return "<tr>" + cells.map(c => `<td>${c.trim()}</td>`).join("") + "</tr>";
  });
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g,
    "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%;margin:1rem 0;font-size:0.9rem;'>$1</table>");

  html = html.replace(/^\- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
  html = html.replace(/^---+$/gm, "<hr>");

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

// ─── KaibanJS Tools Definitions ──────────────────────────────────────────────

let readReportTool = null;
let writeReportTool = null;

function getTools() {
  if (!readReportTool || !writeReportTool) {
    const { DynamicStructuredTool } = require("@langchain/core/tools");
    const { z } = require("zod");

    readReportTool = new DynamicStructuredTool({
      name: "read_report",
      description: "Read the full text content of a report file (HTML or TiddlyWiki folder). Returns plain text suitable for analysis.",
      schema: z.object({
        file_path: z.string().describe("The absolute path to the file or TiddlyWiki folder to read")
      }),
      func: async ({ file_path }) => {
        try {
          dbg("readReportTool executing for:", file_path);
          return readReportContent(file_path);
        } catch (e) {
          dbgErr("readReportTool error:", e.message);
          return `Error reading file: ${e.message}`;
        }
      }
    });

    writeReportTool = new DynamicStructuredTool({
      name: "write_report",
      description: "Write the completed analysis output as a new HTML report file. You must call this tool once at the end when the analysis is ready.",
      schema: z.object({
        board_path: z.string().describe("The absolute path to the output board directory where the report should be saved"),
        file_name: z.string().describe("The name of the HTML file to save"),
        title: z.string().describe("The title of the report"),
        content_markdown: z.string().describe("The report content in Markdown format"),
        skill_name: z.string().optional().describe("The name of the skill/task being executed")
      }),
      func: async ({ board_path, file_name, title, content_markdown, skill_name }) => {
        try {
          dbg("writeReportTool executing — file:", file_name);
          
          // Prevent directory traversal
          const resolvedBoardPath = path.resolve(board_path);
          const outPath = path.resolve(resolvedBoardPath, file_name);
          if (!outPath.startsWith(resolvedBoardPath)) {
            return "Error: Directory traversal is not allowed. The output file must be inside the board directory.";
          }
          
          const wikiDirName = file_name.replace(/\.html$/i, "") + ".wiki";
          const wikiPath = path.resolve(resolvedBoardPath, wikiDirName);
          if (!wikiPath.startsWith(resolvedBoardPath)) {
            return "Error: Directory traversal is not allowed. The output wiki folder must be inside the board directory.";
          }
          
          if (!fs.existsSync(resolvedBoardPath)) {
            fs.mkdirSync(resolvedBoardPath, { recursive: true });
          }

          const timestamp = new Date().toLocaleString("en-IN", {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit"
          });

          const html = buildReportHtml(title, content_markdown, skill_name || "IBC Analysis", timestamp);
          fs.writeFileSync(outPath, html, "utf8");
          dbg("writeReportTool success, written HTML to:", outPath);

          // Export report in TiddlyWiki Folder format
          try {
            if (!fs.existsSync(wikiPath)) {
              fs.mkdirSync(wikiPath, { recursive: true });
            }
            // Write tiddlywiki.info
            const infoContent = {
              "description": title,
              "plugins": [
                "tiddlywiki/filesystem",
                "tiddlywiki/tiddlyweb"
              ],
              "themes": [
                "tiddlywiki/snowwhite",
                "tiddlywiki/vanilla"
              ]
            };
            fs.writeFileSync(path.join(wikiPath, "tiddlywiki.info"), JSON.stringify(infoContent, null, 2), "utf8");

            // Write tiddlers directory
            const tiddlersPath = path.join(wikiPath, "tiddlers");
            if (!fs.existsSync(tiddlersPath)) {
              fs.mkdirSync(tiddlersPath, { recursive: true });
            }

            // Write main.tid tiddler file with HTML report
            const mainTidPath = path.join(tiddlersPath, "main.tid");
            const tidContent = `title: ${title}
type: text/html

${html}`;
            fs.writeFileSync(mainTidPath, tidContent, "utf8");
            dbg("writeReportTool success, written TiddlyWiki to:", wikiPath);
          } catch (errWiki) {
            dbgErr("Failed to write TiddlyWiki format:", errWiki);
          }

          return `Report successfully written to HTML: ${outPath}`;
        } catch (e) {
          dbgErr("writeReportTool error:", e.message);
          return `Error writing report: ${e.message}`;
        }
      }
    });
  }
  return { readReportTool, writeReportTool };
}

// ─── Service API ─────────────────────────────────────────────────────────────

const kaibanSkills = require("../skills/kaiban-skills");

async function checkOllamaHealth() {
  return { ok: true, models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-3.5-flash"] };
}

async function runSkill(skillKey, params, onLog, onProgress, onTeamInit, onTaskStatusChange) {
  if (!kaibanSkills) {
    kaibanSkills = require("../skills/kaiban-skills");
  }
  const skill = kaibanSkills[skillKey];
  if (!skill) {
    throw new Error(`Unknown skill: ${skillKey}`);
  }

  onLog(`\n📚 [KaibanJS] Starting Multi-Agent Team: ${skill.displayName}`);
  onLog(`📝 ${skill.description}`);
  onProgress(0.05);

  // Configure LLM parameters
  const llmConfig = {
    provider: "google",
    model: params.model === "hermes3" ? "gemini-2.5-flash" : params.model,
    apiKey: API_KEY
  };

  dbg("Starting Kaiban team build with model:", llmConfig.model);

  let team;
  try {
    team = skill.build(params, getTools(), llmConfig);
    // Initialize Team Tasks on the visual Agent Task Board
    if (onTeamInit && team.tasks) {
      const tasksData = team.tasks.map((task, idx) => ({
        id: idx.toString(),
        title: task.title,
        description: task.description,
        agentName: task.agent ? task.agent.name : "Agent"
      }));
      onTeamInit(tasksData);
    }
  } catch (err) {
    dbgErr("Failed to build team:", err);
    return { success: false, error: `Failed to build team: ${err.message}` };
  }

  // Subscribe to Zustand store for real-time task/agent tracking
  // (KaibanJS Team does not have .on(); use team.getStore().subscribe() instead)
  const store = team.getStore();
  let lastProcessedLogIndex = 0;
  const unsubscribeStore = store.subscribe((state) => {
    const logs = state.workflowLogs;
    if (!logs) return;

    while (lastProcessedLogIndex < logs.length) {
      const logEntry = logs[lastProcessedLogIndex];
      lastProcessedLogIndex++;

      if (logEntry.logType === "TaskStatusUpdate") {
        const task = logEntry.task;
        const taskStatus = logEntry.taskStatus;
        if (!task || !taskStatus) continue;

        let statusIcon = "⏳";
        if (taskStatus === "DOING") statusIcon = "🔄";
        if (taskStatus === "DONE") statusIcon = "✅";

        const agentName = task.agent ? task.agent.name : "Agent";
        onLog(`[Task Status] ${statusIcon} Task "${task.title}" is ${taskStatus} (${agentName})`);

        // Notify the UI Task Board
        const taskIndex = team.tasks.findIndex(t => t.title === task.title);
        if (onTaskStatusChange && taskIndex !== -1) {
          onTaskStatusChange({
            id: taskIndex.toString(),
            status: taskStatus,
            title: task.title,
            agentName: agentName
          });
        }

        // Move Kanban card on the main board if a target file path is known
        const targetFilePath = (task.targetFilePath) || params.reportPath || params.planAPath || params.valuation1Path;
        if (targetFilePath && window.projectService && window.activeBoardId && window.currentProjectPath) {
          let targetStatus = "todo";
          if (taskStatus === "DOING") targetStatus = "progress";
          if (taskStatus === "DONE") targetStatus = "done";

          try {
            window.projectService.updateReportStatusInBoard(
              window.currentProjectPath,
              window.activeBoardId,
              targetFilePath,
              targetStatus
            );
            // Also update the paired .wiki folder if applicable
            if (targetFilePath.endsWith(".html")) {
              const wikiPath = targetFilePath.replace(/\.html$/i, "") + ".wiki";
              window.projectService.updateReportStatusInBoard(
                window.currentProjectPath,
                window.activeBoardId,
                wikiPath,
                targetStatus
              );
            }
            if (window._loadWikis) {
              window._loadWikis();
            }
          } catch (err) {
            console.error("Failed to move card in background:", err);
          }
        }

      } else if (logEntry.logType === "AgentStatusUpdate") {
        const agent = logEntry.agent;
        if (!agent) continue;

        // Extract any thought text from the metadata
        let thought = null;
        if (logEntry.metadata) {
          if (logEntry.metadata.thought) {
            thought = logEntry.metadata.thought;
          } else if (logEntry.metadata.output && logEntry.metadata.output.thought) {
            thought = logEntry.metadata.output.thought;
          }
        }
        if (thought) {
          onLog(`🤖 [${agent.name}] Thinking: ${thought}`);
        }
      }
    }
  });

  // Start team execution
  try {
    onLog(`\n🚀 Orchestrating agents...`);
    const results = await team.start();
    onLog(`\n🎉 [KaibanJS] Analysis completed successfully!`);
    onProgress(1.0);

    const outPath = path.join(params.boardPath, params.outputName);
    return { success: true, outputFile: outPath, turns: team.tasks.length };
  } catch (err) {
    dbgErr("Team execution failed:", err);
    onLog(`❌ [KaibanJS] Execution failed: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    try { unsubscribeStore(); } catch (e) { /* ignore */ }
  }
}

module.exports = {
  runSkill,
  checkOllamaHealth,
  readReportContent,
  extractWikiToFolder
};
