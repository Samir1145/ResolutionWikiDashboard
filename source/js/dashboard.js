// dashboard.js – Thin Entry Point Mediator for TiddlyDesk Project Dashboard
// ============================================================================
// 💡 WELCOME BEGGINER DEVELOPER!
// 
// ARCHITECTURE EXPLANATION:
// This file uses the "Mediator Pattern". In large apps, if visual components (like the Kanban board
// and RAG search sidebar) try to talk directly to each other, they get tangled in circular imports.
// To prevent that, this script:
// 1. Acts as the central "traffic cop" or "mediator".
// 2. Holds global states (like which project folder is open) on the standard browser `window` object.
// 3. Registers all individual feature controllers in a global `window.controllers` list so they 
//    can safely trigger actions in other panels when needed.
// ============================================================================

"use strict";

// The project service handles read/write actions on the JSON config file `~/.tiddlydesktop/dashboard-config.json`
const projectService = require("../js/dashboard/project.service");

// ─── Set up the Modular UI Controllers ───────────────────────────────────────
// We register each separate feature script as a property under the `window.controllers` object.
// This allows any script in our app to access another script (e.g., the RAG tab can tell the 
// project list watcher to update without needing to do a direct require).
window.controllers = {
  // markdown: Simple text utility that translates Markdown text symbols (e.g., #, **, |) into HTML code.
  markdown:  require("../js/dashboard/controllers/markdown.utils"),
  
  // workspace: Manages the workspace tabs at the top (add, delete, switch, rename).
  workspace: require("../js/dashboard/controllers/workspace.controller"),
  
  // project: Manages linking case directories and watching those folders for updates.
  project:   require("../js/dashboard/controllers/project.controller"),
  
  // kanban: Loads, filters, and renders file cards across the "To Do", "In Progress", and "Done" columns.
  kanban:    require("../js/dashboard/controllers/kanban.controller"),
  
  // basket: Handles files dragged into the analysis dropzone at the bottom.
  basket:    require("../js/dashboard/controllers/basket.controller"),
  
  // rag: Manages the sidebar AI chats, local indexing notifications, and report compilation.
  rag:       require("../js/dashboard/controllers/rag.controller")
};

// ─── Global State ────────────────────────────────────────────────────────────
// These variables store the active state of what the user is currently looking at.
// Placing them under `window` makes them accessible globally by any sub-component.

// 📂 Path to the folder containing case documents (e.g., "/Users/atulgrover/Documents/Cases/Debtor_A")
window.currentProjectPath = null;

// 🗂️ ID of the active subfolder (or swimlane). Defaults to "board_root" for the main project directory.
window.activeBoardId = null;

// 📄 Tracks the path of the file card that is currently being dragged across Kanban columns.
window.activeDragFilePath = null;

// ─── View Helpers ────────────────────────────────────────────────────────────
// Toggles display screens. We use CSS `display:none` or `display:""` (visible) to navigate.
// ⚠️ CRITICAL DESIGN CHOICE: 
// In NW.js desktop apps, using standard web links (`window.location.href = "page.html"`) wipes the
// memory space. That would delete the underlying TiddlyWiki variables ($tw) loaded by TiddlyDesktop.
// To keep things running smoothly, we toggle visibility divs instead of loading a new page.
function showView(id) {
  ["dashboardView", "wikiListView"].forEach(v => {
    const el = document.getElementById(v);
    // If v matched the requested view ID, show it, otherwise hide it.
    if (el) el.style.display = (v === id) ? "" : "none";
  });
}

