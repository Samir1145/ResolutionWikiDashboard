// agent.controller.js - Controller for Sidebar Agents tab and Q&A Agent interactions
"use strict";

const path = require("path");
const fs = require("fs");

const TAG = "[AgentCtrl]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

function initAgent() {
  dbg("Initializing Agent Controller UI event listeners");

  // ─── Step 1: Sidebar 2-Way Tab Switcher ────────────────────────────────────
  const tabFoldersBtn = document.getElementById("tabFoldersBtn");
  const tabAgentsBtn = document.getElementById("tabAgentsBtn");
  const foldersTabContent = document.getElementById("foldersTabContent");
  const agentsTabContent = document.getElementById("agentsTabContent");

  if (tabFoldersBtn && tabAgentsBtn && foldersTabContent && agentsTabContent) {
    tabFoldersBtn.addEventListener("click", () => {
      tabFoldersBtn.classList.add("active");
      tabAgentsBtn.classList.remove("active");
      foldersTabContent.style.display = "flex";
      agentsTabContent.style.display = "none";
    });

    tabAgentsBtn.addEventListener("click", () => {
      tabAgentsBtn.classList.add("active");
      tabFoldersBtn.classList.remove("active");
      agentsTabContent.style.display = "flex";
      foldersTabContent.style.display = "none";
    });
  }

  // ─── Step 2: Agent Q&A Panel ───────────────────────────────────────────────
  const agentQueryInput = document.getElementById("agentQueryInput");
  const agentAskBtn = document.getElementById("agentAskBtn");
  const agentLoader = document.getElementById("agentLoader");
  const agentLoaderText = document.getElementById("agentLoaderText");
  const agentAnswerContainer = document.getElementById("agentAnswerContainer");
  const agentSaveReportBtn = document.getElementById("agentSaveReportBtn");

  if (agentAskBtn && agentQueryInput && agentLoader && agentLoaderText && agentAnswerContainer && agentSaveReportBtn) {
    
    agentAskBtn.addEventListener("click", async () => {
      const query = agentQueryInput.value.trim();
      if (!query) return;

      // 1. Reset visual states
      agentLoader.style.display = "block";
      agentLoaderText.textContent = "⚡ Syncing Case Knowledge Catalog...";
      agentAnswerContainer.style.display = "none";
      agentSaveReportBtn.style.display = "none";
      agentAskBtn.disabled = true;

      // Reset global store variables
      window.lastAgentQuery = query;
      window.lastAgentAnswer = null;
      window.lastAgentSources = [];

      try {
        // 2. Perform fast, local mechanical OKF ingestion
        const okfService = require("../okf.service");
        try {
          dbg("Running incremental OKF Ingest for:", window.currentProjectPath);
          okfService.ingestProject(window.currentProjectPath);
        } catch (ingestErr) {
          dbgErr("OKF Ingest failed:", ingestErr.message);
          // Non-blocking fallback; try running agent anyway
        }

        // 3. Configure and trigger the Agent Q&A Skill
        agentLoaderText.textContent = "🤖 Agent is thinking...";
        const agentService = require("../agent.service");

        // Logger callback inside loader text
        const onLog = (msg) => {
          dbg("Agent Log:", msg);
          if (msg.startsWith("🔧 Tool:")) {
            agentLoaderText.textContent = `🤖 Agent: Running ${msg.substring(2)}...`;
          } else if (msg.includes("completed")) {
            agentLoaderText.textContent = "🤖 Saving final response...";
          }
        };

        const onProgress = (pct) => {
          // Progress updates can be handled here if needed
        };

        const boardPath = window.activeBoardId === "board_root" 
          ? window.currentProjectPath 
          : path.join(window.currentProjectPath, window.activeBoardId);

        const params = {
          query: query,
          projectPath: window.currentProjectPath,
          boardPath: boardPath,
          // Let agent.service fall back to DEFAULT_MODEL (.env configured or gemini-2.5-flash)
        };

        const result = await agentService.runSkill("okf_qa", params, onLog, onProgress);
        
        if (result.success) {
          // Retrieve the output report content if saved, or use textResponse fallback
          let answerMarkdown = "";
          if (result.outputFile && fs.existsSync(result.outputFile)) {
            // Read generated report and extract markdown body if any
            const content = fs.readFileSync(result.outputFile, "utf8");
            // If it is a compiled HTML, parse out body text or use fallback
            answerMarkdown = content; 
          }
          
          // Let's check if there is a raw textResponse or we read the output report
          // Wait, okf_qa is a skill that runs runAgent. If the agent does NOT call write_report,
          // runAgent auto-saves text-only response to Agent_Analysis_Report.html.
          // Let's read the saved file or extract content
          let formattedHtml = "";
          if (result.outputFile && fs.existsSync(result.outputFile)) {
            const rawHtml = fs.readFileSync(result.outputFile, "utf8");
            // Extract the body content from report-body class if present
            const match = rawHtml.match(/<div class="report-body">([\s\S]*?)<\/div>/);
            if (match) {
              formattedHtml = match[1];
            } else {
              formattedHtml = rawHtml;
            }
          }

          // Cache final answer
          window.lastAgentAnswer = formattedHtml;
          
          agentAnswerContainer.innerHTML = formattedHtml;
          agentAnswerContainer.style.display = "block";
          agentSaveReportBtn.style.display = "block";
        } else {
          agentAnswerContainer.innerHTML = `<div style="color: var(--danger-accent); font-weight: 500; padding: 0.5rem 0;">
            Agent failed to compile response: ${result.error}
          </div>`;
          agentAnswerContainer.style.display = "block";
        }

      } catch (err) {
        dbgErr("Failed to execute Q&A Agent:", err);
        agentAnswerContainer.innerHTML = `<div style="color: var(--danger-accent); font-weight: 500; padding: 0.5rem 0;">
          Error calling local Agent: ${err.message || err}
        </div>`;
        agentAnswerContainer.style.display = "block";
      } finally {
        agentLoader.style.display = "none";
        agentAskBtn.disabled = false;
      }
    });

    // Also support submitting queries by typing CMD+ENTER / CTRL+ENTER
    agentQueryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        agentAskBtn.click();
      }
    });
  }

  // ─── Step 3: Wire Up Save Agent Q&A Analysis as HTML Report Card ───────────
  const agentSaveReportBtn = document.getElementById("agentSaveReportBtn");
  if (agentSaveReportBtn) {
    agentSaveReportBtn.addEventListener("click", () => {
      if (!window.lastAgentQuery || !window.lastAgentAnswer) {
        alert("No agent answer available to save.");
        return;
      }

      // Prompt user to enter a report title
      const title = prompt("Enter a title for the report:", "Agent Q&A Analysis");
      if (!title || !title.trim()) return;

      const sanitizedTitle = title.trim().replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
      const fileName = `${sanitizedTitle}_${Date.now()}.html`;
      
      const targetDir = window.activeBoardId === "board_root" 
        ? window.currentProjectPath 
        : path.join(window.currentProjectPath, window.activeBoardId);
      const filePath = path.join(targetDir, fileName);

      // Compile styled HTML page template matching the TiddlyDesk style design tokens
      const timestamp = new Date().toLocaleString("en-IN", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });

      const reportHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 2rem;
      background: #0b0f19;
      color: #f8fafc;
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.6;
    }
    h1 {
      font-size: 2rem;
      color: #ffffff;
      border-bottom: 2px solid rgba(255,255,255,0.08);
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .meta {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 2rem;
    }
    .section {
      background: rgba(22, 30, 49, 0.75);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #3b82f6;
      margin-top: 0;
      margin-bottom: 1rem;
    }
    .query {
      font-style: italic;
      color: #e2e8f0;
    }
    .answer {
      line-height: 1.6;
    }
    .answer h1, .answer h2, .answer h3 {
      color: #ffffff;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }
    .answer p {
      margin-bottom: 1rem;
    }
    .answer ul, .answer ol {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
    }
    .answer table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    .answer th, .answer td {
      border: 1px solid rgba(255,255,255,0.1);
      padding: 8px 12px;
      text-align: left;
    }
    .answer th {
      background: rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated via OKF Case Agent on ${timestamp}</div>
  
  <div class="section">
    <div class="section-title">User Query</div>
    <div class="query">"${window.lastAgentQuery}"</div>
  </div>
  
  <div class="section">
    <div class="section-title">AI Answer</div>
    <div class="answer">${window.lastAgentAnswer}</div>
  </div>
</body>
</html>`;

      try {
        fs.writeFileSync(filePath, reportHtml, "utf8");
        if (window.controllers && window.controllers.kanban) {
          window.controllers.kanban.loadWikis();
        }
        alert(`Report successfully saved to board as card: "${title}"`);
      } catch (err) {
        console.error("Failed to save agent report:", err);
        alert(`Failed to save report:\nError: ${err.message}`);
      }
    });
  }
}

module.exports = {
  initAgent
};
