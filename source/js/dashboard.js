// dashboard.js – SPA for Project Dashboard + Reports List
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

// ─── Dashboard view ──────────────────────────────────────────────────────────
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
    countSpan.textContent = `${project.wikiCount} reports`;

    // Rename
    const renameBtn = document.createElement("button");
    renameBtn.className = "btn rename-btn";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", e => {
      e.stopPropagation();
      const newName = prompt("Enter new project display name:", project.name);
      if (newName && newName.trim() && newName.trim() !== project.name) {
        try { projectService.renameProject(project.id, newName.trim()); loadAndRender(); }
        catch (err) { alert(err.message); }
      }
    });

    // Open in Finder
    const openFolderBtn = document.createElement("button");
    openFolderBtn.className = "btn open-btn";
    openFolderBtn.textContent = "Folder";
    openFolderBtn.addEventListener("click", e => {
      e.stopPropagation();
      require("nw.gui").Shell.openItem(project.id);
    });

    // Remove project
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn delete-btn";
    deleteBtn.textContent = "Remove";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (!confirm(`Remove the project reference "${project.name}" from the dashboard? (The folder will NOT be deleted)`)) return;
      try {
        projectService.removeProject(project.id);
        loadAndRender();
      } catch (err) { alert("Failed: " + err.message); }
    });

    right.appendChild(countSpan);
    right.appendChild(renameBtn);
    right.appendChild(openFolderBtn);
    right.appendChild(deleteBtn);

    card.appendChild(nameSpan);
    card.appendChild(right);

    // Click → open report list view (SPA navigation)
    card.addEventListener("click", () => openWikiListView(project.id, project.name));
    return card;
  }

  function renderProjects(projects) {
    clearFolderList();
    if (projects.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No projects yet. Click 'Add Project' to link an existing folder.";
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

  // Add project (opens folder picker)
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
      } catch (err) {
        alert("Failed to add project: " + err.message);
      }
    };
    input.click();
  });

  // Search
  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase();
    const filtered = projectService.listProjects().filter(p => p.name.toLowerCase().includes(term));
    renderProjects(filtered);
  });

  // Initial render
  loadAndRender();

  // Expose refresh for when we return from report list
  window._dashboardRefresh = loadAndRender;
}

// ─── Reports List view ────────────────────────────────────────────────────────
function openWikiListView(projectPath, projectName) {
  currentProjectPath = projectPath;

  const titleEl     = document.getElementById("projectTitle");
  const wikiListDiv = document.getElementById("wikiList");
  const searchInput = document.getElementById("searchWikis");
  const addWikiBtn  = document.getElementById("addWikiBtn");
  const backBtn     = document.getElementById("backBtn");

  titleEl.textContent = `Project: ${projectName}`;
  searchInput.placeholder = "Search reports...";
  addWikiBtn.textContent = "+ Add Report";

  // ── Show report list view ──
  showView("wikiListView");
  loadWikis();
}

function loadWikis() {
  const wikiListDiv = document.getElementById("wikiList");
  function renderWikis(wikis) {
    while (wikiListDiv.firstChild) wikiListDiv.removeChild(wikiListDiv.firstChild);
    if (wikis.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No reports found. Use '+ Add Report' to link one.";
      wikiListDiv.appendChild(empty);
      return;
    }
    wikis.forEach(w => {
      const item = document.createElement("div");
      item.className = "wiki-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "wiki-name";
      nameSpan.textContent = w.name;

      const actions = document.createElement("div");
      actions.className = "actions";

      // Open report using TiddlyDesktop's native window manager (preserves saving)
      const openBtn = document.createElement("button");
      openBtn.className = "open-link";
      openBtn.style.cssText = "background:none;border:none;cursor:pointer;color:var(--link-color,#0066ff);margin-right:1rem;text-decoration:underline;font-size:inherit;";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", () => {
        // window.$tw is injected by main.js when it opens this window
        if (window.$tw && window.$tw.desktop && window.$tw.desktop.windowList) {
          window.$tw.desktop.windowList.openByPathname(w.filePath);
        } else if (window._twGlobal && window._twGlobal.$tw && window._twGlobal.$tw.desktop) {
          window._twGlobal.$tw.desktop.windowList.openByPathname(w.filePath);
        } else {
          // Fallback: try the background window's global
          try {
            const bg = require("nw.gui").Window.get().window;
            if (bg.$tw && bg.$tw.desktop) {
              bg.$tw.desktop.windowList.openByPathname(w.filePath);
            } else {
              alert("Could not find TiddlyDesktop context. Make sure the app started normally.");
            }
          } catch(err) {
            alert("Error opening report: " + err.message);
          }
        }
      });

      // Remove report reference
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn delete-btn";
      deleteBtn.textContent = "Remove";
      deleteBtn.addEventListener("click", () => {
        if (!confirm(`Remove "${w.name}" from the dashboard? (The file will NOT be deleted)`)) return;
        try {
          projectService.removeReportFromProject(currentProjectPath, w.filePath);
          loadWikis();
        } catch (err) { alert("Failed: " + err.message); }
      });

      actions.appendChild(openBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(nameSpan);
      item.appendChild(actions);
      wikiListDiv.appendChild(item);
    });
  }

  try {
    const term = document.getElementById("searchWikis").value.toLowerCase();
    const wikis = projectService.listReportsByPath(currentProjectPath)
      .filter(w => w.name.toLowerCase().includes(term));
    renderWikis(wikis);
  } catch (e) {
    console.error("Failed to load reports", e);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  showView("dashboardView");
  initDashboard();

  // Attach persistent listeners for Wiki List view
  const addWikiBtn  = document.getElementById("addWikiBtn");
  const searchWikis = document.getElementById("searchWikis");
  const backBtn     = document.getElementById("backBtn");

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
      }
      catch (err) { alert("Failed to add report: " + err.message); }
    };
    input.click();
  });

  searchWikis.addEventListener("input", () => {
    loadWikis();
  });

  backBtn.addEventListener("click", () => {
    currentProjectPath = null;
    showView("dashboardView");
    if (window._dashboardRefresh) window._dashboardRefresh();
  });
});
