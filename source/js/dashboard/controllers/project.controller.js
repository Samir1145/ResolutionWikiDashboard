// project.controller.js - Project registration and disk watch logic
"use strict";

const fs = require("fs");
const path = require("path");
const projectService = require("../services/project.service");

let projectDirectoryWatcher = null;

function initDashboard() {
  const folderListEl = document.getElementById("folderList");
  const addBtn = document.getElementById("addFolderBtn");
  const searchInput = document.getElementById("searchInput");
  const loader = document.getElementById("loader");

  if (!folderListEl || !addBtn || !searchInput || !loader) return;

  addBtn.textContent = "Add Project";

  function clearFolderList() {
    while (folderListEl.firstChild) {
      folderListEl.removeChild(folderListEl.firstChild);
    }
  }

  function showDashboardUI() {
    loader.style.display = "none";
    const bar = document.getElementById("projectActionBar");
    if (bar) bar.style.display = "flex";
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

    const openFolderBtn = document.createElement("button");
    openFolderBtn.className = "btn open-btn";
    openFolderBtn.textContent = "Reveal";
    openFolderBtn.addEventListener("click", e => {
      e.stopPropagation();
      require("nw.gui").Shell.openItem(project.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn delete-btn";
    deleteBtn.textContent = "Remove";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (!confirm(`Remove the project reference "${project.name}" from this workspace? (No files will be deleted)`)) return;
      try {
        projectService.removeProject(project.id);
        loadAndRender();
        if (window.controllers && window.controllers.workspace) {
          window.controllers.workspace.renderWorkspaces();
        }
      } catch (err) {
        alert("Failed: " + err.message);
      }
    });

    right.appendChild(openFolderBtn);
    right.appendChild(deleteBtn);

    card.appendChild(nameSpan);
    card.appendChild(right);

    card.addEventListener("click", () => {
      if (window.controllers && window.controllers.kanban) {
        window.controllers.kanban.openWikiListView(project.id, project.name);
      }
    });
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
        if (window.controllers && window.controllers.workspace) {
          window.controllers.workspace.renderWorkspaces();
        }
      } catch (err) {
        alert("Failed to add project: " + err.message);
      }
    };
    input.click();
  });

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase();
    const filtered = projectService.listProjects().filter(p => p.name.toLowerCase().includes(term));
    renderProjects(filtered);
  });

  loadAndRender();

  window._dashboardRefresh = () => {
    loadAndRender();
    if (window.controllers && window.controllers.workspace) {
      window.controllers.workspace.renderWorkspaces();
    }
  };
}

function setupProjectWatcher(projectPath) {
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
      if (filename && (filename.startsWith(".") || filename.includes("/.") || filename.includes("\\."))) {
        return;
      }
      
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        console.log("Project directory changed, refreshing UI...");
        if (window.currentProjectPath && window.controllers && window.controllers.kanban) {
          const boards = projectService.listBoards(window.currentProjectPath);
          const boardExists = boards.some(b => b.id === window.activeBoardId);
          if (!boardExists) {
            window.activeBoardId = boards.length > 0 ? boards[0].id : "board_root";
          }
          window.controllers.kanban.renderBoardsSidebar();
          window.controllers.kanban.loadWikis();
        }
      }, 300);
    });
  } catch (err) {
    console.error("Failed to start directory watcher:", err);
  }
}



module.exports = {
  initDashboard,
  setupProjectWatcher
};
