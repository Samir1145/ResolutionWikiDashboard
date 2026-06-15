// agent.service.js – Bespoke IBC Agentic Runner for Resolution Bazaar
// Uses Ollama's local /api/chat endpoint (native tool_calls support)
// Or online Google Gemini API (native tool_calls support) if GEMINI_API_KEY is set.
// Implements a ReAct (Reasoning + Acting) loop with full console diagnostics
"use strict";

const fs   = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// ─── Load Environment Variables ───────────────────────────────────────────────
const pathsToTry = [
  path.join(__dirname, "../../../.env"),
  path.join(__dirname, "../../../../.env"),
  path.join(process.cwd(), ".env")
];
for (const p of pathsToTry) {
  if (fs.existsSync(p)) {
    console.log("[AgentSvc] Found .env at:", p);
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
      console.error("[AgentSvc] Error reading .env:", e);
    }
    break;
  }
}

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_MODEL   = process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "hermes3";
const MAX_TURNS       = 12;
const REQUEST_TIMEOUT = 120000; // 2 min per LLM call

// ─── Diagnostic Logger ────────────────────────────────────────────────────────
// All logs appear in the NW.js DevTools console AND bubble to the agent log panel
const TAG = "[AgentSvc]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

dbg("Module loaded — tools:", Object.keys(require("./skills/tools")).join(", "));

// ─── Ollama HTTP Client ───────────────────────────────────────────────────────

function ollamaPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    dbg(`POST ${endpoint} — model: ${body.model}, tools: ${(body.tools||[]).length}, messages: ${body.messages.length}`);

    const options = {
      hostname: "127.0.0.1",
      port:     11434,
      path:     endpoint,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      dbg(`HTTP ${res.statusCode} from Ollama ${endpoint}`);
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        dbg(`Response body length: ${data.length} chars`);
        try {
          const parsed = JSON.parse(data);
          dbg("Parsed response keys:", Object.keys(parsed).join(", "));
          if (parsed.message) {
            dbg("message.role:", parsed.message.role);
            dbg("message.content length:", (parsed.message.content||"").length);
            dbg("message.tool_calls:", JSON.stringify(parsed.message.tool_calls||[]).slice(0, 300));
          }
          if (parsed.error) {
            dbgErr("Ollama returned error field:", parsed.error);
          }
          resolve(parsed);
        } catch (e) {
          dbgErr("JSON parse failed, raw response:", data.slice(0, 500));
          reject(new Error("Failed to parse Ollama response: " + data.slice(0, 200)));
        }
      });
    });

    req.on("error", (e) => {
      dbgErr("HTTP request error:", e.message);
      reject(e);
    });
    req.setTimeout(REQUEST_TIMEOUT, () => {
      dbgErr("Request timed out after", REQUEST_TIMEOUT, "ms");
      req.destroy();
      reject(new Error("Ollama request timed out after " + REQUEST_TIMEOUT + "ms"));
    });

    req.write(payload);
    req.end();
  });
}

async function chatWithOllama(model, messages, tools) {
  const body = {
    model:    model,
    messages: messages,
    stream:   false,
    options: {
      temperature: 0.1,
      num_predict: 4096
    }
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    dbg(`Sending ${tools.length} tools to model:`, tools.map(t => t.function.name).join(", "));
  } else {
    dbg("No tools in this request");
  }

  dbg(`Sending ${messages.length} messages to model. Last message role: ${messages[messages.length-1]?.role}`);

  const response = await ollamaPost("/api/chat", body);

  if (!response || !response.message) {
    const snippet = JSON.stringify(response).slice(0, 400);
    dbgErr("Unexpected Ollama response (no .message field):", snippet);
    throw new Error("Unexpected Ollama response structure: " + snippet);
  }

  const msg = response.message;
  dbg(`LLM response — role: ${msg.role}, content_len: ${(msg.content||"").length}, tool_calls_count: ${(msg.tool_calls||[]).length}`);
  if ((msg.tool_calls||[]).length > 0) {
    dbg("Tool calls:", JSON.stringify(msg.tool_calls).slice(0, 600));
  }
  return msg;
}

