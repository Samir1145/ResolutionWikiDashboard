// rag.service.js – Lightweight wrapper to offload RAG calculations to a Node.js process to avoid Blink renderer crashes
"use strict";

const { spawn } = require("child_process");
const path = require("path");

function runBackgroundRag(config, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const runRagPath = path.join(__dirname, "../run_rag.js");
      const child = spawn("node", [runRagPath]);

      child.stdin.write(JSON.stringify(config));
      child.stdin.end();

      let stdoutData = "";
      let stderrData = "";

      child.stdout.on("data", (data) => {
        stdoutData += data.toString();
        const lines = stdoutData.split("\n");
        stdoutData = lines.pop(); // Keep partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const payload = JSON.parse(line);
            if (payload.type === "progress") {
              if (onProgress) {
                if (payload.progress !== undefined) {
                  onProgress(payload.progress);
                } else if (payload.message !== undefined) {
                  onProgress(payload.message);
                }
              }
            } else if (payload.type === "result") {
              resolve(payload.data);
            } else if (payload.type === "error") {
              reject(new Error(payload.message));
            }
          } catch (e) {
            // Log plain text console logs from background process cleanly
            console.log("[RAG Background]", line);
          }
        }
      });

      child.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderrData || `RAG background process exited with code ${code}`));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function indexProject(projectPath, progressCallback) {
  return runBackgroundRag({ action: "index", projectPath }, progressCallback);
}

function queryRAG(projectPath, query, onProgress) {
  return runBackgroundRag({ action: "query", projectPath, query }, onProgress);
}

function rankDocumentsByRelevance(projectPath, query) {
  return runBackgroundRag({ action: "rank", projectPath, query });
}

module.exports = {
  indexProject,
  queryRAG,
  rankDocumentsByRelevance
};
