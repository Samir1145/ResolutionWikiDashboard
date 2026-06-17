// agent.service.js – Bespoke ReAct Loop Runner for Resolution Bazaar
// ============================================================================
// 💡 WELCOME BEGGINER DEVELOPER!
// 
// WHAT THIS FILE DOES:
// This is the core engine for our custom AI Agents. It runs the "ReAct" reasoning loop:
// 1. Thought -> LLM decides what to do.
// 2. Action -> LLM calls a Javascript tool (like reading a file or saving a report).
// 3. Observation -> We execute the tool, get the text contents, and send them back to the LLM.
// This file coordinates this cycle, running up to 12 turns, streaming execution logs 
// to the visual terminal, and writing final reports onto your Kanban board.
// ============================================================================

"use strict";

const fs = require("fs");
const path = require("path");

// Import submodules
const client = require("./agent/llm.client");     // Talks to Ollama or Gemini APIs
const utils = require("./agent/utils");           // Formats report structures & strips HTML
const executor = require("./agent/tool.executor"); // Dispatches tool functions to JS execution

const TAG = "[AgentSvc]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

// ─── Step 1: Read Configuration Settings (.env) ─────────────────────────────
// RPs often save API Keys inside a hidden text file named `.env`.
// We search parent directories to load those settings into node's `process.env` registry.
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
          // Strip enclosing quote strings
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val.trim();
        }
      });
    } catch (e) {
      dbgErr("Error reading .env:", e);
    }
    break; // Stop looking once we find and parse the first .env file
  }
}

// Default to Gemini API if the user has key credentials; otherwise run Ollama's local hermes3
const DEFAULT_MODEL   = process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "hermes3";
const MAX_TURNS       = 12; // Maximum thinking loop cycles before stopping to prevent infinite loops

/**
 * Runs the main ReAct reasoning loop.
 * Accepts options containing prompts, tools, log callback hooks, and model configurations.
 */
async function runAgent(options) {
  const {
    model        = DEFAULT_MODEL,
    systemPrompt,
    userMessage,
    tools        = [],
    onLog        = () => {},      // Callback to print logs in the visual terminal panel
    onProgress   = () => {}       // Callback to update sidebar loading bars
  } = options;

  dbg("runAgent start — model:", model, "tools:", tools.length, "skillName:", options.skillName);

  // The context object keeps track of variables used across tool executions
  const context = {
    log:        onLog,
    skillName:  options.skillName || "IBC Analysis",
    sourceFiles: [], // Keeps track of files the agent read
    outputFile: null // Stores the path of the generated output report
  };

  // Setup the initial chat thread history
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userMessage  }
  ];

  onLog("🚀 Agent started");
  onLog(`📡 Model: ${model}`);
  onProgress(0.05);

  let turn = 0;

  // ─── ReAct Loop Execution ──────────────────────────────────────────────────
  while (turn < MAX_TURNS) {
    turn++;
    onLog(`\n🔄 Turn ${turn}/${MAX_TURNS} — calling LLM...`);
    onProgress(0.05 + (turn / MAX_TURNS) * 0.85); // Increment sidebar progress bar visually
    dbg(`--- Turn ${turn} ---`);

    let assistantMessage;
    
    // Step A: Contact the selected LLM provider (Ollama localhost vs Google Gemini API)
    try {
      if (process.env.GEMINI_API_KEY) {
        assistantMessage = await client.chatWithGemini(model, messages, tools);
      } else {
        assistantMessage = await client.chatWithOllama(model, messages, tools);
      }
    } catch (err) {
      const isGemini = !!process.env.GEMINI_API_KEY;
      dbgErr(`${isGemini ? "chatWithGemini" : "chatWithOllama"} threw:`, err.message);
      onLog(`  ❌ LLM call failed: ${err.message}`);
      return { success: false, error: `LLM error on turn ${turn}: ${err.message}`, turns: turn };
    }

    // Append the LLM's thought or tool call response into our message history log
    messages.push(assistantMessage);

    const toolCalls  = assistantMessage.tool_calls;
    const textContent = (assistantMessage.content || "").trim();

    // ─── SCENARIO 1: LLM Returned text response without calling tools ──────────
    // This indicates the agent is finished and ready to print its final answer.
    if (!toolCalls || toolCalls.length === 0) {
      onLog("✅ Agent completed — no tool calls, text response received");
      onProgress(1.0);

      // If a report file has already been saved to disk, return it
      if (context.outputFile) {
        return { success: true, outputFile: context.outputFile, turns: turn };
      }

      // If the model output is plain text, auto-compile it into a styled HTML card automatically
      if (textContent) {
        onLog("💾 Auto-saving text-only response as report...");
        try {
          const outName = (options.outputName || "Agent_Analysis_Report.html");
          const outPath = path.join(
            options.boardPath || path.dirname(options.reportPath || "/tmp"),
            outName
          );
          const timestamp = new Date().toLocaleString("en-IN", {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit"
          });
          const html = utils.buildReportHtml(options.skillName || "IBC Analysis", textContent, context.skillName, timestamp);
          fs.writeFileSync(outPath, html, "utf8");
          context.outputFile = outPath;
          onLog(`📄 Auto-saved to: ${path.basename(outPath)}`);
          return { success: true, outputFile: outPath, turns: turn };
        } catch (saveErr) {
          dbgErr("Auto-save failed:", saveErr.message);
          return { success: true, textResponse: textContent, outputFile: null, turns: turn };
        }
      }

      return { success: false, error: "Agent stopped without producing output", turns: turn };
    }

    // ─── SCENARIO 2: LLM Wants to Execute Tools ──────────────────────────────
    // Loop through and run each tool call requested by the model.
    for (const tc of toolCalls) {
      let fnName, fnArgs;
      if (tc.function) {
        fnName = tc.function.name;       // Gemini format: function.name
        fnArgs = tc.function.arguments;  // Gemini format: function.arguments
      } else {
        fnName = tc.name;                // Ollama format: name
        fnArgs = tc.arguments;           // Ollama format: arguments
      }

      // Parse JSON arguments if they were passed as a raw string format
      if (typeof fnArgs === "string") {
        try {
          fnArgs = JSON.parse(fnArgs);
        } catch (e) {
          dbgErr("Failed to parse tool args JSON:", fnArgs);
          fnArgs = {};
        }
      } else if (!fnArgs) {
        fnArgs = {};
      }

      onLog(`\n🔧 Tool: ${fnName}`);
      
      // Dispatch and execute the JS tool (e.g. read file content, write report)
      const result = executor.executeTool(fnName, fnArgs, context);
      onLog(`  → ${result.slice(0, 120)}${result.length > 120 ? "..." : ""}`);

      // Push the tool observation result back to the messages list so the LLM knows what happened
      messages.push({
        role:    "tool",
        content: result,
        name:    fnName
      });

      // Special check: If the write_report tool was executed successfully, we can end early
      if (fnName === "write_report" && context.outputFile) {
        onLog("📄 Report written — done!");
        onProgress(1.0);
        return { success: true, outputFile: context.outputFile, turns: turn };
      }
    }

    // Safety fallback: if we have written the report and ran at least 2 turns, wrap up
    if (context.outputFile && turn >= 2) {
      return { success: true, outputFile: context.outputFile, turns: turn };
    }
  }

  // If we hit the turn limit
  dbgErr("Max turns reached without completion. outputFile:", context.outputFile);
  if (context.outputFile) {
    return { success: true, outputFile: context.outputFile, turns: MAX_TURNS };
  }
  return { success: false, error: `Max turns (${MAX_TURNS}) reached without completion`, turns: MAX_TURNS };
}

