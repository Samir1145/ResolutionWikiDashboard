// tool.executor.js - Agentic tool execution dispatcher
"use strict";

const fs = require("fs");
const path = require("path");
const utils = require("./utils");

const TAG = "[ToolExecutor]";
function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

function executeTool(toolName, args, context) {
  dbg(`executeTool: "${toolName}", args:`, JSON.stringify(args).slice(0, 300));
  try {
    switch (toolName) {

      case "read_report": {
        const filePath = args.file_path;
        if (!filePath) {
          dbgErr("read_report called with no file_path!");
          return "Error: file_path argument is required for read_report";
        }
        context.log(`  📖 Reading: ${path.basename(filePath)}`);
        const content = utils.readReportContent(filePath);
        context.sourceFiles = context.sourceFiles || [];
        context.sourceFiles.push(filePath);
        dbg(`read_report done — ${content.length} chars`);
        return `[Content of ${path.basename(filePath)}]\n\n${content}`;
      }

      case "read_second_report": {
        const filePath = args.file_path;
        if (!filePath) return "Error: file_path required for read_second_report";
        context.log(`  📖 Reading (2nd): ${path.basename(filePath)}`);
        const content = utils.readReportContent(filePath);
        context.sourceFiles = context.sourceFiles || [];
        context.sourceFiles.push(filePath);
        dbg(`read_second_report done — ${content.length} chars`);
        return `[Content of ${path.basename(filePath)} (for comparison)]\n\n${content}`;
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
