// dashboard.js – SPA for Workspaces, Project Dashboard, and Kanban Board
"use strict";

const projectService = require("../js/dashboard/project.service");
const agentService   = require("../js/dashboard/kaiban.service");

// ─── View helpers ────────────────────────────────────────────────────────────
function showView(id) {
  ["dashboardView", "wikiListView"].forEach(v => {
    document.getElementById(v).style.display = (v === id) ? "" : "none";
  });
}

// ─── State ───────────────────────────────────────────────────────────────────
let currentProjectPath = null;
let activeDragFilePath = null;
let activeBoardId = null;
let projectDirectoryWatcher = null;

// ─── Workspace View ──────────────────────────────────────────────────────────
function renderWorkspaces() {
  const tabsEl = document.getElementById("workspaceTabs");
  const activeId = projectService.getActiveWorkspaceId();
  const workspaces = projectService.listWorkspaces();

  // Clear tabs
  while (tabsEl.firstChild) tabsEl.removeChild(tabsEl.firstChild);

  workspaces.forEach(ws => {
    const tab = document.createElement("button");
    tab.className = "workspace-tab" + (ws.id === activeId ? " active" : "");
    tab.textContent = `${ws.name} (${ws.projectCount})`;
    tab.addEventListener("click", () => {
      projectService.setActiveWorkspaceId(ws.id);
      renderWorkspaces();
      if (window._dashboardRefresh) window._dashboardRefresh();
    });
    tabsEl.appendChild(tab);
  });
}

