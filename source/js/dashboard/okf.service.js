// okf.service.js – Local Ingestion Pipeline to build the OKF Catalog
"use strict";

const fs = require("fs");
const path = require("path");
const utils = require("./agent/utils");

const TAG = "[OKFSvc]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

// ─── Helper Functions ────────────────────────────────────────────────────────

// Find all HTML report files recursively, skipping hidden folders/tiddlers
function findHtmlReports(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  let items;
  try {
    items = fs.readdirSync(dir);
  } catch (e) {
    return results;
  }
  for (const item of items) {
    if (item.startsWith(".") || item === "node_modules" || item === "tiddlers") {
      continue;
    }
    const fullPath = path.join(dir, item);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        // Skip TiddlyWiki folders so we don't treat them as raw report folders
        if (fs.existsSync(path.join(fullPath, "tiddlywiki.info"))) {
          continue;
        }
        findHtmlReports(fullPath, results);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (ext === ".html" || ext === ".htm") {
          results.push(fullPath);
        }
      }
    } catch (e) {}
  }
  return results;
}

// Find all TiddlyWiki directories recursively
function findWikiFolders(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  let items;
  try {
    items = fs.readdirSync(dir);
  } catch (e) {
    return results;
  }
  for (const item of items) {
    if (item.startsWith(".") || item === "node_modules") {
      continue;
    }
    const fullPath = path.join(dir, item);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (fs.existsSync(path.join(fullPath, "tiddlywiki.info"))) {
          results.push(fullPath);
        } else {
          findWikiFolders(fullPath, results);
        }
      }
    } catch (e) {}
  }
  return results;
}

// Find all tiddlers in a TiddlyWiki folder
function findTiddlerFiles(tiddlersDir, results = []) {
  if (!fs.existsSync(tiddlersDir)) return results;
  let items;
  try {
    items = fs.readdirSync(tiddlersDir);
  } catch (e) {
    return results;
  }
  for (const item of items) {
    const fullPath = path.join(tiddlersDir, item);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findTiddlerFiles(fullPath, results);
      } else if (stat.isFile() && /\.(tid|txt|md)$/i.test(item)) {
        results.push(fullPath);
      }
    } catch (e) {}
  }
  return results;
}

// Parse TiddlyWiki .tid header block and body
function parseTidFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const headers = {};
  let bodyStartLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      bodyStartLine = i + 1;
      break;
    }
    const match = line.match(/^([\w\-]+):\s*(.*)$/);
    if (match) {
      headers[match[1]] = match[2].trim();
    }
  }
  const body = lines.slice(bodyStartLine).join("\n");
  return { headers, body };
}

// ─── Main Ingest Pipeline ────────────────────────────────────────────────────