// ─── Gemini HTTPS Client ──────────────────────────────────────────────────────

function geminiPost(model, body) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reject(new Error("GEMINI_API_KEY is not set. Please set it in your environment or .env file."));
    }

    const payload = JSON.stringify(body);
    const geminiModel = (model === "hermes3" || !model.startsWith("gemini")) ? "gemini-2.5-flash" : model;
    
    dbg(`POST Gemini API — model: ${geminiModel}, tools: ${(body.tools||[]).length}, contents: ${(body.contents||[]).length}`);

    const options = {
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path: `/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      dbg(`HTTP ${res.statusCode} from Gemini API`);
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            dbgErr("Gemini API returned error:", parsed.error);
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            return;
          }
          resolve(parsed);
        } catch (e) {
          dbgErr("JSON parse failed, raw response:", data.slice(0, 500));
          reject(new Error("Failed to parse Gemini response: " + data.slice(0, 200)));
        }
      });
    });

    req.on("error", (e) => {
      dbgErr("HTTPS request error:", e.message);
      reject(e);
    });
    req.setTimeout(REQUEST_TIMEOUT, () => {
      dbgErr("Gemini request timed out after", REQUEST_TIMEOUT, "ms");
      req.destroy();
      reject(new Error("Gemini request timed out after " + REQUEST_TIMEOUT + "ms"));
    });

    req.write(payload);
    req.end();
  });
}

function convertSchemaToGemini(schema) {
  if (!schema) return schema;
  const newSchema = { ...schema };
  if (typeof newSchema.type === "string") {
    newSchema.type = newSchema.type.toUpperCase();
  }
  if (newSchema.properties) {
    const newProps = {};
    for (const key in newSchema.properties) {
      newProps[key] = convertSchemaToGemini(newSchema.properties[key]);
    }
    newSchema.properties = newProps;
  }
  if (newSchema.items) {
    newSchema.items = convertSchemaToGemini(newSchema.items);
  }
  return newSchema;
}

async function chatWithGemini(model, messages, tools) {
  const geminiContents = [];
  let systemInstructionText = "";

  messages.forEach(msg => {
    if (msg.role === "system") {
      systemInstructionText = msg.content;
    } else if (msg.role === "user") {
      geminiContents.push({
        role: "user",
        parts: [{ text: msg.content }]
      });
    } else if (msg.role === "assistant" || msg.role === "model") {
      const parts = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        msg.tool_calls.forEach(tc => {
          const fnArgs = typeof tc.function.arguments === "string" 
            ? JSON.parse(tc.function.arguments) 
            : tc.function.arguments;
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: fnArgs
            }
          });
        });
      }
      geminiContents.push({
        role: "model",
        parts: parts
      });
    } else if (msg.role === "tool") {
      geminiContents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name,
              response: {
                result: msg.content
              }
            }
          }
        ]
      });
    }
  });

  const body = {
    contents: geminiContents
  };

  if (systemInstructionText) {
    body.systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };
  }

  if (tools && tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: convertSchemaToGemini(t.function.parameters)
        }))
      }
    ];
  }

  const response = await geminiPost(model, body);

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No candidates returned from Gemini API");
  }

  const candidate = response.candidates[0];
  const parts = candidate.content.parts || [];
  
  let textContent = "";
  const toolCalls = [];

  parts.forEach(p => {
    if (p.text) {
      textContent += p.text;
    }
    if (p.functionCall) {
      toolCalls.push({
        function: {
          name: p.functionCall.name,
          arguments: p.functionCall.args
        }
      });
    }
  });

  const resultMsg = {
    role: "assistant",
    content: textContent
  };
  if (toolCalls.length > 0) {
    resultMsg.tool_calls = toolCalls;
  }

  return resultMsg;
}

async function checkOllamaHealth() {
  if (process.env.GEMINI_API_KEY) {
    dbg("GEMINI_API_KEY present — bypassing Ollama check.");
    return { ok: true, models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-3.5-flash"] };
  }

  dbg("Checking Ollama health at http://127.0.0.1:11434/api/tags...");
  return new Promise((resolve) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port:     11434,
      path:     "/api/tags",
      method:   "GET"
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const models = (json.models || []).map(m => m.name || m.model || "");
          dbg("Ollama healthy, models:", models.join(", "));
          resolve({ ok: true, models });
        } catch {
          dbgErr("Could not parse /api/tags response:", data.slice(0, 200));
          resolve({ ok: false, error: "Could not parse Ollama /api/tags response" });
        }
      });
    });
    req.on("error", (e) => {
      dbgErr("Ollama health check failed:", e.message);
      resolve({ ok: false, error: e.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ok: false, error: "Ollama connection timed out (is Ollama running?)" });
    });
    req.end();
  });
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS = require("./skills/tools");
dbg("TOOLS loaded:", Object.keys(TOOLS).join(", "));

// ─── Tool Executor ────────────────────────────────────────────────────────────

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

function buildReportHtml(title, contentMarkdown, skillName, timestamp) {
  const contentHtml = markdownToHtml(contentMarkdown);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
    <h1>${title}</h1>
    <div class="report-meta">
      <span class="meta-badge">🤖 AI Generated</span>
      <span class="meta-badge">📋 Skill: ${skillName}</span>
      <span class="meta-badge">🕐 ${timestamp}</span>
    </div>
  </div>
  <div class="report-body">${contentHtml}</div>
  <div class="footer">Generated by Resolution Bazaar Agentic Engine · ${timestamp}</div>
</body>
</html>`;
}

