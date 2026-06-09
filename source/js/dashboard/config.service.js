// config.service.js – simple configuration manager for the Dashboard feature
// Uses Node's fs module (available in NW.js) to store a JSON file in the user's home directory.

"use strict";

const fs = require("fs");
const path = require("path");

// Location of the config file (~/.tiddlydesktop/dashboard-config.json)
const CONFIG_FILE = path.join(process.env.HOME || process.env.USERPROFILE, ".tiddlydesktop", "dashboard-config.json");

// Ensure the directory exists
function ensureConfigDir() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    // Default config – an empty array of projects
    const defaultConfig = { projects: [] };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), "utf8");
    return defaultConfig;
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.projects) parsed.projects = [];
    return parsed;
  } catch (e) {
    console.error("Failed to parse dashboard config", e);
    return { projects: [] };
  }
}

function writeConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

module.exports = {
  getConfig: readConfig,
  setConfig: writeConfig
};