function ingestProject(projectPath) {
  dbg("ingestProject starting for:", projectPath);
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project directory does not exist: ${projectPath}`);
  }

  const okfDir = path.join(projectPath, ".tiddlydesk-okf");
  const wikiDir = path.join(okfDir, "wiki");
  const reportsDir = path.join(wikiDir, "reports");
  const tiddlersDir = path.join(wikiDir, "tiddlers");
  const docsDir = path.join(wikiDir, "documents");

  // Ensure directories exist
  [okfDir, wikiDir, reportsDir, tiddlersDir, docsDir].forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });

  // Load manifest.json to check file mtimes
  const manifestPath = path.join(okfDir, "manifest.json");
  let manifest = { lastIngested: null, files: {} };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) || { lastIngested: null, files: {} };
    } catch (e) {
      dbgErr("Failed to parse existing manifest.json:", e.message);
    }
  }

  const newManifestFiles = {};
  const wikiCatalog = {
    reports: [],
    tiddlers: [],
    documents: []
  };

  // 1. Ingest HTML Reports
  const reports = findHtmlReports(projectPath);
  dbg(`Found ${reports.length} HTML reports`);
  reports.forEach(r => {
    const rel = path.relative(projectPath, r);
    const stat = fs.statSync(r);
    const mtime = stat.mtimeMs;
    const okfFileName = rel.replace(/[^a-zA-Z0-9_\-]/g, "_") + ".md";
    const destPath = path.join(reportsDir, okfFileName);

    let needsIngest = true;
    if (manifest.files[rel] && manifest.files[rel].mtime === mtime && fs.existsSync(destPath)) {
      needsIngest = false;
      newManifestFiles[rel] = manifest.files[rel];
    }

    if (needsIngest) {
      try {
        dbg(`Ingesting HTML report: ${rel}`);
        const raw = fs.readFileSync(r, "utf8");
        const cleanText = utils.stripHtml(raw);
        const title = path.basename(r);
        const frontmatter = `---
title: ${JSON.stringify(title)}
type: "report"
source: ${JSON.stringify(rel)}
last_modified: ${JSON.stringify(stat.mtime.toISOString())}
tags: ["report"]
---
${cleanText}
`;
        fs.writeFileSync(destPath, frontmatter, "utf8");
        newManifestFiles[rel] = { mtime, okfPath: path.relative(okfDir, destPath), title };
      } catch (err) {
        dbgErr(`Failed to ingest report: ${rel}`, err.message);
      }
    }

    if (newManifestFiles[rel]) {
      wikiCatalog.reports.push(newManifestFiles[rel]);
    }
  });

  // 2. Ingest Tiddlers from TiddlyWiki folders
  const wikis = findWikiFolders(projectPath);
  dbg(`Found ${wikis.length} TiddlyWiki directories`);
  wikis.forEach(wikiFolder => {
    const tiddlersFolderPath = path.join(wikiFolder, "tiddlers");
    const tidFiles = findTiddlerFiles(tiddlersFolderPath);
    dbg(`Found ${tidFiles.length} tiddler files in ${path.basename(wikiFolder)}`);

    tidFiles.forEach(f => {
      const rel = path.relative(projectPath, f);
      const stat = fs.statSync(f);
      const mtime = stat.mtimeMs;
      const okfFileName = rel.replace(/[^a-zA-Z0-9_\-]/g, "_") + ".md";
      const destPath = path.join(tiddlersDir, okfFileName);

      let needsIngest = true;
      if (manifest.files[rel] && manifest.files[rel].mtime === mtime && fs.existsSync(destPath)) {
        needsIngest = false;
        newManifestFiles[rel] = manifest.files[rel];
      }

      if (needsIngest) {
        try {
          if (f.endsWith(".tid")) {
            const { headers, body } = parseTidFile(f);
            const title = headers.title || path.basename(f, ".tid");
            
            // Skip system tiddlers
            if (title.startsWith("$:/")) {
              return;
            }

            const tags = (headers.tags || "").split(" ").filter(t => t.trim() !== "");
            const frontmatter = `---
title: ${JSON.stringify(title)}
type: "tiddler"
source: ${JSON.stringify(rel)}
last_modified: ${JSON.stringify(stat.mtime.toISOString())}
tags: ${JSON.stringify(tags)}
---
${body}
`;
            fs.writeFileSync(destPath, frontmatter, "utf8");
            newManifestFiles[rel] = { mtime, okfPath: path.relative(okfDir, destPath), title };
          } else {
            // txt or md file inside tiddlers
            const body = fs.readFileSync(f, "utf8");
            const title = path.basename(f);
            const frontmatter = `---
title: ${JSON.stringify(title)}
type: "tiddler"
source: ${JSON.stringify(rel)}
last_modified: ${JSON.stringify(stat.mtime.toISOString())}
tags: []
---
${body}
`;
            fs.writeFileSync(destPath, frontmatter, "utf8");
            newManifestFiles[rel] = { mtime, okfPath: path.relative(okfDir, destPath), title };
          }
        } catch (err) {
          dbgErr(`Failed to ingest tiddler: ${rel}`, err.message);
        }
      }

      if (newManifestFiles[rel]) {
        wikiCatalog.tiddlers.push(newManifestFiles[rel]);
      }
    });
  });

  // 3. Ingest Uploaded Documents from .tiddlydesk-rag/documents/
  const oldRagDocsDir = path.join(projectPath, ".tiddlydesk-rag", "documents");
  if (fs.existsSync(oldRagDocsDir)) {
    dbg("Found legacy RAG documents folder. Migrating to OKF.");
    let docs;
    try {
      docs = fs.readdirSync(oldRagDocsDir);
    } catch (e) {
      docs = [];
    }

    docs.forEach(doc => {
      if (doc.startsWith(".")) return;
      const fullPath = path.join(oldRagDocsDir, doc);
      const rel = path.relative(projectPath, fullPath);
      const stat = fs.statSync(fullPath);
      const mtime = stat.mtimeMs;
      const okfFileName = doc.replace(/[^a-zA-Z0-9_\-]/g, "_") + ".md";
      const destPath = path.join(docsDir, okfFileName);

      let needsIngest = true;
      if (manifest.files[rel] && manifest.files[rel].mtime === mtime && fs.existsSync(destPath)) {
        needsIngest = false;
        newManifestFiles[rel] = manifest.files[rel];
      }

      if (needsIngest) {
        try {
          const raw = fs.readFileSync(fullPath, "utf8");
          const cleanText = utils.stripHtml(raw); // strip HTML if any
          const frontmatter = `---
title: ${JSON.stringify(doc)}
type: "document"
source: ${JSON.stringify(rel)}
last_modified: ${JSON.stringify(stat.mtime.toISOString())}
tags: ["document"]
---
${cleanText}
`;
          fs.writeFileSync(destPath, frontmatter, "utf8");
          newManifestFiles[rel] = { mtime, okfPath: path.relative(okfDir, destPath), title: doc };
        } catch (err) {
          dbgErr(`Failed to ingest uploaded doc: ${rel}`, err.message);
        }
      }

      if (newManifestFiles[rel]) {
        wikiCatalog.documents.push(newManifestFiles[rel]);
      }
    });
  }

  // 4. Generate catalog index.md page
  const indexLines = [
    "# Case Open Knowledge Catalog Index",
    "",
    "Welcome to the Case Catalog. Below is the auto-generated index of all report cards, tiddlers, and user-uploaded files parsed into OKF Markdown.",
    ""
  ];

  if (wikiCatalog.reports.length > 0) {
    indexLines.push("## 📂 Converted Reports");
    indexLines.push("");
    wikiCatalog.reports.forEach(r => {
      indexLines.push(`- [${r.title}](${r.okfPath})`);
    });
    indexLines.push("");
  }

  if (wikiCatalog.tiddlers.length > 0) {
    indexLines.push("## 🤖 User Tiddlers");
    indexLines.push("");
    wikiCatalog.tiddlers.forEach(r => {
      indexLines.push(`- [${r.title}](${r.okfPath})`);
    });
    indexLines.push("");
  }

  if (wikiCatalog.documents.length > 0) {
    indexLines.push("## 📄 Uploaded Documents");
    indexLines.push("");
    wikiCatalog.documents.forEach(r => {
      indexLines.push(`- [${r.title}](${r.okfPath})`);
    });
    indexLines.push("");
  }

  if (wikiCatalog.reports.length === 0 && wikiCatalog.tiddlers.length === 0 && wikiCatalog.documents.length === 0) {
    indexLines.push("*The catalog is empty. Please place reports, files, or tiddlers in your project directory.*");
  }

  const indexPath = path.join(okfDir, "index.md");
  fs.writeFileSync(indexPath, indexLines.join("\n"), "utf8");
  dbg("Wrote root index.md successfully.");

  // Save new manifest.json
  manifest.lastIngested = new Date().toISOString();
  manifest.files = newManifestFiles;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  dbg("Wrote manifest.json. Ingestion completed.");
}

module.exports = {
  ingestProject
};
