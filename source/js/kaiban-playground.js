// kaiban-playground.js – Interactive KaibanJS Resume Creator Playground
"use strict";

const fs = require("fs");
const path = require("path");
const { Agent, Task, Team } = require("kaibanjs");

// DOM ELEMENTS
const providerInput = document.getElementById("providerInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const modelSelect = document.getElementById("modelSelect");
const aboutMeInput = document.getElementById("aboutMeInput");
const btnStartTeam = document.getElementById("btnStartTeam");
const btnSaveResume = document.getElementById("btnSaveResume");
const logTerminal = document.getElementById("logTerminal");
const resumePreview = document.getElementById("resumePreview");
const projectIndicator = document.getElementById("projectIndicator");

let generatedResumeMarkdown = "";
let isExecuting = false;

// Initialize Project Indicators
function initProjectInfo() {
  if (window.currentProjectPath) {
    const projName = path.basename(window.currentProjectPath);
    projectIndicator.textContent = `Target Project: ${projName} (${window.activeBoardId})`;
  } else {
    projectIndicator.textContent = "Target Project: None (Read-only mode)";
  }
}

// Load Environment Variable (Gemini API Key)
let ENV_GEMINI_KEY = "";
try {
  const pathsToTry = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "source/.env"),
    path.join(__dirname, "../../.env"),
    path.join(__dirname, "../../../.env"),
    path.join(__dirname, "../../../../.env"),
    path.join(__dirname, "../.env"),
    path.join(__dirname, ".env")
  ];
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      content.split("\n").forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || "";
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val.trim();
        }
      });
      break;
    }
  }
  ENV_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (ENV_GEMINI_KEY) {
    apiKeyInput.value = ENV_GEMINI_KEY;
    apiKeyInput.placeholder = "Loaded from TiddlyDesk configuration (.env)";
  }
} catch (e) {
  console.error("Failed to parse env in playground:", e);
}

// Map provider selection to model select options
providerInput.addEventListener("change", () => {
  const prov = providerInput.value;
  modelSelect.innerHTML = "";

  if (prov === "gemini") {
    modelSelect.innerHTML = `
      <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
      <option value="gemini-2.5-pro">gemini-2.5-pro</option>
      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
      <option value="gemini-3.5-flash">gemini-3.5-flash</option>
    `;
  } else if (prov === "openai") {
    modelSelect.innerHTML = `
      <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
      <option value="gpt-4o">gpt-4o</option>
    `;
  }
});

