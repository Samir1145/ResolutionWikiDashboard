// project.service.js – handles reference-based Project and Report management scoped by Workspace
"use strict";
const path = require("path");
const config = require("./config.service");

// ─── Workspace Management ───────────────────────────────────────────────────

function getActiveWorkspaceId() {
  const cfg = config.getConfig();
  return cfg.activeWorkspaceId || "default";
}

function setActiveWorkspaceId(id) {
  const cfg = config.getConfig();
  cfg.activeWorkspaceId = id;
  config.setConfig(cfg);
}

function addWorkspace(name) {
  const cfg = config.getConfig();
  const id = "ws_" + Date.now();
  cfg.workspaces.push({
    id: id,
    name: name,
    projects: []
  });
  cfg.activeWorkspaceId = id; // Switch immediately to the newly created workspace
  config.setConfig(cfg);
  return id;
}

function removeWorkspace(id) {
  const cfg = config.getConfig();
  if (id === "default") {
    throw new Error("Cannot delete the Default Workspace.");
  }
  cfg.workspaces = cfg.workspaces.filter(w => w.id !== id);
  if (cfg.activeWorkspaceId === id) {
    cfg.activeWorkspaceId = "default";
  }
  config.setConfig(cfg);
}

function renameWorkspace(id, newName) {
  const cfg = config.getConfig();
  const ws = cfg.workspaces.find(w => w.id === id);
  if (ws) {
    ws.name = newName;
    config.setConfig(cfg);
  }
}

function listWorkspaces() {
  const cfg = config.getConfig();
  return cfg.workspaces.map(w => ({
    id: w.id,
    name: w.name,
    projectCount: w.projects ? w.projects.length : 0
  }));
}

function getActiveWorkspace() {
  const cfg = config.getConfig();
  const activeId = getActiveWorkspaceId();
  let ws = cfg.workspaces.find(w => w.id === activeId);
  if (!ws) {
    ws = cfg.workspaces[0];
    cfg.activeWorkspaceId = ws.id;
    config.setConfig(cfg);
  }
  return ws;
}

// ─── Project Management (Scoped) ─────────────────────────────────────────────

function addProject(projectPath) {
  const cfg = config.getConfig();
  const ws = cfg.workspaces.find(w => w.id === getActiveWorkspaceId());
  if (!ws) throw new Error("Active workspace not found.");
  
  const exists = ws.projects.find(p => p.id === projectPath);
  if (exists) {
    throw new Error(`Project is already added to this workspace.`);
  }
  const name = path.basename(projectPath);
  ws.projects.push({
    id: projectPath,
    name: name,
    reports: []
  });
  config.setConfig(cfg);
}

function removeProject(projectPath) {
  const cfg = config.getConfig();
  const ws = cfg.workspaces.find(w => w.id === getActiveWorkspaceId());
  if (ws) {
    ws.projects = ws.projects.filter(p => p.id !== projectPath);
    config.setConfig(cfg);
  }
}

function renameProject(projectPath, newName) {
  const cfg = config.getConfig();
  const ws = cfg.workspaces.find(w => w.id === getActiveWorkspaceId());
  if (ws) {
    const proj = ws.projects.find(p => p.id === projectPath);
    if (proj) {
      proj.name = newName;
      config.setConfig(cfg);
    }
  }
}

function listProjects() {
  const ws = getActiveWorkspace();
  return ws.projects.map(p => ({
    id: p.id,
    name: p.name,
    wikiCount: p.reports ? p.reports.length : 0
  }));
}

function getProject(projectPath) {
  const ws = getActiveWorkspace();
  return ws.projects.find(p => p.id === projectPath);
}

// ─── Report/Wiki Management (Scoped) ────────────────────────────────────────

function addReportToProject(projectPath, filePath) {
  const cfg = config.getConfig();
  const ws = cfg.workspaces.find(w => w.id === getActiveWorkspaceId());
  if (!ws) throw new Error("Active workspace not found.");
  const proj = ws.projects.find(p => p.id === projectPath);
  if (!proj) throw new Error("Project not found.");
  
  if (!proj.reports) proj.reports = [];
  const exists = proj.reports.find(r => r.filePath === filePath);
  if (exists) throw new Error("Report is already added to this project.");
  
  const name = path.basename(filePath);
  proj.reports.push({
    name: name,
    filePath: filePath,
    status: "todo" // default status for the Kanban board
  });
  
  config.setConfig(cfg);
}

function removeReportFromProject(projectPath, filePath) {
  const cfg = config.getConfig();
  const ws = cfg.workspaces.find(w => w.id === getActiveWorkspaceId());
  if (ws) {
    const proj = ws.projects.find(p => p.id === projectPath);
    if (proj && proj.reports) {
      proj.reports = proj.reports.filter(r => r.filePath !== filePath);
      config.setConfig(cfg);
    }
  }
}

function updateReportStatus(projectPath, filePath, status) {
  const cfg = config.getConfig();
  const ws = cfg.workspaces.find(w => w.id === getActiveWorkspaceId());
  if (ws) {
    const proj = ws.projects.find(p => p.id === projectPath);
    if (proj && proj.reports) {
      const rep = proj.reports.find(r => r.filePath === filePath);
      if (rep) {
        rep.status = status;
        config.setConfig(cfg);
      }
    }
  }
}

function listReportsByPath(projectPath) {
  const proj = getProject(projectPath);
  if (proj && proj.reports) {
    // Ensure all existing reports have a status
    proj.reports.forEach(r => {
      if (!r.status) r.status = "todo";
    });
    return proj.reports;
  }
  return [];
}

module.exports = {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  addWorkspace,
  removeWorkspace,
  renameWorkspace,
  listWorkspaces,
  
  addProject,
  removeProject,
  renameProject,
  listProjects,
  getProject,
  
  addReportToProject,
  removeReportFromProject,
  updateReportStatus,
  listReportsByPath
};
