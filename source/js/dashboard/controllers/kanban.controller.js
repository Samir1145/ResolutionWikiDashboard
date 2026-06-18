// kanban.controller.js - Kanban Board card loading and layout views
// ============================================================================
// 💡 WELCOME BEGGINER DEVELOPER!
// 
// WHAT THIS FILE DOES:
// This script is the visual controller for the Kanban Board. Its jobs are:
// 1. Loading files from the selected project directory and partitioning them into
//    three visual columns: "To Do", "In Progress", and "Done".
// 2. Rendering subfolders in the left menu bar as selectable Sub-boards.
// 3. Wiring up mouse Drag-and-Drop events so dragging a card to a different column
//    instantly updates its state database on disk.
// ============================================================================

"use strict";

// projectService handles config queries and reading folder metadata (.tiddlydesk-meta.json)
const projectService = require("../services/project.service");

/**
 * Opens the board view for a specific project folder.
 * Called when a user clicks on a case project card in the main dashboard view.
 */
function openWikiListView(projectPath, projectName) {
  // Step 1: Store the open project pathway globally so other scripts know where to look.
  window.currentProjectPath = projectPath;

  // Step 2: Update the project header text at the top of the board layout.
  const titleEl = document.getElementById("projectTitle");
  if (titleEl) {
    titleEl.textContent = `Project: ${projectName}`;
  }

  // Step 3: Scan folders. If there are subdirectories, default the view to show the first sub-board.
  const boards = projectService.listBoards(window.currentProjectPath);
  if (boards.length > 0) {
    window.activeBoardId = boards[0].id;
  } else {
    window.activeBoardId = "board_root"; // "board_root" refers to files placed directly in the project folder root
  }

  // Step 4: Toggle layout display. Hide the project manager, show the Kanban board.
  ["dashboardView", "wikiListView"].forEach(v => {
    const el = document.getElementById(v);
    if (el) {
      el.style.display = (v === "wikiListView") ? "" : "none";
    }
  });

  // Step 5: Render sub-boards left sidebar menu list and load cards.
  renderBoardsSidebar();
  loadWikis();

  // Step 5.5: Default active tab to Folders on entrance
  const tabFoldersBtn = document.getElementById("tabFoldersBtn");
  if (tabFoldersBtn) {
    tabFoldersBtn.click();
  }
  
  // Step 6: Start a live file watcher on the folder.
  // If you copy/delete files using Finder, the board updates automatically in real-time.
  if (window.controllers && window.controllers.project) {
    window.controllers.project.setupProjectWatcher(projectPath);
  }

  // Step 7: Clear out the bottom Analysis Basket drag-and-drop lists.
  if (window.controllers && window.controllers.basket) {
    window.controllers.basket.clearBasket();
  }
}

/**
 * Renders the left sidebar menu listing all detected sub-folders (sub-boards).
 */
