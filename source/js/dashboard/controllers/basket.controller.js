// basket.controller.js - Management of the Analyse Basket dropzone and extraction logic
"use strict";

const path = require("path");
const fs = require("fs");
const projectService = require("../services/project.service");

let basketItems = [];

function addToBasket(filePath) {
  if (!filePath) return;
  if (basketItems.some(item => item.filePath === filePath)) return;

  let name = path.basename(filePath);

  try {
    if (window.currentProjectPath && window.activeBoardId) {
      const reports = projectService.listReportsByBoard(window.currentProjectPath, window.activeBoardId);
      const found = reports.find(r => r.filePath === filePath);
      if (found) name = found.name;
    }
  } catch (e) {}

  basketItems.push({ filePath, name });
  renderBasket();
}

function clearBasket() {
  basketItems = [];
  renderBasket();
}

function renderBasket() {
  const placeholder = document.getElementById("basketPlaceholder");
  const itemList = document.getElementById("basketItemList");
  const runBtn = document.getElementById("analyseBasketBtn");

  if (!placeholder || !itemList || !runBtn) return;

  while (itemList.firstChild) {
    itemList.removeChild(itemList.firstChild);
  }

  if (basketItems.length === 0) {
    placeholder.style.display = "block";
    itemList.style.display = "none";
    runBtn.style.display = "none";
    runBtn.textContent = "🤖 Analyse Basket (0)";
  } else {
    placeholder.style.display = "none";
    itemList.style.display = "flex";
    runBtn.style.display = "block";
    runBtn.textContent = `🤖 Analyse Basket (${basketItems.length})`;

    basketItems.forEach(item => {
      const li = document.createElement("li");
      li.className = "basket-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "basket-item-name";
      nameSpan.textContent = item.name;
      nameSpan.title = item.filePath;

      const removeBtn = document.createElement("button");
      removeBtn.className = "basket-item-remove";
      removeBtn.innerHTML = "✕";
      removeBtn.title = "Remove from basket";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        basketItems = basketItems.filter(x => x.filePath !== item.filePath);
        renderBasket();
      });

      li.appendChild(nameSpan);
      li.appendChild(removeBtn);
      li.appendChild(removeBtn);
      itemList.appendChild(li);
    });
  }
}