function initWorkspaces() {
  const barEl = document.getElementById("workspaceBar");
  const addBtn = document.getElementById("addWorkspaceBtn");
  const renameBtn = document.getElementById("renameWorkspaceBtn");
  const deleteBtn = document.getElementById("deleteWorkspaceBtn");

  barEl.style.display = "";

  addBtn.addEventListener("click", () => {
    const name = prompt("Enter new workspace name:");
    if (name && name.trim()) {
      try {
        projectService.addWorkspace(name.trim());
        renderWorkspaces();
        if (window._dashboardRefresh) window._dashboardRefresh();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  renameBtn.addEventListener("click", () => {
    const activeId = projectService.getActiveWorkspaceId();
    const currentName = projectService.listWorkspaces().find(w => w.id === activeId)?.name;
    const newName = prompt("Enter new workspace name:", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      try {
        projectService.renameWorkspace(activeId, newName.trim());
        renderWorkspaces();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  deleteBtn.addEventListener("click", () => {
    const activeId = projectService.getActiveWorkspaceId();
    if (activeId === "default") {
      alert("The Default Workspace cannot be deleted.");
      return;
    }
    const currentName = projectService.listWorkspaces().find(w => w.id === activeId)?.name;
    if (!confirm(`Are you sure you want to delete the workspace "${currentName}"? All project links inside it will be removed.`)) return;

    try {
      projectService.removeWorkspace(activeId);
      renderWorkspaces();
      if (window._dashboardRefresh) window._dashboardRefresh();
    } catch (err) {
      alert(err.message);
    }
  });

  renderWorkspaces();
}

// ─── Dashboard View ──────────────────────────────────────────────────────────
function initDashboard() {
  const folderListEl = document.getElementById("folderList");
  const addBtn = document.getElementById("addFolderBtn");
  const searchInput = document.getElementById("searchInput");
  const loader = document.getElementById("loader");

  // Update button text
  addBtn.textContent = "Add Project";

  function clearFolderList() {
    while (folderListEl.firstChild) folderListEl.removeChild(folderListEl.firstChild);
  }

  function showDashboardUI() {
    loader.style.display = "none";
    document.getElementById("projectActionBar").style.display = "flex";
    folderListEl.style.display = "";
  }

  function createFolderCard(project) {
    const card = document.createElement("div");
    card.className = "folder-card";
    card.style.cursor = "pointer";

    const nameSpan = document.createElement("span");
    nameSpan.className = "folder-name";
    nameSpan.textContent = project.name;

    const right = document.createElement("div");
    right.className = "badge-container";

    // Open directory on host file system (Reveal)
    const openFolderBtn = document.createElement("button");
    openFolderBtn.className = "btn open-btn";
    openFolderBtn.textContent = "Reveal";
    openFolderBtn.addEventListener("click", e => {
      e.stopPropagation();
      require("nw.gui").Shell.openItem(project.id);
    });

    // Remove project mapping
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn delete-btn";
    deleteBtn.textContent = "Remove";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (!confirm(`Remove the project reference "${project.name}" from this workspace? (No files will be deleted)`)) return;
      try {
        projectService.removeProject(project.id);
        loadAndRender();
        renderWorkspaces();
      } catch (err) {
        alert("Failed: " + err.message);
      }
    });

    right.appendChild(openFolderBtn);
    right.appendChild(deleteBtn);

    card.appendChild(nameSpan);
    card.appendChild(right);

    // Open project's Kanban board
    card.addEventListener("click", () => openWikiListView(project.id, project.name));
    return card;
  }

  function renderProjects(projects) {
    clearFolderList();
    if (projects.length === 0) {
      const empty = document.createElement("p");
      empty.style.textAlign = "center";
      empty.style.color = "var(--text-muted)";
      empty.textContent = "No projects linked yet. Click 'Add Project' to link an existing directory.";
      folderListEl.appendChild(empty);
      return;
    }
    projects.forEach(p => folderListEl.appendChild(createFolderCard(p)));
  }

  function loadAndRender() {
    try {
      const projects = projectService.listProjects();
      renderProjects(projects);
      showDashboardUI();
    } catch (e) {
      console.error("Failed to load projects", e);
      loader.textContent = "Error loading dashboard: " + e.message;
    }
  }

  // File picker popup to link folder
  addBtn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("nwdirectory", "nwdirectory");
    input.onchange = evt => {
      const folderPath = evt.target.value;
      if (!folderPath) return;
      try {
        projectService.addProject(folderPath);
        loadAndRender();
        renderWorkspaces();
      } catch (err) {
        alert("Failed to add project: " + err.message);
      }
    };
    input.click();
  });

  // Search filter
  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase();
    const filtered = projectService.listProjects().filter(p => p.name.toLowerCase().includes(term));
    renderProjects(filtered);
  });

  loadAndRender();

  // Refresh hook when returning to main view
  window._dashboardRefresh = () => {
    loadAndRender();
    renderWorkspaces();
  };
}

function setupProjectWatcher(projectPath) {
  const fs = require("fs");
  if (projectDirectoryWatcher) {
    try {
      projectDirectoryWatcher.close();
    } catch (e) {
      console.error("Failed to close watcher:", e);
    }
    projectDirectoryWatcher = null;
  }

  let debounceTimeout = null;
  try {
    projectDirectoryWatcher = fs.watch(projectPath, { recursive: true }, (eventType, filename) => {
      // Ignore hidden files like .tiddlydesk-meta.json or OS metadata like .DS_Store
      if (filename && (filename.startsWith(".") || filename.includes("/.") || filename.includes("\\."))) {
        return;
      }
      
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        console.log("Project directory changed, refreshing UI...");
        if (currentProjectPath) {
          const boards = projectService.listBoards(currentProjectPath);
          const boardExists = boards.some(b => b.id === activeBoardId);
          if (!boardExists) {
            activeBoardId = boards.length > 0 ? boards[0].id : "board_root";
          }
          renderBoardsSidebar();
          loadWikis();
        }
      }, 300);
    });
  } catch (err) {
    console.error("Failed to start directory watcher:", err);
  }
}

// ─── Kanban Board View ──────────────────────────────────────────────────────
function openWikiListView(projectPath, projectName) {
  currentProjectPath = projectPath;
  window.currentProjectPath = projectPath;

  const titleEl = document.getElementById("projectTitle");
  titleEl.textContent = `Project: ${projectName}`;

  // Load boards and default to the first one
  const boards = projectService.listBoards(currentProjectPath);
  if (boards.length > 0) {
    activeBoardId = boards[0].id;
    window.activeBoardId = boards[0].id;
  } else {
    activeBoardId = "board_root";
    window.activeBoardId = "board_root";
  }

  showView("wikiListView");
  renderBoardsSidebar();
  loadWikis();
  
  setupProjectWatcher(projectPath);

  // Clear basket when switching projects
  basketItems = [];
  renderBasket();
}