// ─── App Boot / Setup ────────────────────────────────────────────────────────
// This boot sequence is executed immediately after the HTML page is finished loading in the browser.
function boot() {
  // Expose services on window so older legacy script files can find them.
  window.projectService = projectService;
  window._loadWikis = window.controllers.kanban.loadWikis;

  // Step 1: Default the screen layout to display the workspaces/projects list.
  showView("dashboardView");
  
  // Step 2: Initialize each modular controller's button event listeners.
  window.controllers.workspace.initWorkspaces(); // Renders top tabs
  window.controllers.project.initDashboard();     // Renders projects list
  window.controllers.kanban.initDragAndDrop();   // Setup columns drop zones listeners
  window.controllers.basket.initBasket();         // Setup bottom file dropzone
  window.controllers.rag.initRag();               // Setup sidebar tabs & buttons

  // Step 3: Wire up dashboard search bar input changes
  const searchWikis = document.getElementById("searchWikis");
  if (searchWikis) {
    searchWikis.addEventListener("input", () => {
      // Re-runs filter searches every time a user presses a key inside the search input box.
      window.controllers.kanban.loadWikis();
    });
  }

  // Step 4: Wire up the project "Back to Dashboard" navigation link
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const projController = window.controllers.project;
      
      // Safety step: If we were watching a directory for live updates (e.g. fs.watch),
      // we must shut it down to prevent memory leaks and file lockouts on the operating system.
      if (projController.projectDirectoryWatcher) {
        try {
          projController.projectDirectoryWatcher.close();
        } catch (e) {
          console.error("Failed to safely close file watcher:", e);
        }
        projController.projectDirectoryWatcher = null;
      }
      
      // Reset state variables to null since we are leaving the project dashboard view
      window.currentProjectPath = null;
      window.activeBoardId = null;
      
      // Reset panels
      window.controllers.basket.clearBasket();
      showView("dashboardView");
      
      // Refresh list
      if (window._dashboardRefresh) window._dashboardRefresh();
    });
  }

  // Step 5: Wire up the LexAI Agents Playground Modal launcher button
  const agentDemoBtn = document.getElementById("agentDemoBtn");
  if (agentDemoBtn) {
    agentDemoBtn.addEventListener("click", () => {
      console.log("[User Event] Clicked Agent Demo button.");
      try {
        // nw.gui is the NW.js library that allows us to create native system elements (like new desktop windows)
        const gui = require("nw.gui");
        gui.Window.open("html/kaiban-playground.html", {
          id: "kaiban-playground-window",
          show: true,
          width: 1200,
          height: 850,
          position: "center",
          focus: true,
          icon: "images/app-icon.png"
        }, function (win) {
          // When the new window loads, we pass our active state references across.
          // This avoids the child window needing to parse config files on its own.
          win.window.currentProjectPath = window.currentProjectPath;
          win.window.activeBoardId = window.activeBoardId;
          win.window.projectService = projectService;
          if (window._loadWikis) {
            win.window._parentLoadWikis = window._loadWikis;
          }
        });
      } catch (err) {
        alert("Failed to open Agent Demo Playground: " + err.message);
      }
    });
  }

  // Step 6: Wire up the settings cog dropdown menu toggler
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsDropdown = document.getElementById("settingsDropdown");
  if (settingsBtn && settingsDropdown) {
    settingsBtn.addEventListener("click", (e) => {
      // e.stopPropagation() prevents this click event from triggering the document-wide click listener below,
      // which would immediately close the menu we just tried to open.
      e.stopPropagation();
      const isHidden = (settingsDropdown.style.display === "none" || settingsDropdown.style.display === "");
      settingsDropdown.style.display = isHidden ? "flex" : "none";
    });

    // Close the dropdown immediately if the user clicks anywhere outside the settings button or dropdown box.
    document.addEventListener("click", (e) => {
      if (!settingsBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
        settingsDropdown.style.display = "none";
      }
    });
  }

  // Step 7: Wire up the About dialog modal popups
  const aboutBtn = document.getElementById("aboutBtn");
  const aboutModal = document.getElementById("aboutModal");
  const closeAboutBtn = document.getElementById("closeAboutBtn");

  if (aboutBtn && aboutModal && closeAboutBtn) {
    aboutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (settingsDropdown) settingsDropdown.style.display = "none"; // Hide settings cog dropdown
      aboutModal.style.display = "flex"; // Render the About Modal overlay overlaying the screen
    });

    // Close on Close button click
    closeAboutBtn.addEventListener("click", () => {
      aboutModal.style.display = "none";
    });

    // Close if the user clicks outside the modal box boundary onto the semi-transparent black backdrop mask.
    aboutModal.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.style.display = "none";
      }
    });
  }

  // Step 8: Setup Sidebar Panel collapse buttons and save status locally
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const unifiedSidebar = document.getElementById("unifiedSidebar");

  const path = require("path");
  const fs = require("fs");
  const nw = window.nw || require("nw.gui");
  
  // Locate a safe directory in the OS for setting database files
  const settingsPath = path.join(nw.App.dataPath, "bazaar-settings.json");

  // Save collapse settings so if a user restarts the app, their preference (e.g. sidebar open or closed) is remembered.
  const saveSidebarState = (collapsed) => {
    try {
      let settings = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      }
      settings.sidebarCollapsed = collapsed;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to save sidebar settings:", e);
    }
  };

  if (toggleSidebarBtn && unifiedSidebar) {
    toggleSidebarBtn.addEventListener("click", () => {
      const isCollapsed = unifiedSidebar.classList.toggle("collapsed");
      console.log("[User Event] Clicked toggle sidebar. Collapsed state:", isCollapsed);
      saveSidebarState(isCollapsed);
    });
  }

  if (closeSidebarBtn && unifiedSidebar) {
    closeSidebarBtn.addEventListener("click", () => {
      console.log("[User Event] Clicked close sidebar.");
      unifiedSidebar.classList.add("collapsed");
      saveSidebarState(true);
    });
  }

  // Step 9: Setup Resizable Sidebar Option 1
  const resizer = document.getElementById("sidebarResizer");
  
  if (resizer && unifiedSidebar) {
    const initSidebarWidth = () => {
      try {
        let settings = {};
        if (fs.existsSync(settingsPath)) {
          settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        }
        if (settings.sidebarWidth) {
          unifiedSidebar.style.width = settings.sidebarWidth + "px";
          return;
        }
      } catch (e) {
        console.error("Failed to load saved sidebar width:", e);
      }
      
      // Default setup: start with the sidebar at 35% of the available starting window width
      const startingWidth = Math.round(window.innerWidth * 0.35);
      unifiedSidebar.style.width = startingWidth + "px";
    };

    // Initialize width
    initSidebarWidth();

    // Mouse drag resize listeners
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      
      // Temporarily disable CSS transitions during active dragging to avoid movement lag
      unifiedSidebar.classList.add("resizing");
      resizer.classList.add("resizing");

      const startX = e.clientX;
      const startWidth = unifiedSidebar.getBoundingClientRect().width;

      const doDrag = (moveEvt) => {
        const newWidth = startWidth + (moveEvt.clientX - startX);
        // Constrain width bounds to keep sidebar between 200px and 60% of window width
        if (newWidth > 200 && newWidth < window.innerWidth * 0.6) {
          unifiedSidebar.style.width = newWidth + "px";
        }
      };

      const stopDrag = () => {
        // Restore transitions
        unifiedSidebar.classList.remove("resizing");
        resizer.classList.remove("resizing");

        window.removeEventListener("mousemove", doDrag);
        window.removeEventListener("mouseup", stopDrag);

        // Save width setting to persistent database file bazaar-settings.json
        try {
          const finalWidth = unifiedSidebar.getBoundingClientRect().width;
          let settings = {};
          if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
          }
          settings.sidebarWidth = Math.round(finalWidth);
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
        } catch (saveErr) {
          console.error("Failed to save sidebar width settings:", saveErr);
        }
      };

      window.addEventListener("mousemove", doDrag);
      window.addEventListener("mouseup", stopDrag);
    });
  }
}

// ─── Load Monitor Toggles ──────────────────────────────────────────────────
// Ensures we only boot after the browser DOM structure is fully loaded into memory.
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

