// safe-fs.js - Idiot-proof Try/Catch Filesystem Wrappers for TiddlyDesk
"use strict";

const fs = require("fs");
const path = require("path");

const TAG = "[SafeFS]";

/**
 * Safely reads a file and parses its JSON content. Returns defaultValue on failure.
 */
function readJson(filePath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`${TAG} File does not exist, returning default: ${filePath}`);
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error(`${TAG} Failed to read or parse JSON at ${filePath}:`, err.message);
    return defaultValue;
  }
}

/**
 * Safely stringifies and writes data to a JSON file. Creates parent folders if needed.
 */
function writeJson(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`${TAG} Failed to write JSON to ${filePath}:`, err.message);
    return false;
  }
}

/**
 * Safely creates a folder recursively if it does not already exist.
 */
function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    console.error(`${TAG} Failed to create directory ${dirPath}:`, err.message);
    return false;
  }
}

/**
 * Safely reads a text file. Returns defaultValue if missing.
 */
function readText(filePath, defaultValue = "") {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`${TAG} Failed to read file ${filePath}:`, err.message);
    return defaultValue;
  }
}

/**
 * Safely writes text content to a file. Creates parent folders if needed.
 */
function writeText(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch (err) {
    console.error(`${TAG} Failed to write text to file ${filePath}:`, err.message);
    return false;
  }
}

module.exports = {
  readJson,
  writeJson,
  ensureDir,
  readText,
  writeText
};
