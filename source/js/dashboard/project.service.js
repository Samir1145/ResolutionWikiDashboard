// project.service.js – handles reference-based Project and Report management scoped by Workspace
"use strict";
const fs = require("fs");
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
    name: name
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
  return ws.projects.map(p => {
    let wikiCount = 0;
    try {
      const boards = listBoards(p.id);
      boards.forEach(b => {
        wikiCount += b.reportCount;
      });
    } catch (e) {
      console.error(`Failed to list boards for project ${p.id}:`, e);
    }
    return {
      id: p.id,
      name: p.name,
      wikiCount: wikiCount
    };
  });
}

function getProject(projectPath) {
  const ws = getActiveWorkspace();
  return ws.projects.find(p => p.id === projectPath);
}

// ─── Local Metadata Management Helpers ───────────────────────────────────────

function readProjectMetadata(projectPath) {
  const metaPath = path.join(projectPath, ".tiddlydesk-meta.json");
  if (!fs.existsSync(metaPath)) {
    return { reports: {} };
  }
  try {
    const raw = fs.readFileSync(metaPath, "utf8");
    return JSON.parse(raw) || { reports: {} };
  } catch (e) {
    console.error("Failed to read project metadata:", e);
    return { reports: {} };
  }
}

function writeProjectMetadata(projectPath, data) {
  const metaPath = path.join(projectPath, ".tiddlydesk-meta.json");
  try {
    fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write project metadata:", e);
  }
}

// ─── Project Structure Scanning ─────────────────────────────────────────────

function scanProject(projectPath) {
  const boards = [];
  const rootReports = [];
  
  if (!fs.existsSync(projectPath)) {
    return { boards, rootReports };
  }
  
  let items;
  try {
    items = fs.readdirSync(projectPath);
  } catch (e) {
    console.error("Failed to readdir projectPath:", e);
    return { boards, rootReports };
  }
  
  for (const item of items) {
    if (item === ".tiddlydesk-meta.json" || item.startsWith(".")) {
      continue;
    }
    const itemPath = path.join(projectPath, item);
    let stat;
    try {
      stat = fs.statSync(itemPath);
    } catch (e) {
      continue;
    }
    
    if (stat.isDirectory()) {
      const isWikiFolder = fs.existsSync(path.join(itemPath, "tiddlywiki.info"));
      if (isWikiFolder) {
        rootReports.push({
          name: item,
          filePath: itemPath,
          isFolderWiki: true
        });
      } else {
        // It's a board!
        boards.push({
          id: item,
          name: item,
          filePath: itemPath
        });
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      if (ext === ".html" || ext === ".htm") {
        rootReports.push({
          name: item,
          filePath: itemPath,
          isFolderWiki: false
        });
      }
    }
  }
  
  return { boards, rootReports };
}

function listReportsInBoardDir(projectPath, boardId) {
  const reports = [];
  if (boardId === "board_root") {
    const { rootReports } = scanProject(projectPath);
    return rootReports;
  }
  
  const boardPath = path.join(projectPath, boardId);
  if (!fs.existsSync(boardPath)) {
    return reports;
  }
  
  let items;
  try {
    items = fs.readdirSync(boardPath);
  } catch (e) {
    return reports;
  }
  
  for (const item of items) {
    if (item.startsWith(".")) continue;
    const itemPath = path.join(boardPath, item);
    let stat;
    try {
      stat = fs.statSync(itemPath);
    } catch (e) {
      continue;
    }
    
    if (stat.isDirectory()) {
      const isWikiFolder = fs.existsSync(path.join(itemPath, "tiddlywiki.info"));
      if (isWikiFolder) {
        reports.push({
          name: item,
          filePath: itemPath,
          isFolderWiki: true
        });
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      if (ext === ".html" || ext === ".htm") {
        reports.push({
          name: item,
          filePath: itemPath,
          isFolderWiki: false
        });
      }
    }
  }
  return reports;
}

// ─── Board/Swimlane Management (Scoped) ──────────────────────────────────────

function addBoard(projectPath, name) {
  throw new Error("Adding boards via UI is disabled. Please create a folder on your filesystem.");
}

function removeBoard(projectPath, boardId) {
  throw new Error("Removing boards via UI is disabled. Please delete the folder on your filesystem.");
}

function renameBoard(projectPath, boardId, newName) {
  throw new Error("Renaming boards via UI is disabled. Please rename the folder on your filesystem.");
}

function listBoards(projectPath) {
  const { boards, rootReports } = scanProject(projectPath);
  
  const result = [];
  if (rootReports.length > 0) {
    result.push({
      id: "board_root",
      name: "Main Board",
      reportCount: rootReports.length
    });
  }
  
  for (const board of boards) {
    const reports = listReportsInBoardDir(projectPath, board.id);
    result.push({
      id: board.id,
      name: board.name,
      reportCount: reports.length
    });
  }
  
  if (result.length === 0) {
    result.push({
      id: "board_root",
      name: "Main Board",
      reportCount: 0
    });
  }
  
  return result;
}

// ─── Report/Wiki Management (Scoped) ────────────────────────────────────────

function addReportToBoard(projectPath, boardId, filePath) {
  throw new Error("Adding reports via UI is disabled. Please place the file or folder on your filesystem.");
}

function removeReportFromBoard(projectPath, boardId, filePath) {
  throw new Error("Removing reports via UI is disabled. Please delete the file or folder on your filesystem.");
}

function updateReportStatusInBoard(projectPath, boardId, filePath, status) {
  const metadata = readProjectMetadata(projectPath);
  const relPath = path.relative(projectPath, filePath);
  
  if (!metadata.reports) {
    metadata.reports = {};
  }
  if (!metadata.reports[relPath]) {
    metadata.reports[relPath] = {};
  }
  metadata.reports[relPath].status = status;
  
  writeProjectMetadata(projectPath, metadata);
}

function listReportsByBoard(projectPath, boardId) {
  const reports = listReportsInBoardDir(projectPath, boardId);
  const metadata = readProjectMetadata(projectPath);
  
  reports.forEach(r => {
    const relPath = path.relative(projectPath, r.filePath);
    const meta = metadata.reports[relPath] || {};
    r.status = meta.status || "todo";
  });
  
  return reports;
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
  
  addBoard,
  removeBoard,
  renameBoard,
  listBoards,
  
  addReportToBoard,
  removeReportFromBoard,
  updateReportStatusInBoard,
  listReportsByBoard
};
