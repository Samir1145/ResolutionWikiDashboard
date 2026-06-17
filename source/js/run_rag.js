// run_rag.js - Background process to run RAG search and indexing without crashing NW.js UI
"use strict";

const ragInternal = require("./dashboard/rag_internal");

// Read configuration from stdin
let inputData = "";
process.stdin.on("data", chunk => {
  inputData += chunk;
});

process.stdin.on("end", async () => {
  try {
    const config = JSON.parse(inputData);
    const { action, projectPath, query } = config;

    if (action === "index") {
      const result = await ragInternal.indexProject(projectPath, (progress) => {
        console.log(JSON.stringify({ type: "progress", progress }));
      });
      console.log(JSON.stringify({ type: "result", data: result }));
      process.exit(0);

    } else if (action === "query") {
      const result = await ragInternal.queryRAG(projectPath, query, (message) => {
        console.log(JSON.stringify({ type: "progress", message }));
      });
      console.log(JSON.stringify({ type: "result", data: result }));
      process.exit(0);

    } else if (action === "rank") {
      const result = await ragInternal.rankDocumentsByRelevance(projectPath, query);
      console.log(JSON.stringify({ type: "result", data: result }));
      process.exit(0);

    } else {
      throw new Error("Unknown action: " + action);
    }

  } catch (err) {
    console.log(JSON.stringify({ type: "error", message: err.message, stack: err.stack }));
    process.exit(1);
  }
});