function renderBoardsSidebar() {
  const listEl = document.getElementById("boardList");
  if (!listEl) return;
  
  // Scan folders inside the project. Each standard subdirectory becomes a sub-board.
  const boards = projectService.listBoards(window.currentProjectPath);

  // Clear any existing list items inside the sidebar HTML tag
  while (listEl.firstChild) {
    listEl.removeChild(listEl.firstChild);
  }

  // Generate an <li> element in the list for each board
  boards.forEach(b => {
    const li = document.createElement("li");
    li.className = "board-nav-item" + (b.id === window.activeBoardId ? " active" : "");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${b.name} (${b.reportCount})`;
    li.appendChild(nameSpan);

    // Clicking a sub-board menu item changes the active board target and reloads files
    li.addEventListener("click", () => {
      window.activeBoardId = b.id;
      renderBoardsSidebar(); // Re-render to update the active CSS class highlight
      loadWikis();           // Reload cards for the clicked folder
    });

    listEl.appendChild(li);
  });

  // Update the visual title above the columns
  const activeBoard = boards.find(x => x.id === window.activeBoardId);
  const activeBoardTitle = document.getElementById("activeBoardTitle");
  if (activeBoardTitle) {
    activeBoardTitle.textContent = activeBoard ? activeBoard.name : "Board";
  }
}

/**
 * Scans directories, filters files, and triggers the columns layout updates.
 */
async function loadWikis() {
  const searchWikis = document.getElementById("searchWikis");
  const term = searchWikis ? searchWikis.value.trim() : "";

  try {
    // Step 1: Read all case files (.html, .htm, Tiddlers) inside the active board folder directory.
    let wikis = projectService.listReportsByBoard(window.currentProjectPath, window.activeBoardId);

    // Step 2: Apply search filters
    if (term) {
      const lowerTerm = term.toLowerCase();
      wikis = wikis.filter(w => w.name.toLowerCase().includes(lowerTerm));
    }

    // Step 3: Draw cards on the board columns.
    renderKanbanBoard(wikis);
  } catch (e) {
    console.error("Failed to load reports:", e);
  }
}

/**
 * Draws the files lists onto the Kanban UI structure.
 */
function renderKanbanBoard(wikis) {
  // Bind column elements and empty lists
  const columns = {
    todo: { listEl: document.getElementById("list-todo"), countEl: document.getElementById("count-todo"), items: [] },
    progress: { listEl: document.getElementById("list-progress"), countEl: document.getElementById("count-progress"), items: [] },
    done: { listEl: document.getElementById("list-done"), countEl: document.getElementById("count-done"), items: [] }
  };

  if (!columns.todo.listEl || !columns.progress.listEl || !columns.done.listEl) return;

  // Step 1: Partition the files list into corresponding status buckets.
  // Defaults to "todo" if the file has no status saved in the project metadata.
  wikis.forEach(w => {
    const status = w.status || "todo";
    if (columns[status]) {
      columns[status].items.push(w);
    } else {
      columns.todo.items.push(w);
    }
  });

  // Step 2: Clear and redraw each column in the DOM.
  Object.keys(columns).forEach(status => {
    const col = columns[status];
    
    // Clear old visual HTML tags inside column list
    while (col.listEl.firstChild) {
      col.listEl.removeChild(col.listEl.firstChild);
    }

    // Update column badge counter number
    col.countEl.textContent = col.items.length;

    // If a column is empty, show a dashed placeholder card
    if (col.items.length === 0) {
      const empty = document.createElement("div");
      empty.style.fontSize = "0.85rem";
      empty.style.color = "var(--text-muted)";
      empty.style.textAlign = "center";
      empty.style.padding = "1rem";
      empty.style.border = "1px dashed var(--border-color)";
      empty.style.borderRadius = "6px";
      empty.textContent = "Drop cards here";
      col.listEl.appendChild(empty);
    } else {
      // Generate and append a visual file card for each document entry
      col.items.forEach(w => {
        col.listEl.appendChild(createKanbanCard(w));
      });
    }
  });
}

/**
 * Generates the HTML card elements representing a file.
 */
function createKanbanCard(wiki) {
  const card = document.createElement("div");
  card.className = "wiki-card";
  card.draggable = true; // Required by the browser to enable standard mouse drag interactions

  // Add file name label
  const title = document.createElement("div");
  title.className = "wiki-card-title";
  title.textContent = wiki.name;
  card.appendChild(title);

  // Add Action buttons
  const actions = document.createElement("div");
  actions.className = "wiki-card-actions";

  // Open Button: Opens TiddlyWikis sandbox style so updates are auto-saved natively
  const openBtn = document.createElement("button");
  openBtn.className = "btn";
  openBtn.style.background = "var(--primary-accent)";
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", () => {
    const tw = window.$tw || window._twGlobal?.$tw;
    if (tw?.desktop?.windowList) {
      tw.desktop.windowList.openByPathname(wiki.filePath);
    } else {
      // Fallback: search for backstage references in the root Window wrapper
      try {
        const bg = require("nw.gui").Window.get().window;
        if (bg.$tw?.desktop?.windowList) {
          bg.$tw.desktop.windowList.openByPathname(wiki.filePath);
        } else {
          alert("Could not locate TiddlyDesktop context.");
        }
      } catch (err) {
        alert("Error opening wiki: " + err.message);
      }
    }
  });

  // Reveal Button: Launches Finder or Explorer showing the exact file
  const revealBtn = document.createElement("button");
  revealBtn.className = "btn open-btn";
  revealBtn.textContent = "Reveal";
  revealBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Stop click bubble from triggering card events
    try {
      require("nw.gui").Shell.showItemInFolder(wiki.filePath);
    } catch (err) {
      alert("Failed to show file: " + err.message);
    }
  });

  actions.appendChild(openBtn);
  actions.appendChild(revealBtn);
  card.appendChild(actions);

  // ─── Drag Start Event ──────────────────────────────────────────────────────
  card.addEventListener("dragstart", (e) => {
    // Record target path globally and attach data to drag event transfer channel
    window.activeDragFilePath = wiki.filePath;
    card.classList.add("dragging");
    e.dataTransfer.setData("text/plain", wiki.filePath);
  });

  // ─── Drag End Event ────────────────────────────────────────────────────────
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    window.activeDragFilePath = null;
    // Remove blue highlights from all column borders when drag ends
    document.querySelectorAll(".kanban-column").forEach(col => col.classList.remove("drag-over"));
  });

  return card;
}

/**
 * Registers drag-and-drop listener actions on columns.
 */
function initDragAndDrop() {
  const columnIds = ["col-todo", "col-progress", "col-done"];

  columnIds.forEach(id => {
    const col = document.getElementById(id);
    if (!col) return;
    
    // Extract column status keyword ("todo", "progress", or "done") from HTML ID ("col-todo", etc.)
    const status = id.replace("col-", "");

    // dragover: Fires continuously when a card is dragged above a column.
    // e.preventDefault() is REQUIRED here; otherwise, browsers block dropping files.
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over"); // Highlight column border in blue
    });

    col.addEventListener("dragenter", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });

    // dragleave: User dragged the cursor away from this column. Remove highlights.
    col.addEventListener("dragleave", () => {
      col.classList.remove("drag-over");
    });

    // drop: Fires when mouse button is released above this column.
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");

      const activeDragFilePath = window.activeDragFilePath;
      
      // Grab filepath from either the global variable or the browser data transfer channel
      const filePath = e.dataTransfer.getData("text/plain") || activeDragFilePath;
      
      if (filePath && window.currentProjectPath && window.activeBoardId) {
        try {
          // Update the file status key in `.tiddlydesk-meta.json` inside the case folder
          projectService.updateReportStatusInBoard(window.currentProjectPath, window.activeBoardId, filePath, status);
          
          // Reload board to reflect the cards movement immediately
          loadWikis();
        } catch (err) {
          console.error("Failed to update status on drop:", err);
        }
      }
    });
  });
}

module.exports = {
  openWikiListView,
  renderBoardsSidebar,
  loadWikis,
  renderKanbanBoard,
  initDragAndDrop
};

