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

  // AI Analyse Button
  const analyseBtn = document.createElement("button");
  analyseBtn.className = "btn analyse-btn";
  analyseBtn.textContent = "\uD83E\uDD16 Analyse";
  analyseBtn.title = "Run an IBC agentic analysis on this report";
  analyseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openAgentPanel(wiki.filePath, wiki.name);
  });

  actions.appendChild(openBtn);
  actions.appendChild(revealBtn);
  actions.appendChild(analyseBtn);
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

function openAgentPanelMultiple(items) {
  _selectedMultiFiles = items.map(x => x.filePath);
  _contextFilePath = null;
  const overlay = document.getElementById("agentPanelOverlay");
  overlay.style.display = "flex";

  // Reset state
  _agentRunning = false;
  document.getElementById("agentRunBtn").disabled = false;
  document.getElementById("agentRunBtn").textContent = "▶ Run Analysis";
  document.getElementById("agentProgressArea").classList.remove("visible");
  document.getElementById("agentLog").innerHTML = "";
  document.getElementById("agentProgressFill").style.width = "0%";
  const banner = document.getElementById("agentResultBanner");
  banner.className = "agent-result-banner";
  banner.textContent = "";

  // Show multi-file container, hide single input fields
  document.getElementById("agentMultiFileContainer").style.display = "flex";
  document.getElementById("agentInputFields").style.display = "none";

  // Render selected files
  const listEl = document.getElementById("agentSelectedFilesList");
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "selected-file-item";
    div.textContent = item.name;
    div.title = item.filePath;
    listEl.appendChild(div);
  });
}

// Skill configurations: what input fields to show for each skill
const SKILL_INPUTS = {
  section_29a: [
    { id: "ap_reportPath",  label: "Report Path (Resolution Plan / Applicant Profile)", placeholder: "e.g. /path/to/ResolutionPlan.html", key: "reportPath" },
    { id: "ap_boardPath",   label: "Output Board Directory",                            placeholder: "e.g. /path/to/project/Verification",   key: "boardPath" },
    { id: "ap_outputName", label: "Output Filename",                                   placeholder: "Section_29A_Report.html",               key: "outputName" }
  ],
  statutory_plan_audit: [
    { id: "sp_reportPath",  label: "Resolution Plan Path",     placeholder: "e.g. /path/to/ResolutionPlan.html", key: "reportPath" },
    { id: "sp_boardPath",   label: "Output Board Directory",   placeholder: "e.g. /path/to/project/Audit",      key: "boardPath" },
    { id: "sp_outputName", label: "Output Filename",          placeholder: "Plan_Audit_Report.html",           key: "outputName" }
  ],
  valuation_reconciliation: [
    { id: "vr_val1Path",    label: "Valuer 1 Report Path",  placeholder: "e.g. /path/to/Valuation_1.html",   key: "valuation1Path" },
    { id: "vr_val2Path",    label: "Valuer 2 Report Path",  placeholder: "e.g. /path/to/Valuation_2.html",   key: "valuation2Path" },
    { id: "vr_planPath",   label: "Resolution Plan Path (optional)", placeholder: "e.g. /path/to/Plan.html",key: "planPath" },
    { id: "vr_boardPath",  label: "Output Board Directory",           placeholder: "e.g. /path/to/project",  key: "boardPath" },
    { id: "vr_outputName", label: "Output Filename",                  placeholder: "Valuation_Recon.html",   key: "outputName" }
  ],
  investor_fit: [
    { id: "if_reportPath",  label: "Investor Profile / Resolution Plan Path", placeholder: "e.g. /path/to/InvestorProfile.html", key: "reportPath" },
    { id: "if_cdPath",      label: "Corporate Debtor Report (optional)",      placeholder: "e.g. /path/to/CD_Report.html",       key: "cdReportPath" },
    { id: "if_boardPath",  label: "Output Board Directory",                   placeholder: "e.g. /path/to/project",              key: "boardPath" },
    { id: "if_outputName", label: "Output Filename",                          placeholder: "Investor_Fit.html",                  key: "outputName" }
  ],
  plan_comparison: [
    { id: "pc_planAPath",  label: "Resolution Plan A Path",  placeholder: "e.g. /path/to/Plan_A.html", key: "planAPath" },
    { id: "pc_planBPath",  label: "Resolution Plan B Path",  placeholder: "e.g. /path/to/Plan_B.html", key: "planBPath" },
    { id: "pc_boardPath",  label: "Output Board Directory",  placeholder: "e.g. /path/to/project",     key: "boardPath" },
    { id: "pc_outputName", label: "Output Filename",         placeholder: "Plan_Comparison.html",      key: "outputName" }
  ],
  demo_kaiban: [
    { id: "dk_boardPath",  label: "Output Board Directory",  placeholder: "e.g. /path/to/project",     key: "boardPath" },
    { id: "dk_outputName", label: "Output Filename",         placeholder: "KaibanJS_Demo_Report.html",  key: "outputName" }
  ]
};

