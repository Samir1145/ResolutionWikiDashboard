// markdown.utils.js - Custom Markdown parser for TiddlyDesk dashboard sidebar
"use strict";

function parseMarkdown(text) {
  if (!text) return "";
  let html = text;

  // Escape HTML tags to prevent XSS/broken formatting
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Parse tables
  const lines = html.split("\n");
  let inTable = false;
  let tableHtml = "";
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableHtml = "<table>";
      }
      if (line.includes("---")) {
        continue; // skip separator row
      }
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      tableHtml += "<tr>";
      const cellTag = tableHtml.includes("</tr>") ? "td" : "th";
      cells.forEach(cell => {
        tableHtml += `<${cellTag}>${cell}</${cellTag}>`;
      });
      tableHtml += "</tr>";
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += "</table>";
        newLines.push(tableHtml);
        tableHtml = "";
      }
      newLines.push(lines[i]);
    }
  }
  if (inTable) {
    tableHtml += "</table>";
    newLines.push(tableHtml);
  }
  html = newLines.join("\n");

  // Headers (### Header)
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // Bold (**bold**)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Inline code (`code`)
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");

  // Bullet points (* list or - list)
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, "<li>$1</li>");
  
  // Wrap list tags and group
  html = html.replace(/(<\/li>\n<li>)/g, "</li><li>");
  html = html.replace(/(<li>.*?<\/li>)/g, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  // Paragraphs
  const parts = html.split(/\n\n+/);
  const parsedParts = parts.map(part => {
    const trimmed = part.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<ol") || trimmed.startsWith("<table") || trimmed.startsWith("<ul>") || trimmed.startsWith("<li>")) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
  });
  
  return parsedParts.join("\n");
}

module.exports = {
  parseMarkdown
};
