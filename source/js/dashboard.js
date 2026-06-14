// dashboard.js – SPA for Workspaces, Project Dashboard, and Kanban Board
"use strict";

const projectService = require("../js/dashboard/project.service");

// ─── View helpers ────────────────────────────────────────────────────────────
function showView(id) {
  ["dashboardView", "wikiListView"].forEach(v => {
    document.getElementById(v).style.display = (v === id) ? "" : "none";
  });
}

// ─── State ───────────────────────────────────────────────────────────────────
let currentProjectPath = null;
let activeDragFilePath = null;

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
  const folderListEl  = document.getElementById("folderList");
  const addBtn        = document.getElementById("addFolderBtn");
  const searchInput   = document.getElementById("searchInput");
  const loader        = document.getElementById("loader");

  // Update button text
  addBtn.textContent = "Add Project";

  function clearFolderList() {
    while (folderListEl.firstChild) folderListEl.removeChild(folderListEl.firstChild);
  }

  function showDashboardUI() {
    loader.style.display    = "none";
    addBtn.style.display    = "";
    searchInput.style.display = "";
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

    const countSpan = document.createElement("span");
    countSpan.className = "wiki-count";
    countSpan.textContent = `${project.wikiCount} wikis`;

    // Rename project
    const renameProjBtn = document.createElement("button");
    renameProjBtn.className = "btn rename-btn";
    renameProjBtn.textContent = "Rename";
    renameProjBtn.addEventListener("click", e => {
      e.stopPropagation();
      const newName = prompt("Enter new project name:", project.name);
      if (newName && newName.trim() && newName.trim() !== project.name) {
        try {
          projectService.renameProject(project.id, newName.trim());
          loadAndRender();
          renderWorkspaces();
        } catch (err) {
          alert(err.message);
        }
      }
    });

    // Open directory on host file system
    const openFolderBtn = document.createElement("button");
    openFolderBtn.className = "btn open-btn";
    openFolderBtn.textContent = "Folder";
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

    right.appendChild(countSpan);
    right.appendChild(renameProjBtn);
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

// ─── Kanban Board View ──────────────────────────────────────────────────────
function openWikiListView(projectPath, projectName) {
  currentProjectPath = projectPath;

  const titleEl = document.getElementById("projectTitle");
  const searchInput = document.getElementById("searchWikis");
  const addWikiBtn = document.getElementById("addWikiBtn");

  titleEl.textContent = `Project: ${projectName}`;
  searchInput.placeholder = "Search reports...";
  addWikiBtn.textContent = "+ Add Report";

  showView("wikiListView");
  loadWikis();
}

function loadWikis() {
  const term = document.getElementById("searchWikis").value.toLowerCase();
  
  try {
    const wikis = projectService.listReportsByPath(currentProjectPath)
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

  // Remove Reference Action
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn delete-btn";
  deleteBtn.textContent = "Remove";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!confirm(`Remove "${wiki.name}" reference from this board? (No files will be deleted)`)) return;
    try {
      projectService.removeReportFromProject(currentProjectPath, wiki.filePath);
      loadWikis();
    } catch (err) {
      alert("Failed to remove report: " + err.message);
    }
  });

  actions.appendChild(openBtn);
  actions.appendChild(revealBtn);
  actions.appendChild(deleteBtn);
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
      if (filePath && currentProjectPath) {
        try {
          projectService.updateReportStatus(currentProjectPath, filePath, status);
          loadWikis();
        } catch (err) {
          console.error("Failed to update status on drop:", err);
        }
      }
    });
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
function boot() {
  showView("dashboardView");
  initWorkspaces();
  initDashboard();
  initDragAndDrop();

  const addWikiBtn  = document.getElementById("addWikiBtn");
  const searchWikis = document.getElementById("searchWikis");
  const backBtn     = document.getElementById("backBtn");

  // File dialog to add wiki reference
  addWikiBtn.addEventListener("click", () => {
    if (!currentProjectPath) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.htm,.tid";
    input.onchange = evt => {
      const file = evt.target.files[0];
      if (!file || !file.path) return;
      try { 
        projectService.addReportToProject(currentProjectPath, file.path);
        loadWikis();
      } catch (err) {
        alert("Failed to add report: " + err.message);
      }
    };
    input.click();
  });

  // Filter cards on input
  searchWikis.addEventListener("input", () => {
    loadWikis();
  });

  // Back navigation
  backBtn.addEventListener("click", () => {
    currentProjectPath = null;
    showView("dashboardView");
    if (window._dashboardRefresh) window._dashboardRefresh();
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
