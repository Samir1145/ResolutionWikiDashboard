// rag.service.js – Local RAG Search and Indexing Engine for TiddlyDesk
"use strict";

const fs = require("fs");
const path = require("path");
const { pipeline, env } = require("@xenova/transformers");

// Determine local application data directory for caching models
const nw = (typeof window !== "undefined" && window.nw) || (typeof global !== "undefined" && global.nw);
const dataPath = nw ? nw.App.dataPath : process.cwd();
const cachePath = path.join(dataPath, "transformers-cache");

// Configure local Transformers.js environment with SIMD and Multi-threading
env.cacheDir = cachePath;
env.backends.onnx.wasm.numThreads = 4;
env.backends.onnx.wasm.simd = true;

// Custom LangChain-like Embeddings adapter for local ONNX inference
class TransformersEmbeddings {
  constructor() {
    this.pipelinePromise = null;
  }

  async getPipeline() {
    if (!this.pipelinePromise) {
      this.pipelinePromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return this.pipelinePromise;
  }

  async embedDocuments(texts) {
    const extractor = await this.getPipeline();
    const result = [];
    for (const text of texts) {
      const output = await extractor(text, { pooling: "mean", normalize: true });
      result.push(Array.from(output.data));
    }
    return result;
  }

  async embedQuery(text) {
    const extractor = await this.getPipeline();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}

// Custom Character Text Splitter to replace LangChain dependency
class SimpleTextSplitter {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 600;
    this.chunkOverlap = options.chunkOverlap || 100;
  }

  async splitText(text) {
    const chunks = [];
    if (!text) return chunks;

    let index = 0;
    while (index < text.length) {
      let end = index + this.chunkSize;
      if (end >= text.length) {
        chunks.push(text.substring(index).trim());
        break;
      }

      // Find breaking space/newline
      let breakPoint = text.lastIndexOf(" ", end);
      if (breakPoint === -1 || breakPoint <= index) {
        breakPoint = text.lastIndexOf("\n", end);
      }
      if (breakPoint > index && breakPoint < end + 50) {
        end = breakPoint;
      }

      chunks.push(text.substring(index, end).trim());
      index = end - this.chunkOverlap;
      if (index < 0 || index >= text.length) break;
    }
    return chunks.filter(c => c.length > 0);
  }
}

// Vector Dot Product for Cosine Similarity (vectors from Transformers.js are normalized)
function dotProduct(vecA, vecB) {
  let dot = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

// Strip HTML markup and Tiddler metadata headers
function stripHtmlAndTid(content) {
  let clean = content;
  // If it's a Tiddler file, strip headers
  if (content.includes("title:") && content.includes("\n\n")) {
    const doubleNewlineIndex = content.indexOf("\n\n");
    if (doubleNewlineIndex !== -1) {
      clean = content.substring(doubleNewlineIndex + 2);
    }
  }
  // Remove script and style tags completely
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, "");
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove other HTML tags
  clean = clean.replace(/<[^>]+>/g, " ");
  // Normalize whitespace
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

// Recursively scan project folder for queryable text formats
function scanFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file.startsWith(".") || file === "node_modules" || file.endsWith(".wiki")) {
      continue;
    }
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }
    if (stat.isDirectory()) {
      results = results.concat(scanFiles(fullPath));
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (ext === ".html" || ext === ".htm" || ext === ".tid" || ext === ".txt" || ext === ".md") {
        results.push({
          filePath: fullPath,
          mtime: stat.mtimeMs
        });
      }
    }
  }
  return results;
}

