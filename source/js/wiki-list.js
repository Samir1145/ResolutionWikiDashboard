// wiki-list.js – UI for displaying wikis inside a project folder
"use strict";
const projectService = require("../js/dashboard/project.service");

// Utility to read query parameter
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("Wiki list UI loaded");
  const backBtn = document.getElementById("backBtn");
  const projectTitle = document.getElementById("projectTitle");
  const searchInput = document.getElementById("searchWikis");
  const wikiListDiv = document.getElementById("wikiList");
  const addWikiBtn = document.getElementById("addWikiBtn");

  // Back button simply returns to dashboard
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "../html/dashboard.html";
    });
  }

  const projectPath = getQueryParam("projectPath");
  if (!projectPath) {
    projectTitle.textContent = "Project: (unknown)";
    console.error("Missing projectPath query param");
    return;
  }

  projectTitle.textContent = `Project: ${projectPath}`;

  if (addWikiBtn) {
    addWikiBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".html,.htm,.tid";
      input.onchange = (evt) => {
        const file = evt.target.files[0];
        if (file && file.path) {
          try {
            const fs = require("fs");
            const path = require("path");
            const dest = path.join(projectPath, file.name);
            if (fs.existsSync(dest)) {
              alert("A wiki file with this name already exists in the project.");
              return;
            }
            fs.copyFileSync(file.path, dest);
            loadWikis();
          } catch (err) {
            console.error(err);
            alert("Failed to add wiki: " + err.message);
          }
        }
      };
      input.click();
    });
  }

  // Load wikis for the given project
  function loadWikis() {
    try {
      const wikis = projectService.listWikisByPath(projectPath);
      console.log("Wikis loaded", wikis);
      renderWikis(wikis);
    } catch (e) {
      console.error("Failed to load wikis", e);
    }
  }

  function clearList() {
    while (wikiListDiv.firstChild) wikiListDiv.removeChild(wikiListDiv.firstChild);
  }

  function renderWikis(wikis) {
    clearList();
    if (wikis.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No wiki files found in this project.";
      wikiListDiv.appendChild(empty);
      return;
    }
    wikis.forEach(w => {
      const item = document.createElement("div");
      item.className = "wiki-item";
      const nameSpan = document.createElement("span");
      nameSpan.className = "wiki-name";
      nameSpan.textContent = w.name;
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "actions";

      const openLink = document.createElement("a");
      openLink.className = "open-link";
      openLink.href = "#";
      openLink.textContent = "Open";
      openLink.addEventListener("click", (e) => {
        e.preventDefault();
        // Use the global $tw from the background context to open the wiki correctly
        if (global.$tw && global.$tw.desktop && global.$tw.desktop.windowList) {
          global.$tw.desktop.windowList.openByPathname(w.filePath);
        } else {
          alert("TiddlyDesktop background context is missing!");
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (confirm(`Are you sure you want to move "${w.name}" to the Trash?`)) {
          try {
            const gui = require("nw.gui");
            const success = gui.Shell.moveItemToTrash(w.filePath);
            if (!success) {
              alert("Could not move to trash (OS restriction).");
            } else {
              loadWikis();
            }
          } catch (err) {
            alert("Failed to delete: " + err.message);
          }
        }
      });

      actionsDiv.appendChild(openLink);
      actionsDiv.appendChild(deleteBtn);

      item.appendChild(nameSpan);
      item.appendChild(actionsDiv);
      wikiListDiv.appendChild(item);
    });
  }

  // Search filter
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase();
      const filtered = projectService
        .listWikisByPath(projectPath)
        .filter(w => w.name.toLowerCase().includes(term));
      renderWikis(filtered);
    });
  }

  loadWikis();
});