function executeTool(toolName, args, context) {
  dbg(`executeTool: "${toolName}", args:`, JSON.stringify(args).slice(0, 300));
  try {
    switch (toolName) {

      case "read_report": {
        const filePath = args.file_path;
        if (!filePath) {
          dbgErr("read_report called with no file_path!");
          return "Error: file_path argument is required for read_report";
        }
        context.log(`  📖 Reading: ${path.basename(filePath)}`);
        const content = readReportContent(filePath);
        context.sourceFiles = context.sourceFiles || [];
        context.sourceFiles.push(filePath);
        dbg(`read_report done — ${content.length} chars`);
        return `[Content of ${path.basename(filePath)}]\n\n${content}`;
      }

      case "read_second_report": {
        const filePath = args.file_path;
        if (!filePath) return "Error: file_path required for read_second_report";
        context.log(`  📖 Reading (2nd): ${path.basename(filePath)}`);
        const content = readReportContent(filePath);
        context.sourceFiles = context.sourceFiles || [];
        context.sourceFiles.push(filePath);
        dbg(`read_second_report done — ${content.length} chars`);
        return `[Content of ${path.basename(filePath)} (for comparison)]\n\n${content}`;
      }

      case "list_reports": {
        const boardPath = args.board_path;
        if (!boardPath) return "Error: board_path required for list_reports";
        context.log(`  📂 Listing: ${boardPath}`);
        const reports = listReportFiles(boardPath);
        if (reports.length === 0) return "No reports found in this board directory.";
        return reports.map((r, i) => `${i + 1}. ${r.name}\n   Path: ${r.path}`).join("\n");
      }

      case "write_report": {
        const { board_path, file_name, title, content_markdown } = args;
        dbg(`write_report — board: ${board_path}, file: ${file_name}, title: ${title}, content_len: ${(content_markdown||"").length}`);

        if (!board_path)       return "Error: board_path is required";
        if (!file_name)        return "Error: file_name is required";
        if (!title)            return "Error: title is required";
        if (!content_markdown) return "Error: content_markdown is required";

        context.log(`  ✍️  Writing: ${file_name}`);

        if (!fs.existsSync(board_path)) {
          dbg("Creating board directory:", board_path);
          fs.mkdirSync(board_path, { recursive: true });
        }

        const timestamp = new Date().toLocaleString("en-IN", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit"
        });

        const html = buildReportHtml(title, content_markdown, context.skillName, timestamp);
        const outPath = path.join(board_path, file_name);
        dbg(`Writing ${html.length} bytes to: ${outPath}`);
        fs.writeFileSync(outPath, html, "utf8");
        context.outputFile = outPath;
        dbg("write_report success:", outPath);
        return `Report successfully written to: ${outPath}`;
      }

      default:
        dbgErr("Unknown tool called:", toolName);
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    dbgErr(`executeTool [${toolName}] threw:`, err.message, err.stack);
    context.log(`  ⚠️  Tool error [${toolName}]: ${err.message}`);
    return `Error executing ${toolName}: ${err.message}`;
  }
}