// Load pre-defined system prompts and templates for skills (Section 29A, Valuations, Statutory audits)
const SKILLS = require("./skills/index");
dbg("SKILLS loaded:", Object.keys(SKILLS).join(", "));

/**
 * Invokes a specific multi-agent skill review.
 * Configures prompts, appends target tools, and runs the ReAct runner.
 */
async function runSkill(skillName, params, onLog, onProgress) {
  dbg(`runSkill: "${skillName}", params:`, JSON.stringify(params).slice(0, 300));
  const skill = SKILLS[skillName];
  if (!skill) {
    throw new Error(`Unknown skill: ${skillName}`);
  }

  onLog(`\n🚀 [AgentSvc] Starting Multi-Agent skill execution: ${skillName}`);
  const toolsList = [];
  
  // Wire up file tools for standard audit workflows (read_report, write_report)
  if (skillName === "plan_comparison" || skillName === "valuation_reconciliation" || skillName === "investor_fit" || skillName === "section_29a" || skillName === "statutory_plan_audit") {
    toolsList.push({
      type: "function",
      function: {
        name: "read_report",
        description: "Read text contents of a report file or wiki folder.",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Absolute file path" }
          },
          required: ["file_path"]
        }
      }
    });
    toolsList.push({
      type: "function",
      function: {
        name: "write_report",
        description: "Write final analysis html report to disk.",
        parameters: {
          type: "object",
          properties: {
            board_path: { type: "string", description: "Output folder directory" },
            file_name: { type: "string", description: "Filename (e.g. out.html)" },
            title: { type: "string", description: "Report title" },
            content_markdown: { type: "string", description: "Report contents in Markdown" }
          },
          required: ["board_path", "file_name", "title", "content_markdown"]
        }
      }
    });
  }

  // Package arguments to send to runAgent
  const promptArgs = {
    model: params.model,
    systemPrompt: skill.systemPrompt,
    userMessage: skill.buildUserMessage(params),
    tools: toolsList,
    skillName: skillName,
    outputName: params.outputName,
    boardPath: params.boardPath,
    reportPath: params.reportPath,
    onLog,
    onProgress
  };

  return runAgent(promptArgs);
}

module.exports = {
  runSkill,
  checkOllamaHealth: client.checkOllamaHealth,
  readReportContent: utils.readReportContent,
  extractWikiToFolder: require("./kaiban.service").extractWikiToFolder
};