// Load project RAG index
function loadIndex(projectPath) {
  const indexPath = path.join(projectPath, ".tiddlydesk-rag", "embeddings.json");
  if (fs.existsSync(indexPath)) {
    try {
      const raw = fs.readFileSync(indexPath, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      console.error("[RAG] Failed to parse existing embeddings index, restarting:", e);
    }
  }
  return { projectPath, lastUpdated: 0, memoryVectors: [] };
}

// Ingest documents and calculate vectors locally
async function indexProject(projectPath, progressCallback) {
  console.log("[RAG] Starting incremental index scan for:", projectPath);
  
  // Ensure hidden RAG directory exists
  const ragDir = path.join(projectPath, ".tiddlydesk-rag");
  const ragDocsDir = path.join(ragDir, "documents");
  if (!fs.existsSync(ragDocsDir)) {
    fs.mkdirSync(ragDocsDir, { recursive: true });
  }

  const indexData = loadIndex(projectPath);
  const existingVectors = indexData.memoryVectors || [];

  // 1. Scan the filesystem (recursively, automatically skips files/folders starting with '.')
  const currentFiles = scanFiles(projectPath);
  
  // Also scan the project-isolated RAG-specific documents folder
  if (fs.existsSync(ragDocsDir)) {
    const list = fs.readdirSync(ragDocsDir);
    for (const file of list) {
      if (file.startsWith(".")) continue;
      const fullPath = path.join(ragDocsDir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (ext === ".html" || ext === ".htm" || ext === ".tid" || ext === ".txt" || ext === ".md") {
          currentFiles.push({
            filePath: fullPath,
            mtime: stat.mtimeMs
          });
        }
      }
    }
  }

  const currentFilePaths = new Set(currentFiles.map(f => f.filePath));

  // 2. Vector Garbage Collection
  let updatedVectors = existingVectors.filter(vec => {
    return currentFilePaths.has(vec.metadata.source);
  });

  const indexMtimes = {};
  updatedVectors.forEach(vec => {
    const src = vec.metadata.source;
    const mtime = vec.metadata.mtime || 0;
    if (!indexMtimes[src] || mtime > indexMtimes[src]) {
      indexMtimes[src] = mtime;
    }
  });

  // 3. Identify new or modified files
  const filesToProcess = currentFiles.filter(file => {
    const lastMtime = indexMtimes[file.filePath] || 0;
    return file.mtime > lastMtime;
  });

  // If nothing changed, return early
  if (filesToProcess.length === 0 && updatedVectors.length === existingVectors.length) {
    console.log("[RAG] Index is already up-to-date.");
    if (progressCallback) progressCallback(1.0);
    return indexData;
  }

  console.log(`[RAG] Re-indexing ${filesToProcess.length} new/modified files. Total indexed files: ${currentFiles.length}`);

  // Purge old chunks for modified files
  const pathsToOverwrite = new Set(filesToProcess.map(f => f.filePath));
  updatedVectors = updatedVectors.filter(vec => !pathsToOverwrite.has(vec.metadata.source));

  const embeddings = new TransformersEmbeddings();
  const textSplitter = new SimpleTextSplitter({
    chunkSize: 600,
    chunkOverlap: 100
  });

  let processedCount = 0;
  for (const file of filesToProcess) {
    try {
      if (progressCallback && filesToProcess.length > 0) {
        progressCallback((processedCount / filesToProcess.length) * 0.95);
      }

      const content = fs.readFileSync(file.filePath, "utf8");
      const cleanText = stripHtmlAndTid(content);
      if (!cleanText) continue;

      const chunks = await textSplitter.splitText(cleanText);
      if (chunks.length === 0) continue;

      const vectors = await embeddings.embedDocuments(chunks);

      chunks.forEach((chunkText, idx) => {
        updatedVectors.push({
          id: `${path.basename(file.filePath)}_${Date.now()}_${idx}`,
          content: chunkText,
          embedding: vectors[idx],
          metadata: {
            source: file.filePath,
            mtime: file.mtime
          }
        });
      });
    } catch (err) {
      console.error(`[RAG] Failed to index ${file.filePath}:`, err);
    }
    processedCount++;
  }

  indexData.memoryVectors = updatedVectors;
  indexData.lastUpdated = Date.now();

  const indexPath = path.join(projectPath, ".tiddlydesk-rag", "embeddings.json");
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), "utf8");
  console.log("[RAG] Indexing completed and written to:", indexPath);

  if (progressCallback) progressCallback(1.0);
  return indexData;
}

