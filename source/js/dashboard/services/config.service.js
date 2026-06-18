// config.service.js – simple configuration manager for the Dashboard feature
// Uses Node's fs module (available in NW.js) to store a JSON file in the user's home directory.

"use strict";

const fs = require("fs");
const path = require("path");
const safeFs = require("../utils/safe-fs");

// Location of the config file (~/.tiddlydesktop/dashboard-config.json)
const CONFIG_FILE = path.join(process.env.HOME || process.env.USERPROFILE, ".tiddlydesktop", "dashboard-config.json");

// Ensure the directory exists
function ensureConfigDir() {
  const dir = path.dirname(CONFIG_FILE);
  safeFs.ensureDir(dir);
}

function readConfig() {
  ensureConfigDir();
  const defaultWorkspace = { id: "default", name: "Default Workspace", projects: [] };
  const defaultConfig = { workspaces: [defaultWorkspace], activeWorkspaceId: "default" };
  
  if (!fs.existsSync(CONFIG_FILE)) {
    safeFs.writeJson(CONFIG_FILE, defaultConfig);
    return defaultConfig;
  }
  
  const parsed = safeFs.readJson(CONFIG_FILE, defaultConfig);
  let migrated = false;
  
  // Migrate old configuration format (projects list at root) to workspaces format
  if (parsed.projects && !parsed.workspaces) {
    parsed.workspaces = [{ id: "default", name: "Default Workspace", projects: parsed.projects }];
    parsed.activeWorkspaceId = "default";
    delete parsed.projects;
    migrated = true;
  }
  
  if (!parsed.workspaces) {
    parsed.workspaces = [defaultWorkspace];
    parsed.activeWorkspaceId = "default";
    migrated = true;
  }

  // Migrate projects: replace flat reports with boards array
  parsed.workspaces.forEach(ws => {
    if (ws.projects) {
      ws.projects.forEach(proj => {
        if (proj.reports && !proj.boards) {
          proj.boards = [{
            id: "board_default",
            name: "Main Board",
            reports: proj.reports
          }];
          delete proj.reports;
          migrated = true;
        }
        if (!proj.boards) {
          proj.boards = [{
            id: "board_default",
            name: "Main Board",
            reports: []
          }];
          migrated = true;
        }
      });
    }
  });

  if (migrated) {
    safeFs.writeJson(CONFIG_FILE, parsed);
  }
  
  return parsed;
}

function writeConfig(config) {
  ensureConfigDir();
  safeFs.writeJson(CONFIG_FILE, config);
}

module.exports = {
  getConfig: readConfig,
  setConfig: writeConfig
};
