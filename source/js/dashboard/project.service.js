// project.service.js – handles reference-based Project and Report management
"use strict";
const path = require("path");
const config = require("./config.service");

/** Add an existing folder as a project reference */
function addProject(projectPath) {
  const cfg = config.getConfig();
  const exists = cfg.projects.find(p => p.id === projectPath);
  if (exists) {
    throw new Error(`Project is already added.`);
  }
  const name = path.basename(projectPath);
  cfg.projects.push({
    id: projectPath,
    name: name,
    reports: []
  });
  config.setConfig(cfg);
}

/** Remove a project reference */
function removeProject(projectPath) {
  const cfg = config.getConfig();
  cfg.projects = cfg.projects.filter(p => p.id !== projectPath);
  config.setConfig(cfg);
}

/** Rename a project's display name */
function renameProject(projectPath, newName) {
  const cfg = config.getConfig();
  const proj = cfg.projects.find(p => p.id === projectPath);
  if (proj) {
    proj.name = newName;
    config.setConfig(cfg);
  }
}

/** List all projects */
function listProjects() {
  const cfg = config.getConfig();
  return cfg.projects.map(p => ({
    id: p.id,
    name: p.name,
    wikiCount: p.reports ? p.reports.length : 0
  }));
}

/** Get a specific project */
function getProject(projectPath) {
  return config.getConfig().projects.find(p => p.id === projectPath);
}

/** Add an existing report file as a reference to a project */
function addReportToProject(projectPath, filePath) {
  const cfg = config.getConfig();
  const proj = cfg.projects.find(p => p.id === projectPath);
  if (!proj) throw new Error("Project not found");
  
  if (!proj.reports) proj.reports = [];
  const exists = proj.reports.find(r => r.filePath === filePath);
  if (exists) throw new Error("Report is already added to this project.");
  
  const name = path.basename(filePath);
  proj.reports.push({
    name: name,
    filePath: filePath
  });
  
  config.setConfig(cfg);
}

/** Remove a report reference from a project */
function removeReportFromProject(projectPath, filePath) {
  const cfg = config.getConfig();
  const proj = cfg.projects.find(p => p.id === projectPath);
  if (proj && proj.reports) {
    proj.reports = proj.reports.filter(r => r.filePath !== filePath);
    config.setConfig(cfg);
  }
}

/** List all reports for a specific project */
function listReportsByPath(projectPath) {
  const proj = getProject(projectPath);
  if (proj && proj.reports) {
    return proj.reports;
  }
  return [];
}

module.exports = {
  addProject,
  removeProject,
  renameProject,
  listProjects,
  getProject,
  addReportToProject,
  removeReportFromProject,
  listReportsByPath
};
