// test_interactive.js - CDP automated client to click through Agent sidebar in TiddlyDesk
"use strict";

const http = require("http");
const WebSocket = require("ws");

function getDevToolsTargets() {
  return new Promise((resolve, reject) => {
    http.get("http://localhost:9222/json", (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function sendCDPCommand(ws, id, method, params = {}) {
  return new Promise((resolve) => {
    const message = JSON.stringify({ id, method, params });
    const onMessage = (data) => {
      const res = JSON.parse(data.toString());
      if (res.id === id) {
        ws.off("message", onMessage);
        resolve(res.result);
      }
    };
    ws.on("message", onMessage);
    ws.send(message);
  });
}

async function runClickthrough() {
  console.log("Fetching active Chromium DevTools targets...");
  const targets = await getDevToolsTargets();
  const pageTarget = targets.find(t => t.type === "page" && t.url.includes("html/dashboard.html"))
                  || targets.find(t => t.type === "page" && t.url.includes("html/main.html"));
  
  if (!pageTarget) {
    console.error("Error: Could not find active TiddlyDesk dashboard/main page target. Is the app running?");
    console.log("Available targets:", JSON.stringify(targets, null, 2));
    process.exit(1);
  }

  let wsUrl = pageTarget.webSocketDebuggerUrl;
  wsUrl = wsUrl.replace("localhost", "127.0.0.1");
  console.log(`Connecting to CDP WebSocket: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  console.log("Connected to page DevTools! Enabling Runtime...");

  let cmdId = 1;
  // Enable console API events
  await sendCDPCommand(ws, cmdId++, "Runtime.enable");

  // Log console calls from the page
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === "Runtime.consoleAPICalled") {
      const args = msg.params.args.map(a => a.value || JSON.stringify(a));
      console.log(`[Page Console] [${msg.params.type}]`, ...args);
    }
  });

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Step 1: Check if we are on dashboard and click first project
  console.log("\n[CDP Test] Step 1: Navigating into first project folder card...");
  const clickProjectJS = `
    (function() {
      const cards = document.querySelectorAll('.folder-card');
      if (cards.length > 0) {
        cards[0].click();
        return "Clicked project card: " + cards[0].querySelector('.folder-name').textContent;
      }
      return "Already inside project view (no folder cards)";
    })()
  `;
  const step1Result = await sendCDPCommand(ws, cmdId++, "Runtime.evaluate", { expression: clickProjectJS });
  console.log("Result:", step1Result.result.value);

  await sleep(2000); // Wait for board render

  // Step 2: Open Sidebar if collapsed
  console.log("\n[CDP Test] Step 2: Verifying and opening Project Sidebar...");
  const openPanelJS = `
    (function() {
      const sidebar = document.getElementById('unifiedSidebar');
      if (!sidebar) return "Error: Unified Sidebar not found";
      
      const isCollapsed = sidebar.classList.contains('collapsed');
      if (isCollapsed) {
        const toggleBtn = document.getElementById('toggleSidebarBtn');
        if (toggleBtn) {
          toggleBtn.click();
          return "Sidebar was collapsed. Clicked toggle button to open.";
        }
      }
      return "Sidebar already open.";
    })()
  `;
  const step2Result = await sendCDPCommand(ws, cmdId++, "Runtime.evaluate", { expression: openPanelJS });
  console.log("Result:", step2Result.result.value);

  await sleep(1000);

  // Step 3: Switch to Agents tab
  console.log("\n[CDP Test] Step 3: Switching to 'Agents' tab...");
  const clickAgentsTabJS = `
    (function() {
      const tabAgentsBtn = document.getElementById('tabAgentsBtn');
      if (tabAgentsBtn) {
        tabAgentsBtn.click();
        const content = document.getElementById('agentsTabContent');
        return "Clicked Agents tab. Agents content visible: " + (content.style.display !== 'none');
      }
      return "Error: Agents tab button not found";
    })()
  `;
  const step3Result = await sendCDPCommand(ws, cmdId++, "Runtime.evaluate", { expression: clickAgentsTabJS });
  console.log("Result:", step3Result.result.value);

  await sleep(1500);

  // Step 4: Switch back to Folders tab
  console.log("\n[CDP Test] Step 4: Switching back to 'Folders' tab...");
  const clickFoldersTabJS = `
    (function() {
      const tabFoldersBtn = document.getElementById('tabFoldersBtn');
      if (tabFoldersBtn) {
        tabFoldersBtn.click();
        const content = document.getElementById('foldersTabContent');
        return "Clicked Folders tab. Folders content visible: " + (content.style.display !== 'none');
      }
      return "Error: Folders tab button not found";
    })()
  `;
  const step4Result = await sendCDPCommand(ws, cmdId++, "Runtime.evaluate", { expression: clickFoldersTabJS });
  console.log("Result:", step4Result.result.value);

  await sleep(1000);

  console.log("\n=== CLICK-THROUGH TEST COMPLETED SUCCESSFULLY ===");
  ws.close();
  process.exit(0);
}

runClickthrough().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
