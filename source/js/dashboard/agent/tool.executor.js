// tool.executor.js - Agentic tool execution dispatcher
"use strict";

const fs = require("fs");
const path = require("path");
const utils = require("../utils/agent.utils");

const TAG = "[ToolExecutor]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

function executeTool(toolName, args, context) {
  dbg(`executeTool: "${toolName}", args:`, JSON.stringify(args).slice(0, 300));
  try {
    switch (toolName) {

      case "read_report": {
        let filePath = args.file_path;
        if (!filePath) {
          dbgErr("read_report called with no file_path!");
          return "Error: file_path argument is required for read_report";
        }
        // Automatically resolve relative wiki paths (e.g. wiki/reports/foo.md)
        if (!path.isAbsolute(filePath) && context.projectPath) {
          filePath = path.resolve(context.projectPath, ".tiddlydesk-okf", filePath);
        }
        context.log(`  📖 Reading: ${path.basename(filePath)}`);
        const content = utils.readReportContent(filePath);
        context.sourceFiles = context.sourceFiles || [];
        context.sourceFiles.push(filePath);
        dbg(`read_report done — ${content.length} chars`);
        return `[Content of ${path.basename(filePath)}]\n\n${content}`;
      }

      case "read_second_report": {
        let filePath = args.file_path;
        if (!filePath) return "Error: file_path required for read_second_report";
        if (!path.isAbsolute(filePath) && context.projectPath) {
          filePath = path.resolve(context.projectPath, ".tiddlydesk-okf", filePath);
        }
        context.log(`  📖 Reading (2nd): ${path.basename(filePath)}`);
        const content = utils.readReportContent(filePath);
        context.sourceFiles = context.sourceFiles || [];
        context.sourceFiles.push(filePath);
        dbg(`read_second_report done — ${content.length} chars`);
        return `[Content of ${path.basename(filePath)} (for comparison)]\n\n${content}`;
      }

      case "read_wiki_index": {
        const projectPath = context.projectPath;
        if (!projectPath) return "Error: No active project path in agent context";
        const indexPath = path.join(projectPath, ".tiddlydesk-okf", "index.md");
        if (!fs.existsSync(indexPath)) {
          return "No OKF wiki catalog exists. Please run Ingest first.";
        }
        context.log("  📖 Reading Case OKF Catalog Index");
        const content = fs.readFileSync(indexPath, "utf8");
        return `[Case Catalog Index (index.md) - relative links can be read via read_report]\n\n${content}`;
      }

      case "search_wiki": {
        const query = args.query;
        if (!query) return "Error: query argument is required for search_wiki";
        const projectPath = context.projectPath;
        if (!projectPath) return "Error: No active project path in agent context";
        const okfDir = path.join(projectPath, ".tiddlydesk-okf", "wiki");
        if (!fs.existsSync(okfDir)) {
          return "No OKF wiki catalog exists. Please run Ingest first.";
        }
        context.log(`  🔍 Searching OKF Wiki for: "${query}"`);
        const matches = [];
        
        function walk(dir) {
          let files;
          try {
            files = fs.readdirSync(dir);
          } catch (e) {
            return;
          }
          for (const file of files) {
            const fullPath = path.join(dir, file);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                walk(fullPath);
              } else if (stat.isFile() && file.endsWith(".md")) {
                const content = fs.readFileSync(fullPath, "utf8");
                if (content.toLowerCase().includes(query.toLowerCase())) {
                  const rel = path.relative(okfDir, fullPath);
                  let desc = "";
                  const match = content.match(/description:\s*"(.*?)"/);
                  if (match) desc = match[1];
                  matches.push({ file: rel, description: desc });
                }
              }
            } catch (e) {}
          }
        }
        walk(okfDir);
        if (matches.length === 0) return `No matches found for "${query}" in OKF wiki.`;
        return matches.map((m, i) => `${i + 1}. Path: wiki/${m.file} ${m.description ? `- Description: ${m.description}` : ""}`).join("\n");
      }

      case "list_reports": {
        const boardPath = args.board_path;
        if (!boardPath) return "Error: board_path required for list_reports";
        context.log(`  📂 Listing: ${boardPath}`);
        const reports = utils.listReportFiles(boardPath);
        if (reports.length === 0) return "No reports found in this board directory.";
        return reports.map((r, i) => `${i + 1}. ${r.name}\n   Path: ${r.path}`).join("\n");
      }

      case "write_report": {
        const { board_path, file_name, title, content_markdown } = args;
        dbg(`write_report — board: ${board_path}, file: ${file_name}, title: ${title}, content_len: ${(content_markdown||"").length}`);

        if (!board_path)       return "Error: board_path is required";
        if (!file_name)        return "Error: file_name is required";
        if (!title)            return "Error: title is required";
        if (!content_markdown) return "Error: content_markdown is required";

        // Prevent directory traversal
        const resolvedBoardPath = path.resolve(board_path);
        const outPath = path.resolve(resolvedBoardPath, file_name);
        if (!outPath.startsWith(resolvedBoardPath)) {
          return "Error: Directory traversal is not allowed. The output file must be inside the board directory.";
        }

        context.log(`  ✍️  Writing: ${file_name}`);

        if (!fs.existsSync(resolvedBoardPath)) {
          dbg("Creating board directory:", resolvedBoardPath);
          fs.mkdirSync(resolvedBoardPath, { recursive: true });
        }

        const timestamp = new Date().toLocaleString("en-IN", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit"
        });

        const html = utils.buildReportHtml(title, content_markdown, context.skillName, timestamp);
        dbg(`Writing ${html.length} bytes to: ${outPath}`);
        fs.writeFileSync(outPath, html, "utf8");
        context.outputFile = outPath;
        dbg("write_report success:", outPath);
        return `Report successfully written to: ${outPath}`;
      }

      default:
        dbgErr("Unknown tool called:", toolName);
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    dbgErr(`executeTool [${toolName}] threw:`, err.message, err.stack);
    context.log(`  ⚠️  Tool error [${toolName}]: ${err.message}`);
    return `Error executing ${toolName}: ${err.message}`;
  }
}

module.exports = {
  executeTool
};
