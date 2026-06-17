// workspace.controller.js - Workspace UI interactions and tabs rendering
"use strict";

const projectService = require("../project.service");

function renderWorkspaces() {
  const tabsEl = document.getElementById("workspaceTabs");
  if (!tabsEl) return;
  
  const activeId = projectService.getActiveWorkspaceId();
  const workspaces = projectService.listWorkspaces();

  // Clear tabs
  while (tabsEl.firstChild) {
    tabsEl.removeChild(tabsEl.firstChild);
  }

  workspaces.forEach(ws => {
    const tab = document.createElement("button");
    tab.className = "workspace-tab" + (ws.id === activeId ? " active" : "");
    tab.textContent = `${ws.name} (${ws.projectCount})`;
    tab.addEventListener("click", () => {
      projectService.setActiveWorkspaceId(ws.id);
      renderWorkspaces();
      if (window._dashboardRefresh) {
        window._dashboardRefresh();
      }
    });
    tabsEl.appendChild(tab);
  });
}

function initWorkspaces() {
  const barEl = document.getElementById("workspaceBar");
  const addBtn = document.getElementById("addWorkspaceBtn");
  const renameBtn = document.getElementById("renameWorkspaceBtn");
  const deleteBtn = document.getElementById("deleteWorkspaceBtn");

  if (barEl) barEl.style.display = "";

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const name = prompt("Enter new workspace name:");
      if (name && name.trim()) {
        try {
          projectService.addWorkspace(name.trim());
          renderWorkspaces();
          if (window._dashboardRefresh) {
            window._dashboardRefresh();
          }
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }

  if (renameBtn) {
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
  }

  if (deleteBtn) {
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
        if (window._dashboardRefresh) {
          window._dashboardRefresh();
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  renderWorkspaces();
}

module.exports = {
  renderWorkspaces,
  initWorkspaces
};
