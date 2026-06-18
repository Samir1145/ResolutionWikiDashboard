// okf-qa.skill.js
// Agentic Q&A over the OKF Case Knowledge Catalog
"use strict";

const SYSTEM_PROMPT = `You are a helpful legal compliance assistant and insolvency specialist. Your goal is to answer the user's questions about the active insolvency case using the Case Knowledge Catalog.

The Case Knowledge Catalog is structured in Open Knowledge Format (OKF) on disk.
The catalog index file is located at the root of the project as ".tiddlydesk-okf/index.md" and lists all case reports, user tiddlers, and uploaded documents that have been parsed.

You have access to the following three tools:
1. read_wiki_index: Call this tool at the start of your thinking cycle to read the catalog index.md and discover what categories and documents are available.
2. search_wiki: Call this tool with a query keyword to search across all case documents in the OKF wiki and find files containing that keyword.
3. read_report: Call this tool with the absolute path of a specific markdown file to read its contents.

CRITICAL INSTRUCTIONS:
- You must always navigate the catalog first to find the factual answer. Do NOT guess or hallucinate any facts.
- Try searching for key terms using "search_wiki" if you do not know which file to open.
- When you find the answer, cite the original source file name (e.g. from the frontmatter "source" attribute of the file) in your final response.
- Answer clearly and professionally. Format your final output using clean Markdown (headers, bullet points, bolding, etc.).
`;

module.exports = {
  displayName: "Case Q&A Agent",
  description: "Answers user questions by navigating and searching the Case OKF Knowledge Catalog",

  build(params) {
    const {
      query,
      projectPath,
      boardPath
    } = params;

    const userMessage = `User Question: "${query}"

Guidelines:
1. Call read_wiki_index to inspect the case file index, or search_wiki to locate specific documents.
2. Call read_report on the matching OKF markdown files in ".tiddlydesk-okf/wiki/" to retrieve actual text details.
3. Present your final answer citing the source file path(s).`;

    return {
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      tools: [
        {
          type: "function",
          function: {
            name: "read_wiki_index",
            description: "Read the main .tiddlydesk-okf/index.md file listing all files in the OKF catalog.",
            parameters: {
              type: "object",
              properties: {}
            }
          }
        },
        {
          type: "function",
          function: {
            name: "search_wiki",
            description: "Search/grep the OKF wiki catalog recursively for a keyword query.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search keyword" }
              },
              required: ["query"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "read_report",
            description: "Read text contents of an OKF markdown file or project report.",
            parameters: {
              type: "object",
              properties: {
                file_path: { type: "string", description: "Absolute file path" }
              },
              required: ["file_path"]
            }
          }
        }
      ]
    };
  }
};