// LOG WRITER
function log(msg, type = "info") {
  const line = document.createElement("div");
  line.className = `log-entry ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logTerminal.appendChild(line);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

// UPDATE BOARD COLUMNS
function moveTaskCard(cardId, status) {
  const card = document.getElementById(cardId);
  if (!card) return;

  if (card.parentNode) {
    card.parentNode.removeChild(card);
  }

  const badge = card.querySelector(".card-status-badge");
  card.className = "task-card";

  let targetCol;
  if (status === "TODO") {
    targetCol = document.getElementById("col-list-todo");
    card.classList.add("todo");
    if (badge) {
      badge.textContent = "To Do";
      badge.style.background = "rgba(148, 163, 184, 0.15)";
      badge.style.color = "#94a3b8";
    }
  } else if (status === "DOING") {
    targetCol = document.getElementById("col-list-doing");
    card.classList.add("doing");
    if (badge) {
      badge.textContent = "Doing";
      badge.style.background = "rgba(59, 130, 246, 0.15)";
      badge.style.color = "#60a5fa";
    }
  } else if (status === "BLOCKED") {
    targetCol = document.getElementById("col-list-doing");
    card.classList.add("doing");
    if (badge) {
      badge.textContent = "⚠ Blocked";
      badge.style.background = "rgba(251, 146, 60, 0.15)";
      badge.style.color = "#fb923c";
    }
  } else if (status === "DONE") {
    targetCol = document.getElementById("col-list-done");
    card.classList.add("done");
    if (badge) {
      badge.textContent = "Done";
      badge.style.background = "rgba(16, 185, 129, 0.15)";
      badge.style.color = "#34d399";
    }
  }

  if (targetCol) {
    targetCol.appendChild(card);
  }
  updateColumnCounts();
}

function updateColumnCounts() {
  document.getElementById("count-todo").textContent = document.getElementById("col-list-todo").children.length;
  document.getElementById("count-doing").textContent = document.getElementById("col-list-doing").children.length;
  document.getElementById("count-done").textContent = document.getElementById("col-list-done").children.length;
}

// Markdown parser
function markdownToHtml(markdown) {
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm,   "<h1>$1</h1>");

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\text{}(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g,          "<em>$1</em>");

  html = html.replace(/^\- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
  
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const t = block.trim();
    if (!t) return "";
    if (/^<(h[1-6]|ul|li)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return html;
}

function buildReportHtml(title, contentMarkdown, timestamp) {
  const contentHtml = markdownToHtml(contentMarkdown);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px; margin: 0 auto; padding: 2rem;
      background: #0b0f19; color: #f8fafc; line-height: 1.6;
    }
    h1 { color: #8b5cf6; border-bottom: 2px solid rgba(139,92,246,0.3); padding-bottom: 0.5rem; }
    h2 { color: #60a5fa; margin-top: 1.5rem; }
    ul { padding-left: 1.5rem; margin-bottom: 1rem; }
    p { color: #cbd5e1; margin-bottom: 1rem; }
    strong { color: #fff; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div style="margin-top: 1.5rem;">${contentHtml}</div>
</body>
</html>`;
}

