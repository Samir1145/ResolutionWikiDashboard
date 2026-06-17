// test_rag.js - Automated tests for local RAG engine in TiddlyDesk
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Intercept require system to mock @xenova/transformers completely
const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "@xenova/transformers") {
    console.log("[Mock] Intercepting require('@xenova/transformers')");
    return {
      env: {
        backends: {
          onnx: {
            wasm: {
              numThreads: 1,
              simd: false
            }
          }
        }
      },
      pipeline: async (task, model) => {
        console.log(`[Mock Pipeline] Intercepted loading of task: ${task}, model: ${model}`);
        const extractor = async (text, options) => {
          const size = 384;
          const data = new Float32Array(size);
          for (let i = 0; i < size; i++) {
            data[i] = 0.05; // background baseline
          }
          // Set distinct dimensions based on keyword to model semantic search realistically
          if (text.includes("Kanban") || text.includes("tool")) {
            data[0] = 0.9;
          } else if (text.includes("Llamafile") || text.includes("AI server")) {
            data[1] = 0.9;
          } else if (text.includes("embeddings") || text.includes("MyTiddler")) {
            data[2] = 0.9;
          }
          return { data };
        };
        return extractor;
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Import the service
const ragService = require("./source/js/dashboard/rag_internal");

// Mock window.nw App dataPath if not available
if (!global.nw) {
  global.nw = {
    App: {
      dataPath: path.join(__dirname, "test-nw-data")
    }
  };
}
if (!fs.existsSync(global.nw.App.dataPath)) {
  fs.mkdirSync(global.nw.App.dataPath, { recursive: true });
}

// Mock global fetch for testing queryRAG offline
global.fetch = async (url, options) => {
  if (url === "http://localhost:8080/v1/chat/completions") {
    const body = JSON.parse(options.body);
    const systemPrompt = body.messages.find(m => m.role === "system").content;
    const userQuery = body.messages.find(m => m.role === "user").content;

    assert.ok(systemPrompt.includes("Retrieved Context:"), "System prompt should contain context");
    assert.ok(systemPrompt.includes("Llamafile is a local AI server"), "Should have retrieved file2 context");

    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `MOCKED_RESPONSE: Llamafile is a local AI server running on port 8080. Query asked: ${userQuery}`
            }
          }
        ]
      })
    };
  }
  return { ok: false };
};

const testWorkspace = path.join(__dirname, "_test_rag_workspace");

async function runTests() {
  console.log("=== STARTING LOCAL RAG TESTS ===");

  // Setup test environment
  if (fs.existsSync(testWorkspace)) {
    fs.rmSync(testWorkspace, { recursive: true, force: true });
  }
  fs.mkdirSync(testWorkspace);

  const file1Path = path.join(testWorkspace, "file1.txt");
  const file2Path = path.join(testWorkspace, "file2.html");
  const file3Path = path.join(testWorkspace, "file3.tid");

  // Create content that is sufficiently different so that vector similarity behaves predictably
  fs.writeFileSync(file1Path, "TiddlyDesk is an offline personal notebook and Kanban project management tool.", "utf8");
  fs.writeFileSync(file2Path, "<html><body><h1>Llamafile Server</h1><p>Llamafile is a local AI server running LLMs entirely offline on port 8080.</p></body></html>", "utf8");
  fs.writeFileSync(file3Path, "title: MyTiddler\nmodifier: Atul\n\nThis is a standard tiddler file containing information about Transformers.js vector embeddings.", "utf8");

  // Test 1: Incremental Indexing
  console.log("\n[Test 1] Running Indexing...");
  let progressCount = 0;
  const indexData = await ragService.indexProject(testWorkspace, (progress) => {
    progressCount++;
    console.log(`Indexing progress: ${Math.round(progress * 100)}%`);
  });

  assert.ok(progressCount > 0, "Progress callback should have been called");
  assert.ok(fs.existsSync(path.join(testWorkspace, ".tiddlydesk-rag", "embeddings.json")), "Embeddings index file should be created");
  
  const savedIndex = JSON.parse(fs.readFileSync(path.join(testWorkspace, ".tiddlydesk-rag", "embeddings.json"), "utf8"));
  assert.strictEqual(savedIndex.memoryVectors.length, 3, "Should index exactly 3 files");

  // Verify vector dimensions
  const dimensions = savedIndex.memoryVectors[0].embedding.length;
  console.log(`Computed embedding dimensions: ${dimensions}`);
  assert.strictEqual(dimensions, 384, "Transformers.js embeddings must be 384 dimensions");

  // Test 2: Hybrid Query
  console.log("\n[Test 2] Querying RAG...");
  const queryResult = await ragService.queryRAG(testWorkspace, "Tell me about Llamafile");
  console.log("RAG Answer:", queryResult.answer);
  console.log("Sources:", queryResult.sources);

  assert.ok(queryResult.answer.includes("MOCKED_RESPONSE"), "Should return the mocked response");
  assert.ok(queryResult.sources.includes("file2.html"), "Sources should attribute file2.html");

  // Test 3: Semantic Board Sorting
  console.log("\n[Test 3] Semantic Ranking...");
  const ranked = await ragService.rankDocumentsByRelevance(testWorkspace, "Kanban tool");
  console.log("Ranked Results:", ranked);
  assert.ok(ranked.length > 0, "Should rank files");
  assert.ok(ranked[0].filePath.endsWith("file1.txt"), "file1.txt should rank first for Kanban tool query");

  // Test 4: Garbage Collection
  console.log("\n[Test 4] Testing Garbage Collection...");
  fs.unlinkSync(file1Path); // Delete file1.txt

  await ragService.indexProject(testWorkspace);
  const updatedIndex = JSON.parse(fs.readFileSync(path.join(testWorkspace, ".tiddlydesk-rag", "embeddings.json"), "utf8"));
  
  const indexSources = updatedIndex.memoryVectors.map(v => path.basename(v.metadata.source));
  assert.ok(!indexSources.includes("file1.txt"), "Garbage collector should have purged file1.txt vectors");
  assert.strictEqual(updatedIndex.memoryVectors.length, 2, "Should have 2 files remaining in index");

  console.log("\n=== ALL RAG TESTS PASSED SUCCESSFULLY! ===");
}

runTests()
  .then(() => {
    // Cleanup
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    const nwCache = path.join(__dirname, "test-nw-data");
    if (fs.existsSync(nwCache)) {
      fs.rmSync(nwCache, { recursive: true, force: true });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("\n!!! RAG TEST FAILED !!!", err);
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    process.exit(1);
  });
