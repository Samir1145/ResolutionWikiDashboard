// rag.controller.js - Sidebar RAG tab interactions and queries dispatch
// ============================================================================
// 💡 WELCOME BEGGINER DEVELOPER!
// 
// WHAT THIS FILE DOES:
// This script is the visual controller for the RAG (Retrieval-Augmented Generation) search sidebar.
// Its jobs are:
// 1. Toggling the sidebar tabs between "🤖 Agents" (LexAI configuration) and "🔍 Local RAG" (Semantic chat).
// 2. Processing user text questions, calling the background RAG service, and rendering
//    the generated response as formatted HTML.
// 3. Handling file uploads (the paperclip button) to copy new files into your project folders.
// 4. Compiling your chat questions and AI answers into neat, self-contained HTML report cards.
// ============================================================================

"use strict";

const path = require("path");
const fs = require("fs");

/**
 * Initializes RAG sidebar tabs, input fields, copy buttons, and click hooks.
 * Executed once when the main application finishes booting up.
 */
function initRag() {
  const tabFoldersBtn = document.getElementById("tabFoldersBtn");
  const tabAgentsBtn = document.getElementById("tabAgentsBtn");
  const tabRagBtn = document.getElementById("tabRagBtn");
  const foldersTabContent = document.getElementById("foldersTabContent");
  const agentsTabContent = document.getElementById("agentsTabContent");
  const ragTabContent = document.getElementById("ragTabContent");

  // ─── Step 1: Wire Up Tab Switching Buttons ───────────────────────────────
  if (tabFoldersBtn && tabAgentsBtn && tabRagBtn && foldersTabContent && agentsTabContent && ragTabContent) {
    // Switch to 📂 Folders panel
    tabFoldersBtn.addEventListener("click", () => {
      console.log("[User Event] Switched to 📂 Folders tab.");
      tabFoldersBtn.classList.add("active");
      tabAgentsBtn.classList.remove("active");
      tabRagBtn.classList.remove("active");
      foldersTabContent.style.display = "flex";
      agentsTabContent.style.display = "none";
      ragTabContent.style.display = "none";
    });

    // Switch to 🤖 Agents panel
    tabAgentsBtn.addEventListener("click", () => {
      console.log("[User Event] Switched to 🤖 Agents tab.");
      tabAgentsBtn.classList.add("active");
      tabFoldersBtn.classList.remove("active");
      tabRagBtn.classList.remove("active");
      agentsTabContent.style.display = "flex";
      foldersTabContent.style.display = "none";
      ragTabContent.style.display = "none";
    });

    // Switch to 🔍 Local RAG search panel
    tabRagBtn.addEventListener("click", () => {
      console.log("[User Event] Switched to 🔍 Local RAG tab.");
      tabRagBtn.classList.add("active");
      tabFoldersBtn.classList.remove("active");
      tabAgentsBtn.classList.remove("active");
      ragTabContent.style.display = "flex";
      foldersTabContent.style.display = "none";
      agentsTabContent.style.display = "none";
      
      // Every time a user opens the RAG tab, trigger a background indexing sweep
      // to check if any new files were added to the directory.
      if (window.controllers && window.controllers.project) {
        window.controllers.project.triggerRagIndexing();
      }
    });
  }

  // ─── Step 2: Wire Up Ask Query Input Submissions ──────────────────────────
  const ragAskBtn = document.getElementById("ragAskBtn");
  const ragQueryInput = document.getElementById("ragQueryInput");

  if (ragAskBtn && ragQueryInput) {
    // Executes when a user clicks the "Ask Local LLM" button
    ragAskBtn.addEventListener("click", async () => {
      const query = ragQueryInput.value.trim();
      if (!query) return; // Do nothing if input text is empty

      const loader = document.getElementById("ragLoader");
      const loaderText = document.getElementById("ragLoaderText");
      const answerContainer = document.getElementById("ragAnswerContainer");
      const footer = document.getElementById("ragFooter");

      // Show loader spinners and hide previous responses
      if (loader) loader.style.display = "block";
      if (loaderText) loaderText.textContent = "⚡ Ingesting local documents...";
      if (answerContainer) answerContainer.style.display = "none";
      if (footer) footer.style.display = "none";
      ragAskBtn.disabled = true; // Disable button to prevent double-clicks

      // Import the RAG wrapper. Inside is a spawn command that launches `run_rag.js` in a node thread.
      const ragService = require("../rag.service");

      try {
        // Step A: Trigger file indexing to ensure database is up-to-date.
        if (window.controllers && window.controllers.project) {
          await window.controllers.project.triggerRagIndexing();
        }

        // Step B: Send the question to the background RAG runner.
        // The callback receives status updates (like "Ingesting context into local Llamafile...")
        if (loaderText) loaderText.textContent = `🔄 Ingesting context into local Llamafile...`;
        const result = await ragService.queryRAG(window.currentProjectPath, query, (msg) => {
          if (loaderText) loaderText.textContent = msg;
        });

        // Step C: Translate the AI's markdown response text (e.g. bold highlights, tables) into visible HTML.
        const parsed = window.controllers.markdown.parseMarkdown(result.answer);
        if (answerContainer) {
          answerContainer.innerHTML = parsed;
          answerContainer.style.display = "block";
        }

        // Step D: Render the files citation dropdown details list
        const sourcesList = document.getElementById("ragSourcesList");
        if (sourcesList) {
          sourcesList.innerHTML = "";
          if (result.sources && result.sources.length > 0) {
            result.sources.forEach(src => {
              const li = document.createElement("li");
              li.textContent = src; // Filename (e.g. "Valuation_Report.html")
              sourcesList.appendChild(li);
            });
            const details = document.getElementById("ragSourcesDetails");
            if (details) details.style.display = "block";
          } else {
            const details = document.getElementById("ragSourcesDetails");
            if (details) details.style.display = "none";
          }
        }

        // Show the footer panel containing the "Save as Report" button
        if (footer) footer.style.display = "flex";

        // Store active values globally so the user can save them as an HTML report card later
        window.lastRagQuery = query;
        window.lastRagAnswer = result.answer;
        window.lastRagSources = result.sources;
      } catch (err) {
        console.error("[RAG] Query failed:", err);
        if (answerContainer) {
          answerContainer.style.display = "block";
          
          // Print friendly error messages if the local Llamafile server isn't running on port 8080.
          if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("fetch") || err.message.includes("ECONNREFUSED"))) {
            answerContainer.innerHTML = `<div style="color: var(--danger-accent); font-weight: 500; padding: 0.5rem 0;">
              Local AI server not detected on port 8080. Please start your Llamafile.
            </div>`;
          } else {
            answerContainer.innerHTML = `<div style="color: var(--danger-accent); font-weight: 500; padding: 0.5rem 0;">
              Error querying local RAG: ${err.message || err}
            </div>`;
          }
        }
      } finally {
        // Hide spinner loader and enable button click triggers
        if (loader) loader.style.display = "none";
        ragAskBtn.disabled = false;
      }
    });

    // Also support submitting queries by typing CMD+ENTER / CTRL+ENTER inside the text box.
    ragQueryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        ragAskBtn.click();
      }
    });
  }

  // ─── Step 3: Wire Up Paperclip Document Uploads ────────────────────────────
  const ragUploadBtn = document.getElementById("ragUploadBtn");
  const ragFileInput = document.getElementById("ragFileInput");

  if (ragUploadBtn && ragFileInput) {
    // Clicking the paperclip icon triggers a click event on a hidden system `<input type="file">` tag.
    ragUploadBtn.addEventListener("click", () => {
      ragFileInput.click();
    });

    // Triggers when the user selects files in the host operating system window dialog.
    ragFileInput.onchange = (evt) => {
      const files = evt.target.files;
      if (!files || files.length === 0) return;

      // Determine where to save the files. 
      // Option 1: Save specifically to the hidden .tiddlydesk-rag/documents/ folder
      const targetDir = path.join(window.currentProjectPath, ".tiddlydesk-rag", "documents");

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      let copiedCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const srcPath = file.path; // Absolute path to the original file
        if (!srcPath) continue;

        try {
          const destPath = path.join(targetDir, path.basename(srcPath));
          
          // Copy the file physically into the hidden RAG directory on your hard drive
          fs.copyFileSync(srcPath, destPath);
          copiedCount++;
        } catch (err) {
          console.error("Failed to copy file to RAG folder:", srcPath, err);
          alert(`Failed to copy file: ${path.basename(srcPath)}\nError: ${err.message}`);
        }
      }

      // If files were successfully copied:
      if (copiedCount > 0) {
        evt.target.value = ""; // Reset input file select state
        
        // Trigger RAG indexing to ingest the new documents into the database
        if (window.controllers && window.controllers.project) {
          window.controllers.project.triggerRagIndexing();
        }
      }
    };
  }

  // ─── Step 4: Wire Up Save RAG Analysis as HTML Report Card ─────────────────
  const ragSaveReportBtn = document.getElementById("ragSaveReportBtn");
  if (ragSaveReportBtn) {
    ragSaveReportBtn.addEventListener("click", () => {
      if (!window.lastRagQuery || !window.lastRagAnswer) {
        alert("No query answer available to save.");
        return;
      }

      // Prompt user to enter a report title
      const title = prompt("Enter a title for the report:", "RAG Analysis Report");
      if (!title || !title.trim()) return;

      // Sanitize the title into a clean filename (replace symbols with underscores)
      const sanitizedTitle = title.trim().replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
      const fileName = `${sanitizedTitle}_${Date.now()}.html`;
      
      const targetDir = window.activeBoardId === "board_root" ? window.currentProjectPath : path.join(window.currentProjectPath, window.activeBoardId);
      const filePath = path.join(targetDir, fileName);

      // Translate the markdown answer into HTML structure
      const parsedAnswer = window.controllers.markdown.parseMarkdown(window.lastRagAnswer);
      
      // Compile source file links list if any
      let sourcesHtml = "";
      if (window.lastRagSources && window.lastRagSources.length > 0) {
        sourcesHtml = `
        <div class="section">
          <div class="section-title">Context Sources Used</div>
          <ul class="sources">
            ${window.lastRagSources.map(src => `<li>${src}</li>`).join("")}
          </ul>
        </div>`;
      }

      // Self-contained styled HTML page template matching the TiddlyDesk style design tokens
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
    .sources {
      list-style-type: disc;
      padding-left: 1.5rem;
      color: #94a3b8;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated locally via TiddlyDesk RAG on ${new Date().toLocaleString()}</div>
  
  <div class="section">
    <div class="section-title">User Query</div>
    <div class="query">"${window.lastRagQuery}"</div>
  </div>
  
  <div class="section">
    <div class="section-title">AI Answer</div>
    <div class="answer">${parsedAnswer}</div>
  </div>
  
  ${sourcesHtml}
</body>
</html>`;

      try {
        // Write the finished HTML page directly to the project board folder on disk
        fs.writeFileSync(filePath, reportHtml, "utf8");
        
        // Reload cards inside the Kanban view. The saved report instantly shows up as a card!
        if (window.controllers && window.controllers.kanban) {
          window.controllers.kanban.loadWikis();
        }
        alert(`Report successfully saved to board as card: "${title}"`);
      } catch (err) {
        console.error("Failed to save report:", err);
        alert(`Failed to save report:\nError: ${err.message}`);
      }
    });
  }

  // ─── Step 5: Wire Up Semantic Search Toggle Changes ────────────────────────
  const semanticSearchToggle = document.getElementById("semanticSearchToggle");
  if (semanticSearchToggle) {
    semanticSearchToggle.addEventListener("change", () => {
      // Re-trigger visual cards loading. If the semantic checkbox is checked,
      // loadWikis() will automatically invoke vector scoring to sort columns.
      if (window.controllers && window.controllers.kanban) {
        window.controllers.kanban.loadWikis();
      }
    });
  }
}

module.exports = {
  initRag
};