// EXECUTE MULTI-AGENT TEAM
async function runPlaygroundTeam() {
  if (isExecuting) return;
  isExecuting = true;
  btnStartTeam.disabled = true;
  btnStartTeam.textContent = "⌛ Orchestrating...";
  btnSaveResume.disabled = true;

  // Clear visual board
  moveTaskCard("card-task-zoe", "TODO");
  moveTaskCard("card-task-alex", "TODO");

  logTerminal.innerHTML = "";
  log("Initializing Resume Creation Team...", "info");

  // Inputs
  const provider = providerInput.value;
  const apiKey = apiKeyInput.value.trim() || (provider === "gemini" ? process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ENV_GEMINI_KEY : process.env.OPENAI_API_KEY || "");
  const model = modelSelect.value;
  const aboutMeText = aboutMeInput.value.trim();

  // ── DEBUG ──────────────────────────────────────────────────
  console.group("🚀 [KaibanPlayground] runPlaygroundTeam");
  console.log("Provider :", provider);
  console.log("Model    :", model);
  console.log("API key length:", apiKey ? apiKey.length : 0, "| first 8 chars:", apiKey ? apiKey.substring(0, 8) + "…" : "(none)");
  console.log("aboutMe  :", aboutMeText.substring(0, 80) + "…");
  // ───────────────────────────────────────────────────────────

  if (!apiKey) {
    log(`Error: API Key is required. Please input a key for ${provider}.`, "error");
    console.error("[KaibanPlayground] No API key provided – aborting.");
    console.groupEnd();
    isExecuting = false;
    btnStartTeam.disabled = false;
    btnStartTeam.textContent = "▶ Start Resume Team";
    return;
  }

  const llmConfig = {
    provider: provider === "gemini" ? "google" : "openai",
    model: model,
    apiKey: apiKey
  };

  console.log("llmConfig:", JSON.stringify({ ...llmConfig, apiKey: llmConfig.apiKey.substring(0, 8) + "…" }));
  log(`Using model: ${model} (${llmConfig.provider})`, "info");

  // Define Agents
  const profileAnalyst = new Agent({
    name: "Mary",
    role: "Profile Analyst",
    goal: "Extract structured information from conversational user input.",
    background: "Data Processor",
    tools: [],
    llmConfig
  });

  const resumeWriter = new Agent({
    name: "Alex Mercer",
    role: "Resume Writer",
    goal: "Craft compelling, well-structured resumes that effectively showcase job seekers qualifications.",
    background: "Recruiter and professional resume writer.",
    tools: [],
    llmConfig
  });

  // Define Tasks
  const processingTask = new Task({
    description: `Extract relevant details such as name, experience, skills, and job history from the user's 'aboutMe' input. aboutMe: ${aboutMeText}`,
    expectedOutput: "Structured data ready to be used for a resume creation.",
    agent: profileAnalyst
  });

  const resumeCreationTask = new Task({
    description: `Utilize the structured data to create a detailed and attractive resume. Enrich the resume content by inferring additional details. Include sections such as a personal summary, detailed work experience, skills, and educational background.`,
    expectedOutput: "A professionally formatted resume in markdown format.",
    agent: resumeWriter
  });

  console.log("[KaibanPlayground] Agents and tasks created. Building Team…");

    let unsubscribe = null;
    try {
      const team = new Team({
        name: "Resume Creation Team",
        agents: [profileAnalyst, resumeWriter],
        tasks: [processingTask, resumeCreationTask],
        env: {
          GEMINI_API_KEY: apiKey,
          OPENAI_API_KEY: apiKey
        }
      });

      console.log("[KaibanPlayground] Team created. Store:", typeof team.getStore());
      console.log("[KaibanPlayground] Initial store state (tasks):", team.getStore().getState().tasks.map(t => ({ title: t.title, status: t.status })));

      // Setup Zustand store subscription for real-time tracking
      const store = team.getStore();
      let lastProcessedIndex = 0;
      
      unsubscribe = store.subscribe((state) => {
        const logs = state.workflowLogs;
        if (!logs) return;
        
        while (lastProcessedIndex < logs.length) {
          const logEntry = logs[lastProcessedIndex];
          lastProcessedIndex++;

          // ── RAW LOG DUMP ─────────────────────────────────────
          console.log(`[KaibanPlayground] LOG[${lastProcessedIndex - 1}] type=${logEntry.logType}`, JSON.stringify({
            logType: logEntry.logType,
            workflowStatus: logEntry.workflowStatus,
            taskStatus: logEntry.taskStatus,
            agentStatus: logEntry.agentStatus,
            task: logEntry.task ? { title: logEntry.task.title, status: logEntry.task.status } : null,
            agent: logEntry.agent ? { name: logEntry.agent.name, status: logEntry.agent.status } : null,
            metadata: logEntry.metadata
          }, null, 2));
          // ─────────────────────────────────────────────────────
          
          if (logEntry.logType === "WorkflowStatusUpdate") {
            const wfSt = logEntry.workflowStatus || "";
            const msg = (logEntry.metadata && logEntry.metadata.message) || "";
            const err = (logEntry.metadata && logEntry.metadata.error) || "";
            if (wfSt === "FINISHED") {
              log(`✅ Workflow: ${wfSt}`, "success");
            } else if (wfSt === "BLOCKED" || wfSt === "ERRORED") {
              log(`❌ Workflow: ${wfSt}${err ? " — " + err : ""}${msg ? " — " + msg : ""}`, "error");
            } else if (wfSt) {
              log(`ℹ️ Workflow: ${wfSt}${msg ? " — " + msg : ""}`, "info");
            }

          } else if (logEntry.logType === "TaskStatusUpdate") {
            const task = logEntry.task;
            const status = logEntry.taskStatus;
            if (task && status) {
              let cardId = "";
              const taskTitle = task.title || "";
              const taskDesc = task.description || "";
              const agentName = task.agent ? task.agent.name : "";
              
              if (taskTitle.toLowerCase().includes("extract") || taskDesc.toLowerCase().includes("extract") || agentName === "Mary") {
                cardId = "card-task-zoe";
              } else {
                cardId = "card-task-alex";
              }
              
              // Show error reason if blocked
              let statusMsg = `[Task: ${taskTitle || taskDesc.substring(0, 30)}...] → ${status}`;
              if ((status === "BLOCKED" || status === "ERROR") && logEntry.metadata && logEntry.metadata.error) {
                const errText = logEntry.metadata.error.message || String(logEntry.metadata.error);
                statusMsg += ` (${errText})`;
                console.error("[KaibanPlayground] Task blocked/errored:", logEntry.metadata.error);
              }
              log(statusMsg, status === "DONE" ? "success" : status === "BLOCKED" || status === "ERROR" ? "error" : "info");
              
              // Map BLOCKED → DOING visually so card stays on-board rather than disappearing
              const visualStatus = (status === "BLOCKED" || status === "ERROR") ? "BLOCKED" : status;
              moveTaskCard(cardId, visualStatus);
            }

          } else if (logEntry.logType === "AgentStatusUpdate") {
            const agent = logEntry.agent;
            if (agent) {
              let thought = null;
              if (logEntry.metadata) {
                if (logEntry.metadata.thought) {
                  thought = logEntry.metadata.thought;
                } else if (logEntry.metadata.output && logEntry.metadata.output.thought) {
                  thought = logEntry.metadata.output.thought;
                } else if (logEntry.metadata.message) {
                  thought = logEntry.metadata.message;
                } else if (logEntry.metadata.error) {
                  const errMsg = logEntry.metadata.error.message || String(logEntry.metadata.error);
                  thought = `⚠️ Error: ${errMsg}`;
                  console.error("[KaibanPlayground] Agent error:", logEntry.metadata.error);
                }
              }
              
              if (thought) {
                const isErr = thought.startsWith("⚠️");
                log(`🤖 [Agent: ${agent.name}] ${thought}`, isErr ? "error" : "thought");
              }
            }
          }
        }
      });

      log("Starting orchestration...", "info");
      console.log("[KaibanPlayground] Calling team.start()…");
      const workflowResult = await team.start();

      // ── RESULT DUMP ───────────────────────────────────────
      console.log("[KaibanPlayground] team.start() resolved. workflowResult:", workflowResult);
      console.log("[KaibanPlayground] processingTask.result   :", processingTask.result);
      console.log("[KaibanPlayground] processingTask.status   :", processingTask.status);
      console.log("[KaibanPlayground] resumeCreationTask.result:", resumeCreationTask.result);
      console.log("[KaibanPlayground] All task statuses:", (team.getStore().getState().tasks || []).map(t => ({ title: t.title, status: t.status, result: t.result })));
      // ─────────────────────────────────────────────────────
      
      // workflowResult is { status, result, stats } – not a plain string
      const wfStatus = workflowResult && workflowResult.status ? workflowResult.status : "UNKNOWN";
      if (wfStatus === "FINISHED") {
        log("Collaboration completed successfully! ✅", "success");
      } else if (wfStatus === "BLOCKED") {
        log(`⚠️ Workflow ended with status: ${wfStatus}. Check agent API key / model quota. Extracting partial output…`, "error");
      } else {
        log(`Workflow ended with status: ${wfStatus}`, "info");
      }

      // Helper: safely coerce TaskResult (string | object | unknown) to a plain string
      function coerceToString(val) {
        if (val == null) return "";
        if (typeof val === "string") return val;
        // Some TaskResult objects have a .result or .output field
        if (typeof val === "object") {
          if (typeof val.result === "string") return val.result;
          if (typeof val.output === "string") return val.output;
          if (typeof val.finalAnswer === "string") return val.finalAnswer;
          return JSON.stringify(val, null, 2);
        }
        return String(val);
      }

      // Prefer the last task's result, then the workflow result, then empty
      const rawOutput =
        coerceToString(resumeCreationTask.result) ||
        coerceToString(workflowResult && workflowResult.result) ||
        "";

      console.log("[KaibanPlayground] rawOutput type:", typeof rawOutput, "| length:", rawOutput.length, "| preview:", rawOutput.substring(0, 120));
      generatedResumeMarkdown = rawOutput;

      if (generatedResumeMarkdown) {
        // Render markdown preview
        resumePreview.innerHTML = markdownToHtml(generatedResumeMarkdown);
        
        // Switch to output tab
        if (window.switchTab) {
          window.switchTab("resume");
        }

        // Enable Save
        if (window.currentProjectPath) {
          btnSaveResume.disabled = false;
          btnSaveResume.textContent = "💾 Save to Board";
        }
      } else {
        log("⚠️ No resume output was generated. The model may have been blocked or returned an empty response. Try again or switch to a different model.", "error");
      }

    } catch (err) {
      console.error("[KaibanPlayground] Caught exception:", err);
      console.error("[KaibanPlayground] Stack:", err.stack);
      log(`Orchestration failed: ${err.message}`, "error");
    } finally {
      console.groupEnd();
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          console.error("Failed to unsubscribe store:", e);
        }
      }
      isExecuting = false;
      btnStartTeam.disabled = false;
      btnStartTeam.textContent = "▶ Start Resume Team";
    }
}