function renderBoardsSidebar() {
  const listEl = document.getElementById("boardList");
  const boards = projectService.listBoards(currentProjectPath);

  // Clear list
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  boards.forEach(b => {
    const li = document.createElement("li");
    li.className = "board-nav-item" + (b.id === activeBoardId ? " active" : "");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${b.name} (${b.reportCount})`;
    li.appendChild(nameSpan);

    // Switch board on click
    li.addEventListener("click", () => {
      activeBoardId = b.id;
      window.activeBoardId = b.id;
      renderBoardsSidebar();
      loadWikis();
    });

    listEl.appendChild(li);
  });

  // Update active board title in main area
  const activeBoard = boards.find(x => x.id === activeBoardId);
  document.getElementById("activeBoardTitle").textContent = activeBoard ? activeBoard.name : "Board";
}

function loadWikis() {
  const term = document.getElementById("searchWikis").value.toLowerCase();

  try {
    const wikis = projectService.listReportsByBoard(currentProjectPath, activeBoardId)
      .filter(w => w.name.toLowerCase().includes(term));

    renderKanbanBoard(wikis);
  } catch (e) {
    console.error("Failed to load reports:", e);
  }
}

function renderKanbanBoard(wikis) {
  const columns = {
    todo: { listEl: document.getElementById("list-todo"), countEl: document.getElementById("count-todo"), items: [] },
    progress: { listEl: document.getElementById("list-progress"), countEl: document.getElementById("count-progress"), items: [] },
    done: { listEl: document.getElementById("list-done"), countEl: document.getElementById("count-done"), items: [] }
  };

  // Group items by column status
  wikis.forEach(w => {
    const status = w.status || "todo";
    if (columns[status]) {
      columns[status].items.push(w);
    } else {
      columns.todo.items.push(w);
    }
  });

  // Clear and render each column list
  Object.keys(columns).forEach(status => {
    const col = columns[status];
    while (col.listEl.firstChild) col.listEl.removeChild(col.listEl.firstChild);

    col.countEl.textContent = col.items.length;

    if (col.items.length === 0) {
      const empty = document.createElement("div");
      empty.style.fontSize = "0.85rem";
      empty.style.color = "var(--text-muted)";
      empty.style.textAlign = "center";
      empty.style.padding = "1rem";
      empty.style.border = "1px dashed var(--border-color)";
      empty.style.borderRadius = "6px";
      empty.textContent = "Drop cards here";
      col.listEl.appendChild(empty);
    } else {
      col.items.forEach(w => {
        col.listEl.appendChild(createKanbanCard(w));
      });
    }
  });
}

function createKanbanCard(wiki) {
  const card = document.createElement("div");
  card.className = "wiki-card";
  card.draggable = true;

  // Title section
  const title = document.createElement("div");
  title.className = "wiki-card-title";
  title.textContent = wiki.name;
  card.appendChild(title);

  // Actions row
  const actions = document.createElement("div");
  actions.className = "wiki-card-actions";

  // Native Open Action
  const openBtn = document.createElement("button");
  openBtn.className = "btn";
  openBtn.style.background = "var(--primary-accent)";
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", () => {
    const tw = window.$tw || window._twGlobal?.$tw;
    if (tw?.desktop?.windowList) {
      tw.desktop.windowList.openByPathname(wiki.filePath);
    } else {
      // Fallback
      try {
        const bg = require("nw.gui").Window.get().window;
        if (bg.$tw?.desktop?.windowList) {
          bg.$tw.desktop.windowList.openByPathname(wiki.filePath);
        } else {
          alert("Could not locate TiddlyDesktop context.");
        }
      } catch (err) {
        alert("Error opening wiki: " + err.message);
      }
    }
  });

  // Native File Explorer Reveal Action
  const revealBtn = document.createElement("button");
  revealBtn.className = "btn open-btn";
  revealBtn.textContent = "Reveal";
  revealBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    try {
      require("nw.gui").Shell.showItemInFolder(wiki.filePath);
    } catch (err) {
      alert("Failed to show file: " + err.message);
    }
  });

  actions.appendChild(openBtn);
  actions.appendChild(revealBtn);
  card.appendChild(actions);

  // Drag listeners
  card.addEventListener("dragstart", (e) => {
    activeDragFilePath = wiki.filePath;
    card.classList.add("dragging");
    e.dataTransfer.setData("text/plain", wiki.filePath);
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    activeDragFilePath = null;
    // Clear drag-over borders in case dragleave didn't fire
    document.querySelectorAll(".kanban-column").forEach(col => col.classList.remove("drag-over"));
  });

  return card;
}

// ─── Agent Panel ─────────────────────────────────────────────────────────
let _agentRunning = false;
let _contextFilePath = null;
let basketItems = [];
let _selectedMultiFiles = [];

function addToBasket(filePath) {
  if (!filePath) return;
  if (basketItems.some(item => item.filePath === filePath)) return;

  const path = require("path");
  let name = path.basename(filePath);

  try {
    const reports = projectService.listReportsByBoard(currentProjectPath, activeBoardId);
    const found = reports.find(r => r.filePath === filePath);
    if (found) name = found.name;
  } catch (e) {}

  basketItems.push({ filePath, name });
  renderBasket();
}

function renderBasket() {
  const placeholder = document.getElementById("basketPlaceholder");
  const itemList = document.getElementById("basketItemList");
  const runBtn = document.getElementById("analyseBasketBtn");

  while (itemList.firstChild) itemList.removeChild(itemList.firstChild);

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
      itemList.appendChild(li);
    });
  }
}

// Removed openAgentPanelMultiple

function getSkillParams(skillKey) {
  const params = {};
  const path = require("path");

  if (_selectedMultiFiles.length > 0) {
    const defaultBoardPath = path.dirname(_selectedMultiFiles[0]);
    params.boardPath = defaultBoardPath;

    if (skillKey === "plan_comparison") {
      params.planAPath = _selectedMultiFiles[0] || "";
      params.planBPath = _selectedMultiFiles[1] || "";
      params.outputName = "Plan_Comparison_Report.html";
    } else if (skillKey === "valuation_reconciliation") {
      params.valuation1Path = _selectedMultiFiles[0] || "";
      params.valuation2Path = _selectedMultiFiles[1] || "";
      params.planPath = _selectedMultiFiles[2] || "";
      params.outputName = "Valuation_Reconciliation_Report.html";
    } else if (skillKey === "investor_fit") {
      params.reportPath = _selectedMultiFiles[0] || "";
      params.cdReportPath = _selectedMultiFiles[1] || "";
      params.outputName = "Investor_Fit_Analysis.html";
    } else if (skillKey === "section_29a") {
      params.reportPath = _selectedMultiFiles[0] || "";
      params.outputName = "Section_29A_Eligibility_Report.html";
    } else if (skillKey === "statutory_plan_audit") {
      params.reportPath = _selectedMultiFiles[0] || "";
      params.outputName = "Statutory_Plan_Audit_Report.html";
    } else if (skillKey === "demo_kaiban") {
      params.outputName = "KaibanJS_Demo_Report.html";
    }
  }

  params.model = (document.getElementById("agentModelInput")?.value || "hermes3").trim();
  return params;
}

function appendAgentLog(message) {
  const logEl = document.getElementById("agentLog");
  const line = document.createElement("div");

  // Colour-code by prefix
  if (message.includes("\u2705") || message.includes("\u2714") || message.toLowerCase().includes("success")) {
    line.className = "log-success";
  } else if (message.includes("\u26A0") || message.toLowerCase().includes("error")) {
    line.className = "log-error";
  } else if (message.includes("\uD83D\uDD27")) {
    line.className = "log-tool";
  } else if (message.includes("\uD83D\uDE80") || message.includes("\uD83D\uDCE1") || message.includes("\uD83D\uDD04")) {
    line.className = "log-info";
  }
  line.textContent = message;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}



// ─── Drag and Drop ────────────────────────────────────────────────────────────
function initDragAndDrop() {
  const columnIds = ["col-todo", "col-progress", "col-done"];

  columnIds.forEach(id => {
    const col = document.getElementById(id);
    const status = id.replace("col-", "");

    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });

    col.addEventListener("dragenter", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });

    col.addEventListener("dragleave", () => {
      col.classList.remove("drag-over");
    });

    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");

      const filePath = e.dataTransfer.getData("text/plain") || activeDragFilePath;
      if (filePath && currentProjectPath && activeBoardId) {
        try {
          projectService.updateReportStatusInBoard(currentProjectPath, activeBoardId, filePath, status);
          loadWikis();
        } catch (err) {
          console.error("Failed to update status on drop:", err);
        }
      }
    });
  });
}

function initBasket() {
  const basket = document.getElementById("analyseBasket");
  const clearBtn = document.getElementById("clearBasketBtn");
  const runBtn = document.getElementById("analyseBasketBtn");

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

    const filePath = e.dataTransfer.getData("text/plain") || activeDragFilePath;
    if (filePath) {
      addToBasket(filePath);
    }
  });

  clearBtn.addEventListener("click", () => {
    basketItems = [];
    renderBasket();
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

    const path = require("path");
    const fs = require("fs");

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
        // Remove active styling from other buttons
        modalFileList.querySelectorAll("button").forEach(btn => {
          btn.style.borderColor = "var(--border-color)";
          btn.style.background = "rgba(255,255,255,0.03)";
        });
        // Highlight this button
        fileBtn.style.borderColor = "var(--text-muted)";
        fileBtn.style.background = "rgba(255, 255, 255, 0.1)";

        // Read and preview the tiddler content!
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

  // Setup infinite scroll listener
  if (modalFileList) {
    modalFileList.addEventListener("scroll", () => {
      if (modalFileList.scrollTop + modalFileList.clientHeight >= modalFileList.scrollHeight - 30) {
        if (loadedCount < filteredFiles.length) {
          renderNextChunk();
        }
      }
    });
  }

  // Setup live search query filtering
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

    // Open modal
    if (logModal) {
      logModal.style.display = "flex";
    }

    // Reset fields
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

    const path = require("path");
    const fs = require("fs");
    let allExtractedFolders = [];

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

    // Build the allFiles list in memory
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

    // Reset list state and search input values
    if (searchInput) {
      searchInput.value = "";
    }
    if (modalFileList) {
      modalFileList.innerHTML = "";
    }
    filteredFiles = allFiles;
    loadedCount = 0;
    lastHeaderRendered = null;

    // Load initial chunk
    renderNextChunk();
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
// ─── Boot ────────────────────────────────────────────────────────────────────
function boot() {
  window.projectService = projectService;
  window.currentProjectPath = currentProjectPath;
  window.activeBoardId = activeBoardId;
  window._loadWikis = loadWikis;

  showView("dashboardView");
  initWorkspaces();
  initDashboard();
  initDragAndDrop();

  initBasket();

  const searchWikis = document.getElementById("searchWikis");
  const backBtn = document.getElementById("backBtn");

  // Filter cards on input
  searchWikis.addEventListener("input", () => {
    loadWikis();
  });

  // Back navigation
  backBtn.addEventListener("click", () => {
    if (projectDirectoryWatcher) {
      try {
        projectDirectoryWatcher.close();
      } catch (e) {}
      projectDirectoryWatcher = null;
    }
    currentProjectPath = null;
    window.currentProjectPath = null;
    activeBoardId = null;
    window.activeBoardId = null;
    basketItems = [];
    renderBasket();
    showView("dashboardView");
    if (window._dashboardRefresh) window._dashboardRefresh();
  });

  // Refresh button
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (currentProjectPath) {
        const boards = projectService.listBoards(currentProjectPath);
        const boardExists = boards.some(b => b.id === activeBoardId);
        if (!boardExists) {
          activeBoardId = boards.length > 0 ? boards[0].id : "board_root";
        }
        renderBoardsSidebar();
        loadWikis();
      }
    });
  }

  // Agent Demo (Playground) button
  const agentDemoBtn = document.getElementById("agentDemoBtn");
  if (agentDemoBtn) {
    agentDemoBtn.addEventListener("click", () => {
      try {
        const gui = require("nw.gui");
        gui.Window.open("html/kaiban-playground.html", {
          id: "kaiban-playground-window",
          show: true,
          width: 1200,
          height: 850,
          position: "center",
          focus: true,
          icon: "images/app-icon.png"
        }, function (win) {
          // Pass project info to new window for saving files
          win.window.currentProjectPath = currentProjectPath;
          win.window.activeBoardId = activeBoardId;
          win.window.projectService = projectService;
          if (window._loadWikis) {
            win.window._parentLoadWikis = window._loadWikis;
          }
        });
      } catch (err) {
        alert("Failed to open Agent Demo Playground: " + err.message);
      }
    });
  }

  // Settings dropdown toggle
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsDropdown = document.getElementById("settingsDropdown");
  if (settingsBtn && settingsDropdown) {
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDropdown.style.display = (settingsDropdown.style.display === "none" || settingsDropdown.style.display === "") ? "flex" : "none";
    });

    // Close settings dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!settingsBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
        settingsDropdown.style.display = "none";
      }
    });
  }

  // About Modal trigger
  const aboutBtn = document.getElementById("aboutBtn");
  const aboutModal = document.getElementById("aboutModal");
  const closeAboutBtn = document.getElementById("closeAboutBtn");

  if (aboutBtn && aboutModal && closeAboutBtn) {
    aboutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (settingsDropdown) settingsDropdown.style.display = "none";
      aboutModal.style.display = "flex";
    });

    closeAboutBtn.addEventListener("click", () => {
      aboutModal.style.display = "none";
    });

    // Close modal when clicking outside the modal content card
    aboutModal.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.style.display = "none";
      }
    });
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