function openAgentPanel(preFilledPath, reportName) {
  _contextFilePath = preFilledPath || null;
  _selectedMultiFiles = [];
  const overlay = document.getElementById("agentPanelOverlay");
  overlay.style.display = "flex";

  // Reset state
  _agentRunning = false;
  document.getElementById("agentRunBtn").disabled = false;
  document.getElementById("agentRunBtn").textContent = "\u25B6 Run Analysis";
  document.getElementById("agentProgressArea").classList.remove("visible");
  document.getElementById("agentLog").innerHTML = "";
  document.getElementById("agentProgressFill").style.width = "0%";
  const banner = document.getElementById("agentResultBanner");
  banner.className = "agent-result-banner";
  banner.textContent = "";

  // Show single input fields, hide multi-file list
  document.getElementById("agentMultiFileContainer").style.display = "none";
  document.getElementById("agentInputFields").style.display = "flex";

  // Pre-fill first reportPath field with the card's file path
  const selectedSkill = document.querySelector(".skill-btn.selected")?.dataset?.skill || "section_29a";
  renderSkillInputs(selectedSkill, preFilledPath);

  // If no board path set yet, default to the card's directory
  if (preFilledPath) {
    const path = require("path");
    const boardPathInputs = document.querySelectorAll("[id$='_boardPath']");
    boardPathInputs.forEach(inp => {
      if (!inp.value) inp.value = path.dirname(preFilledPath);
    });
  }
}