// ─── Core Agent Loop ──────────────────────────────────────────────────────────

async function runAgent(options) {
  const {
    model        = DEFAULT_MODEL,
    systemPrompt,
    userMessage,
    tools        = [],
    onLog        = () => {},
    onProgress   = () => {}
  } = options;

  dbg("runAgent start — model:", model, "tools:", tools.length, "skillName:", options.skillName);

  const context = {
    log:        onLog,
    skillName:  options.skillName || "IBC Analysis",
    sourceFiles: [],
    outputFile: null
  };

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userMessage  }
  ];

  dbg(`systemPrompt length: ${systemPrompt.length}, userMessage length: ${userMessage.length}`);

  onLog("🚀 Agent started");
  onLog(`📡 Model: ${model}`);
  onProgress(0.05);

  let turn = 0;

  while (turn < MAX_TURNS) {
    turn++;
    onLog(`\n🔄 Turn ${turn}/${MAX_TURNS} — calling LLM...`);
    onProgress(0.05 + (turn / MAX_TURNS) * 0.85);
    dbg(`--- Turn ${turn} ---`);

    let assistantMessage;
    try {
      if (process.env.GEMINI_API_KEY) {
        assistantMessage = await chatWithGemini(model, messages, tools);
      } else {
        assistantMessage = await chatWithOllama(model, messages, tools);
      }
    } catch (err) {
      const isGemini = !!process.env.GEMINI_API_KEY;
      dbgErr(`${isGemini ? "chatWithGemini" : "chatWithOllama"} threw:`, err.message);
      onLog(`  ❌ LLM call failed: ${err.message}`);
      return { success: false, error: `LLM error on turn ${turn}: ${err.message}`, turns: turn };
    }

    messages.push(assistantMessage);

    const toolCalls  = assistantMessage.tool_calls;
    const textContent = (assistantMessage.content || "").trim();

    dbg(`Turn ${turn} result — text_len: ${textContent.length}, tool_calls: ${(toolCalls||[]).length}`);
    if (textContent) dbg("Text snippet:", textContent.slice(0, 200));

    if (!toolCalls || toolCalls.length === 0) {
      onLog("✅ Agent completed — no tool calls, text response received");
      dbg("Final text response length:", textContent.length);
      onProgress(1.0);

      if (context.outputFile) {
        dbg("Output file already written:", context.outputFile);
        return { success: true, outputFile: context.outputFile, turns: turn };
      }

      if (textContent) {
        // Auto-save the text response as a report file
        onLog("💾 Auto-saving text-only response as report...");
        try {
          const outName = (options.outputName || "Agent_Analysis_Report.html");
          const outPath = require("path").join(
            options.boardPath || require("path").dirname(options.reportPath || "/tmp"),
            outName
          );
          const timestamp = new Date().toLocaleString("en-IN", {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit"
          });
          const html = buildReportHtml(options.skillName || "IBC Analysis", textContent, context.skillName, timestamp);
          fs.writeFileSync(outPath, html, "utf8");
          context.outputFile = outPath;
          dbg("Auto-saved to:", outPath);
          onLog(`📄 Auto-saved to: ${require("path").basename(outPath)}`);
          return { success: true, outputFile: outPath, turns: turn };
        } catch (saveErr) {
          dbgErr("Auto-save failed:", saveErr.message);
          return { success: true, textResponse: textContent, outputFile: null, turns: turn };
        }
      }

      return { success: false, error: "Agent stopped without producing output", turns: turn };
    }

    // Process tool calls
    for (const tc of toolCalls) {
      dbg("Processing tool_call:", JSON.stringify(tc).slice(0, 400));

      // Normalise Ollama's tool_call structure
      let fnName, fnArgs;
      if (tc.function) {
        fnName = tc.function.name;
        fnArgs = tc.function.arguments;
      } else {
        // Some Ollama versions use flat structure
        fnName = tc.name;
        fnArgs = tc.arguments;
      }

      dbg(`Tool: "${fnName}", args type: ${typeof fnArgs}`);

      // Parse args if they come as a string
      if (typeof fnArgs === "string") {
        try {
          fnArgs = JSON.parse(fnArgs);
          dbg("Parsed args from string:", JSON.stringify(fnArgs).slice(0, 200));
        } catch (e) {
          dbgErr("Failed to parse tool args JSON:", fnArgs.slice(0, 200));
          fnArgs = {};
        }
      } else if (!fnArgs) {
        dbgErr("Tool args are null/undefined for:", fnName);
        fnArgs = {};
      }

      onLog(`\n🔧 Tool: ${fnName}`);
      const result = executeTool(fnName, fnArgs, context);
      dbg(`Tool result length: ${result.length}`);
      onLog(`  → ${result.slice(0, 120)}${result.length > 120 ? "..." : ""}`);

      // Ollama expects tool results with role:"tool"
      messages.push({
        role:    "tool",
        content: result,
        name:    fnName
      });

      if (fnName === "write_report" && context.outputFile) {
        onLog("📄 Report written — done!");
        dbg("write_report succeeded, returning immediately:", context.outputFile);
        onProgress(1.0);
        return { success: true, outputFile: context.outputFile, turns: turn };
      }
    }

    // After write_report, check if we should stop
    if (context.outputFile && turn >= 2) {
      dbg("Output file written and at least 2 turns done — stopping loop");
      return { success: true, outputFile: context.outputFile, turns: turn };
    }
  }

  dbgErr("Max turns reached without completion. outputFile:", context.outputFile);
  if (context.outputFile) {
    return { success: true, outputFile: context.outputFile, turns: MAX_TURNS };
  }
  return { success: false, error: `Max turns (${MAX_TURNS}) reached without completion`, turns: MAX_TURNS };
}