// Perform hybrid semantic and substring keyword search
async function hybridSearch(projectPath, query, k = 4) {
  const indexData = loadIndex(projectPath);
  const memoryVectors = indexData.memoryVectors || [];
  if (memoryVectors.length === 0) {
    return [];
  }

  const embeddings = new TransformersEmbeddings();
  const queryEmbedding = await embeddings.embedQuery(query);

  // 1. Run Semantic Similarity search
  const semanticResults = memoryVectors.map(vec => {
    const score = dotProduct(queryEmbedding, vec.embedding);
    return {
      pageContent: vec.content,
      metadata: vec.metadata,
      id: vec.id,
      score
    };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, k);

  // 2. Run Substring Keyword search
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const keywordResults = [];

  if (queryTerms.length > 0) {
    const scoredVectors = memoryVectors.map(vec => {
      let matches = 0;
      const lowerContent = vec.content.toLowerCase();
      queryTerms.forEach(term => {
        if (lowerContent.includes(term)) matches++;
      });
      return { vec, matches };
    });

    const keywordMatches = scoredVectors
      .filter(x => x.matches > 0)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, k)
      .map(x => ({
        pageContent: x.vec.content,
        metadata: x.vec.metadata,
        id: x.vec.id,
        score: x.matches
      }));

    keywordResults.push(...keywordMatches);
  }

  // 3. Merge and deduplicate
  const merged = [...semanticResults];
  const uniqueContents = new Set(merged.map(d => d.pageContent));

  for (const doc of keywordResults) {
    if (!uniqueContents.has(doc.pageContent)) {
      merged.push(doc);
      uniqueContents.add(doc.pageContent);
    }
  }

  return merged.slice(0, k);
}

// Core RAG query and LLM interface
async function queryRAG(projectPath, query, onProgress) {
  if (onProgress) onProgress("⚡ Retrieving local file contexts...");
  const contextDocs = await hybridSearch(projectPath, query, 4);

  if (contextDocs.length === 0) {
    return {
      answer: "No indexed documents found in this project. Please add some files to the project folder first.",
      sources: []
    };
  }

  // Build context
  const contextText = contextDocs.map((doc, idx) => {
    const filename = path.basename(doc.metadata.source);
    return `[Document: ${filename}]\n${doc.pageContent}`;
  }).join("\n\n");

  const systemPrompt = `You are a professional assistant analyzing local documents.
Answer the User Query using the provided retrieved context documents.
If the answer cannot be found in the context, output exactly: "No relevant local records found for this question."
Do not make up information or references. Keep the answer clear and well-structured.

Retrieved Context:
${contextText}`;

  if (onProgress) onProgress("🔄 Ingesting context into local Llamafile...");

  try {
    const response = await fetch("http://localhost:8080/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llm",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Llamafile returned error status: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;
    const sources = [...new Set(contextDocs.map(d => path.basename(d.metadata.source)))];

    return {
      answer,
      sources
    };
  } catch (err) {
    console.error("[RAG] Llamafile API error:", err);
    throw err;
  }
}

// Semantic ranker for sorting Kanban board files
async function rankDocumentsByRelevance(projectPath, query) {
  const indexData = loadIndex(projectPath);
  const memoryVectors = indexData.memoryVectors || [];
  if (memoryVectors.length === 0) {
    return [];
  }

  const embeddings = new TransformersEmbeddings();
  const queryEmbedding = await embeddings.embedQuery(query);

  // Group top similarities by source document path
  const fileScores = {};
  memoryVectors.forEach(vec => {
    const similarity = dotProduct(queryEmbedding, vec.embedding);
    const src = vec.metadata.source;
    if (!fileScores[src] || similarity > fileScores[src]) {
      fileScores[src] = similarity;
    }
  });

  return Object.entries(fileScores)
    .sort((a, b) => b[1] - a[1])
    .map(x => ({
      filePath: x[0],
      score: x[1]
    }));
}

module.exports = {
  indexProject,
  queryRAG,
  rankDocumentsByRelevance
};