function renderSkillInputs(skillKey, preFilledPath) {
  const container = document.getElementById("agentInputFields");
  while (container.firstChild) container.removeChild(container.firstChild);

  const fields = SKILL_INPUTS[skillKey] || [];
  const path = require("path");

  fields.forEach((field, idx) => {
    const group = document.createElement("div");
    group.className = "agent-field-group";

    const label = document.createElement("label");
    label.textContent = field.label;
    label.setAttribute("for", field.id);

    const input = document.createElement("input");
    input.type = "text";
    input.id   = field.id;
    input.placeholder = field.placeholder;

    // Pre-fill primary path and output dir
    if (preFilledPath) {
      if (idx === 0) input.value = preFilledPath;
      if (field.key === "boardPath") input.value = path.dirname(preFilledPath);
    }

    group.appendChild(label);
    group.appendChild(input);
    container.appendChild(group);
  });
}

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
  } else {
    const fields = SKILL_INPUTS[skillKey] || [];
    fields.forEach(field => {
      const val = (document.getElementById(field.id)?.value || "").trim();
      if (val) params[field.key] = val;
    });
    if (skillKey === "demo_kaiban" && !params.outputName) {
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

// Live Agent Task Kanban Board UI Helper Functions
function initAgentKanbanBoard(tasksData) {
  const todoList = document.getElementById("ak-list-todo");
  const doingList = document.getElementById("ak-list-doing");
  const doneList = document.getElementById("ak-list-done");

  // Clear existing cards
  [todoList, doingList, doneList].forEach(el => {
    if (el) {
      while (el.firstChild) el.removeChild(el.firstChild);
    }
  });

  tasksData.forEach(task => {
    const card = document.createElement("div");
    card.className = "agent-task-card";
    card.id = `ak-task-${task.id}`;

    const title = document.createElement("div");
    title.className = "agent-task-title";
    title.textContent = task.title;

    const assignee = document.createElement("div");
    assignee.className = "agent-task-assignee";
    assignee.textContent = `🤖 ${task.agentName}`;

    card.appendChild(title);
    card.appendChild(assignee);
    if (todoList) {
      todoList.appendChild(card);
    }
  });
}

function updateAgentTaskStatus(taskData) {
  const card = document.getElementById(`ak-task-${taskData.id}`);
  if (!card) return;

  // Remove card from its current parent
  if (card.parentNode) {
    card.parentNode.removeChild(card);
  }

  // Reset classes
  card.className = "agent-task-card";

  let targetList;
  if (taskData.status === "TODO") {
    targetList = document.getElementById("ak-list-todo");
  } else if (taskData.status === "DOING") {
    targetList = document.getElementById("ak-list-doing");
    card.classList.add("doing");
  } else if (taskData.status === "DONE" || taskData.status === "COMPLETED") {
    targetList = document.getElementById("ak-list-done");
    card.classList.add("done");
  }

  if (targetList) {
    targetList.appendChild(card);
  }
}

function initAgentPanel() {
  const overlay   = document.getElementById("agentPanelOverlay");
  const closeBtn  = document.getElementById("closeAgentPanelBtn");
  const runBtn    = document.getElementById("agentRunBtn");
  const skillBtns = document.querySelectorAll(".skill-btn");

  // Close panel
  closeBtn.addEventListener("click", () => {
    if (_agentRunning) {
      if (!confirm("An analysis is running. Close anyway?")) return;
    }
    overlay.style.display = "none";
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeBtn.click();
  });

  // Skill selection
  skillBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      skillBtns.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      const skill = btn.dataset.skill;
      if (_selectedMultiFiles.length > 0) {
        document.getElementById("agentMultiFileContainer").style.display = "flex";
        document.getElementById("agentInputFields").style.display = "none";
      } else {
        renderSkillInputs(skill, _contextFilePath);
        document.getElementById("agentMultiFileContainer").style.display = "none";
        document.getElementById("agentInputFields").style.display = "flex";
      }
    });
  });

  // Run agent
  runBtn.addEventListener("click", async () => {
    if (_agentRunning) return;

    const selectedBtn = document.querySelector(".skill-btn.selected");
    const skillKey    = selectedBtn?.dataset?.skill;
    if (!skillKey) { alert("Please select a skill."); return; }

    const params = getSkillParams(skillKey);

    // Validate required params
    if (_selectedMultiFiles.length > 0) {
      if (_selectedMultiFiles.length === 0) {
        alert("Please select at least one file to analyse.");
        return;
      }
    } else {
      const fields  = SKILL_INPUTS[skillKey] || [];
      const missing = fields.filter(f => !f.key.includes("optional") && !f.label.toLowerCase().includes("optional") && !params[f.key]);
      if (skillKey === "demo_kaiban") {
        if (!params.boardPath) {
          alert("Please specify an Output Board Directory.");
          return;
        }
      } else {
        if (missing.length > 0 && (params.reportPath || params.planAPath || params.valuation1Path)) {
          // OK – at least primary path is provided
        } else if (!params.reportPath && !params.planAPath && !params.valuation1Path) {
          alert("Please fill in at least the primary report path.");
          return;
        }
      }
    }
    if (!params.boardPath) {
      alert("Please specify an Output Board Directory.");
      return;
    }

    // Check Ollama
    const progressArea = document.getElementById("agentProgressArea");
    const progressFill = document.getElementById("agentProgressFill");
    const banner       = document.getElementById("agentResultBanner");
    const logEl        = document.getElementById("agentLog");

    progressArea.classList.add("visible");
    banner.className = "agent-result-banner";
    banner.textContent = "";
    logEl.innerHTML = "";
    progressFill.style.width = "5%";

    appendAgentLog("\uD83D\uDD0D Checking Ollama connection...");

    const health = await agentService.checkOllamaHealth();
    if (!health.ok) {
      appendAgentLog("\u26A0\uFE0F  Ollama not reachable: " + health.error);
      appendAgentLog("  Tip: run \"ollama serve\" and \"ollama run " + params.model + "\" in Terminal first.");
      banner.className = "agent-result-banner error";
      banner.textContent = "\u274C Ollama not running — start Ollama first";
      return;
    }

    appendAgentLog("\u2705 Ollama connected. Models: " + health.models.join(", "));

    _agentRunning = true;
    runBtn.disabled = true;
    runBtn.textContent = "\u23F3 Running...";

    try {
      const result = await agentService.runSkill(
        skillKey,
        params,
        (msg) => appendAgentLog(msg),
        (pct) => { progressFill.style.width = Math.round(pct * 100) + "%"; },
        (tasksData) => initAgentKanbanBoard(tasksData),
        (taskData) => updateAgentTaskStatus(taskData)
      );

      if (result.success) {
        appendAgentLog("\n\u2705 Analysis complete! (" + result.turns + " reasoning turns)");
        if (result.outputFile) {
          appendAgentLog("\uD83D\uDCC4 Output: " + result.outputFile);
          banner.className = "agent-result-banner success";
          banner.innerHTML = "\u2705 Report saved &mdash; <strong>" + require("path").basename(result.outputFile) + "</strong>";
        } else if (result.textResponse) {
          appendAgentLog("\uD83D\uDCAC " + result.textResponse.slice(0, 200));
          banner.className = "agent-result-banner success";
          banner.textContent = "\u2705 Analysis complete (no file written — check log)";
        }
        // Refresh board to show new card
        if (currentProjectPath && activeBoardId) {
          setTimeout(() => loadWikis(), 800);
        }
      } else {
        appendAgentLog("\n\u274C Agent failed: " + (result.error || "Unknown error"));
        banner.className = "agent-result-banner error";
        banner.textContent = "\u274C " + (result.error || "Analysis failed");
      }
    } catch (err) {
      appendAgentLog("\u274C Unexpected error: " + err.message);
      banner.className = "agent-result-banner error";
      banner.textContent = "\u274C Error: " + err.message;
    } finally {
      _agentRunning = false;
      runBtn.disabled = false;
      runBtn.textContent = "\u25B6 Run Analysis";
      progressFill.style.width = "100%";
    }
  });
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

  runBtn.addEventListener("click", () => {
    if (basketItems.length === 0) return;
    openAgentPanelMultiple(basketItems);
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
  initAgentPanel();
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