// ─── IBC Skills ──────────────────────────────────────────────────────────────

const SKILLS = require("./skills/index");
dbg("SKILLS loaded:", Object.keys(SKILLS).join(", "));

async function runSkill(skillName, params, onLog, onProgress) {
  dbg(`runSkill: "${skillName}", params:`, JSON.stringify(params).slice(0, 300));

  const skill = SKILLS[skillName];
  if (!skill) {
    dbgErr("Unknown skill:", skillName, "available:", Object.keys(SKILLS).join(","));
    return { success: false, error: `Unknown skill: ${skillName}` };
  }

  onLog(`\n📚 Skill: ${skill.displayName}`);
  onLog(`📝 ${skill.description}`);

  let built;
  try {
    dbg("Calling skill.build()...");
    built = skill.build(params);
    dbg("skill.build() OK — tools:", built.tools.map(t => t.function.name).join(", "));
    dbg("systemPrompt length:", built.systemPrompt.length);
    dbg("userMessage length:", built.userMessage.length);
  } catch (e) {
    dbgErr("skill.build() threw:", e.message, e.stack);
    return { success: false, error: `Skill build error: ${e.message}` };
  }

  return runAgent({
    model:        params.model || DEFAULT_MODEL,
    skillName:    skill.displayName,
    systemPrompt: built.systemPrompt,
    userMessage:  built.userMessage,
    tools:        built.tools,
    // Pass through path context for auto-save fallback
    boardPath:    params.boardPath,
    reportPath:   params.reportPath || params.planAPath || params.valuation1Path,
    outputName:   params.outputName,
    onLog,
    onProgress
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runSkill,
  runAgent,
  checkOllamaHealth,
  SKILLS,
  TOOLS
};
