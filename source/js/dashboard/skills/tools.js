// tools.js – Shared IBC Tool Definitions for the Agent
// Exported separately to avoid circular require() between agent.service.js and skill files
"use strict";

const TOOL_READ_REPORT = {
  type: "function",
  function: {
    name: "read_report",
    description: "Read the full text content of a report file (HTML or TiddlyWiki). Strips HTML tags and returns plain text suitable for analysis.",
    parameters: {
      type: "object",
      required: ["file_path"],
      properties: {
        file_path: {
          type: "string",
          description: "Absolute path to the report file (.html, .htm, or TiddlyWiki folder path)"
        }
      }
    }
  }
};

const TOOL_READ_SECOND_REPORT = {
  type: "function",
  function: {
    name: "read_second_report",
    description: "Read a second report file for comparison analysis. Use after read_report.",
    parameters: {
      type: "object",
      required: ["file_path"],
      properties: {
        file_path: {
          type: "string",
          description: "Absolute path to the second report file to compare"
        }
      }
    }
  }
};

const TOOL_LIST_REPORTS = {
  type: "function",
  function: {
    name: "list_reports",
    description: "List all available report files in a project board directory.",
    parameters: {
      type: "object",
      required: ["board_path"],
      properties: {
        board_path: {
          type: "string",
          description: "Absolute path to the board (swimlane) directory"
        }
      }
    }
  }
};

const TOOL_WRITE_REPORT = {
  type: "function",
  function: {
    name: "write_report",
    description: "Write the completed analysis output as a new HTML report file to the board directory. Use this ONCE at the end when analysis is complete.",
    parameters: {
      type: "object",
      required: ["board_path", "file_name", "title", "content_markdown"],
      properties: {
        board_path: {
          type: "string",
          description: "Absolute path to the board directory where the report should be saved"
        },
        file_name: {
          type: "string",
          description: "Output filename, e.g. 'Section_29A_Verification_2024.html'. Must end in .html"
        },
        title: {
          type: "string",
          description: "Title to display at the top of the report"
        },
        content_markdown: {
          type: "string",
          description: "The full analysis report content in Markdown format. Include headings, tables, findings and recommendations."
        }
      }
    }
  }
};

module.exports = {
  READ_REPORT:        TOOL_READ_REPORT,
  READ_SECOND_REPORT: TOOL_READ_SECOND_REPORT,
  LIST_REPORTS:       TOOL_LIST_REPORTS,
  WRITE_REPORT:       TOOL_WRITE_REPORT
};