function initBasket() {
  const basket = document.getElementById("analyseBasket");
  const clearBtn = document.getElementById("clearBasketBtn");
  const runBtn = document.getElementById("analyseBasketBtn");

  if (!basket || !clearBtn || !runBtn) return;

  basket.addEventListener("dragover", (e) => {
    e.preventDefault();
    basket.classList.add("drag-over");
  });

  basket.addEventListener("dragenter", (e) => {
    e.preventDefault();
    basket.classList.add("drag-over");
  });

  basket.addEventListener("dragleave", () => {
    basket.classList.remove("drag-over");
  });

  basket.addEventListener("drop", (e) => {
    e.preventDefault();
    basket.classList.remove("drag-over");

    const activeDragFilePath = window.activeDragFilePath;
    const filePath = e.dataTransfer.getData("text/plain") || activeDragFilePath;
    if (filePath) {
      addToBasket(filePath);
    }
  });

  clearBtn.addEventListener("click", () => {
    clearBasket();
  });

  // Modal DOM elements
  const logModal = document.getElementById("logModalOverlay");
  const closeLogModalBtn = document.getElementById("closeLogModalBtn");
  const toggleLogPaneBtn = document.getElementById("toggleLogPaneBtn");
  const modalLogPane = document.getElementById("modalLogPane");
  const modalLogArea = document.getElementById("modalLogArea");
  const modalFileList = document.getElementById("modalFileList");
  const modalCodePreview = document.getElementById("modalCodePreview");
  const searchInput = document.getElementById("modalFileSearch");

  // Close log modal
  if (closeLogModalBtn && logModal) {
    closeLogModalBtn.addEventListener("click", () => {
      logModal.style.display = "none";
    });
    logModal.addEventListener("click", (e) => {
      if (e.target === logModal) {
        logModal.style.display = "none";
      }
    });
  }

  // Toggle log pane visibility
  if (toggleLogPaneBtn && modalLogPane) {
    toggleLogPaneBtn.addEventListener("click", () => {
      if (modalLogPane.style.display === "none") {
        modalLogPane.style.display = "flex";
        toggleLogPaneBtn.textContent = "Hide Logs";
      } else {
        modalLogPane.style.display = "none";
        toggleLogPaneBtn.textContent = "Show Logs";
      }
    });
  }

  // Shared Closure States for Explorer Pagination & Filtering
  let allFiles = [];
  let filteredFiles = [];
  let loadedCount = 0;
  let lastHeaderRendered = null;
  const PAGE_SIZE = 50;

  const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

  function renderNextChunk() {
    if (!modalFileList) return;
    const chunk = filteredFiles.slice(loadedCount, loadedCount + PAGE_SIZE);
    
    if (chunk.length === 0 && loadedCount === 0) {
      modalFileList.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 1rem;">No tiddlers match filter</span>';
      return;
    }

    chunk.forEach(item => {
      if (item.folderName !== lastHeaderRendered) {
        lastHeaderRendered = item.folderName;
        const folderLabel = document.createElement("div");
        folderLabel.style.fontSize = "0.72rem";
        folderLabel.style.fontWeight = "normal";
        folderLabel.style.color = "var(--text-muted)";
        folderLabel.style.marginTop = "0.4rem";
        folderLabel.style.marginBottom = "0.2rem";
        folderLabel.style.flexShrink = "0";
        folderLabel.textContent = item.folderName;
        modalFileList.appendChild(folderLabel);
      }

      const fileBtn = document.createElement("button");
      fileBtn.style.background = "rgba(255,255,255,0.03)";
      fileBtn.style.border = "1px solid var(--border-color)";
      fileBtn.style.borderRadius = "4px";
      fileBtn.style.padding = "0.25rem 0.4rem";
      fileBtn.style.textAlign = "left";
      fileBtn.style.color = "var(--text-color)";
      fileBtn.style.fontSize = "0.7rem";
      fileBtn.style.cursor = "pointer";
      fileBtn.style.overflow = "hidden";
      fileBtn.style.textOverflow = "ellipsis";
      fileBtn.style.whiteSpace = "nowrap";
      fileBtn.style.width = "100%";
      fileBtn.style.flexShrink = "0";
      fileBtn.textContent = item.name;
      fileBtn.title = item.name;

      fileBtn.addEventListener("click", () => {
        modalFileList.querySelectorAll("button").forEach(btn => {
          btn.style.borderColor = "var(--border-color)";
          btn.style.background = "rgba(255,255,255,0.03)";
        });
        fileBtn.style.borderColor = "var(--text-muted)";
        fileBtn.style.background = "rgba(255, 255, 255, 0.1)";

        try {
          const content = fs.readFileSync(item.filePath, "utf8");
          if (modalCodePreview) {
            modalCodePreview.textContent = content;
          }
        } catch (readErr) {
          if (modalCodePreview) {
            modalCodePreview.textContent = `Error reading file:\n${readErr.message}`;
          }
        }
      });

      modalFileList.appendChild(fileBtn);
    });

    loadedCount += chunk.length;
  }

  if (modalFileList) {
    modalFileList.addEventListener("scroll", () => {
      if (modalFileList.scrollTop + modalFileList.clientHeight >= modalFileList.scrollHeight - 30) {
        if (loadedCount < filteredFiles.length) {
          renderNextChunk();
        }
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      if (query === "") {
        filteredFiles = allFiles;
      } else {
        filteredFiles = allFiles.filter(f => f.name.toLowerCase().includes(query));
      }
      modalFileList.innerHTML = "";
      loadedCount = 0;
      lastHeaderRendered = null;
      renderNextChunk();
    });
  }

  runBtn.addEventListener("click", async () => {
    if (basketItems.length === 0) return;

    if (logModal) {
      logModal.style.display = "flex";
    }

    if (modalLogArea) {
      modalLogArea.innerHTML = "";
    }
    if (modalFileList) {
      modalFileList.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">Extracting files...</span>';
    }
    if (modalCodePreview) {
      modalCodePreview.textContent = "";
    }

    async function addLogLine(text) {
      if (!modalLogArea) return;
      const line = document.createElement("div");
      line.className = "basket-log-line";
      line.style.color = "var(--text-color)";
      line.textContent = text;
      modalLogArea.appendChild(line);
      modalLogArea.scrollTop = modalLogArea.scrollHeight;
      await yieldToMain();
    }

    await addLogLine("Starting .tid extraction from basket...");
    await addLogLine(`Found ${basketItems.length} items in the analysis basket.`);

    let allExtractedFolders = [];
    const agentService = require("../services/kaiban.service");

    for (const item of basketItems) {
      const fileName = path.basename(item.filePath);
      const filePath = item.filePath;
      await addLogLine(`----------------------------------------`);
      await addLogLine(`Processing item: "${fileName}"`);
      await addLogLine(`Full path: "${filePath}"`);
      
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error("File or directory path does not exist on disk.");
        }
        
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          await addLogLine(`[Inspector] Path type: Directory`);
          const tiddlersDir = path.join(filePath, "tiddlers");
          await addLogLine(`[Inspector] Target tiddlers directory path: "${tiddlersDir}"`);
          if (fs.existsSync(tiddlersDir)) {
            await addLogLine(`[Inspector] Tiddlers directory exists. Scanning directory contents...`);
            const files = fs.readdirSync(tiddlersDir).filter(f => /\.(tid|txt|md)$/.test(f));
            await addLogLine(`[Inspector] Detected ${files.length} .tid/.txt/.md files inside.`);
          } else {
            await addLogLine(`[Inspector] Warning: "tiddlers" subdirectory was not found under this directory.`);
          }
        } else {
          await addLogLine(`[Inspector] Path type: File`);
          await addLogLine(`[Inspector] File size: ${stat.size} bytes`);
          const ext = path.extname(filePath).toLowerCase();
          await addLogLine(`[Inspector] File extension: "${ext}"`);
        }

        await yieldToMain();
        const res = agentService.extractWikiToFolder(filePath);
        await addLogLine(`[Success] Processed ${res.count} tiddlers.`);
        await addLogLine(`[Success] Tiddlers source directory: "${res.targetDir}"`);
        allExtractedFolders.push(res.targetDir);
      } catch (err) {
        await addLogLine(`[Error] Failed to process ${fileName}: ${err.message}`);
        console.error("Extraction error:", err);
      }
      await yieldToMain();
    }

    await addLogLine(`----------------------------------------`);
    await addLogLine("Extraction finished!");

    allFiles = [];
    for (const folderPath of allExtractedFolders) {
      const tiddlersDir = path.join(folderPath, "tiddlers");
      if (fs.existsSync(tiddlersDir)) {
        try {
          const files = fs.readdirSync(tiddlersDir).filter(f => /\.(tid|txt|md)$/.test(f));
          const folderName = path.basename(folderPath).replace(/\.wiki$/i, "");
          files.forEach(file => {
            allFiles.push({
              name: file,
              folderName: folderName,
              filePath: path.join(tiddlersDir, file)
            });
          });
        } catch (e) {
          await addLogLine(`[Error] Failed to read tiddlers: ${e.message}`);
        }
      }
      await yieldToMain();
    }

    if (searchInput) {
      searchInput.value = "";
    }
    if (modalFileList) {
      modalFileList.innerHTML = "";
    }
    filteredFiles = allFiles;
    loadedCount = 0;
    lastHeaderRendered = null;

    renderNextChunk();
  });
}

module.exports = {
  addToBasket,
  clearBasket,
  renderBasket,
  initBasket,
  get basketItems() { return basketItems; }
};