// SAVE RESUME TO BOARD

btnSaveResume.addEventListener("click", () => {
  if (!generatedResumeMarkdown || !window.currentProjectPath) return;

  try {
    const boardId = window.activeBoardId || "board_root";
    const boardSubPath = boardId === "board_root" ? "" : boardId;
    const boardPath = path.join(window.currentProjectPath, boardSubPath);

    if (!fs.existsSync(boardPath)) {
      fs.mkdirSync(boardPath, { recursive: true });
    }

    const htmlFileName = "Resume_David_Llaca.html";
    const wikiDirName = "Resume_David_Llaca.wiki";

    const timestamp = new Date().toLocaleString("en-IN", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    // 1. Save standard HTML file
    const htmlContent = buildReportHtml("Resume - David Llaca", generatedResumeMarkdown, timestamp);
    const htmlOutPath = path.join(boardPath, htmlFileName);
    fs.writeFileSync(htmlOutPath, htmlContent, "utf8");

    // 2. Save TiddlyWiki Folder Format
    const wikiPath = path.join(boardPath, wikiDirName);
    if (!fs.existsSync(wikiPath)) {
      fs.mkdirSync(wikiPath, { recursive: true });
    }
    const infoContent = {
      "description": "Resume - David Llaca",
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

    const tiddlersPath = path.join(wikiPath, "tiddlers");
    if (!fs.existsSync(tiddlersPath)) {
      fs.mkdirSync(tiddlersPath, { recursive: true });
    }

    const tidContent = `title: Resume - David Llaca
type: text/html

${htmlContent}`;
    fs.writeFileSync(path.join(tiddlersPath, "main.tid"), tidContent, "utf8");

    // 3. Mark both cards as "done" in project metadata
    if (window.projectService) {
      window.projectService.updateReportStatusInBoard(window.currentProjectPath, boardId, htmlOutPath, "done");
      window.projectService.updateReportStatusInBoard(window.currentProjectPath, boardId, wikiPath, "done");
    }

    // 4. Trigger reload
    if (window._parentLoadWikis) {
      window._parentLoadWikis();
    }

    btnSaveResume.disabled = true;
    btnSaveResume.textContent = "✅ Saved Successfully!";
    log(`Saved resume HTML and TiddlyWiki folder to: ${boardPath}`, "success");
    alert(`Resume saved successfully to project board!`);

  } catch (err) {
    log(`Failed to save: ${err.message}`, "error");
    alert("Error saving resume: " + err.message);
  }
});

btnStartTeam.addEventListener("click", runPlaygroundTeam);

// INIT
setTimeout(() => {
  initProjectInfo();
}, 200);
