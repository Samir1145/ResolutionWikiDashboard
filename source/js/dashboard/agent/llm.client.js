// llm.client.js - API clients for Ollama and Gemini APIs
"use strict";

const http = require("http");
const https = require("https");

const REQUEST_TIMEOUT = 120000; // 2 minutes per LLM call
const TAG = "[LLMClient]";

function dbg(...args) { console.log(TAG, ...args); }
function dbgErr(...args) { console.error(TAG, ...args); }

function ollamaPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    dbg(`POST ${endpoint} — model: ${body.model}, tools: ${(body.tools||[]).length}, messages: ${body.messages.length}`);

    const options = {
      hostname: "127.0.0.1",
      port:     11434,
      path:     endpoint,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      dbg(`HTTP ${res.statusCode} from Ollama ${endpoint}`);
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        dbg(`Response body length: ${data.length} chars`);
        try {
          const parsed = JSON.parse(data);
          dbg("Parsed response keys:", Object.keys(parsed).join(", "));
          if (parsed.message) {
            dbg("message.role:", parsed.message.role);
            dbg("message.content length:", (parsed.message.content||"").length);
            dbg("message.tool_calls:", JSON.stringify(parsed.message.tool_calls||[]).slice(0, 300));
          }
          if (parsed.error) {
            dbgErr("Ollama returned error field:", parsed.error);
          }
          resolve(parsed);
        } catch (e) {
          dbgErr("JSON parse failed, raw response:", data.slice(0, 500));
          reject(new Error("Failed to parse Ollama response: " + data.slice(0, 200)));
        }
      });
    });

    req.on("error", (e) => {
      dbgErr("HTTP request error:", e.message);
      reject(e);
    });
    req.setTimeout(REQUEST_TIMEOUT, () => {
      dbgErr("Request timed out after", REQUEST_TIMEOUT, "ms");
      req.destroy();
      reject(new Error("Ollama request timed out after " + REQUEST_TIMEOUT + "ms"));
    });

    req.write(payload);
    req.end();
  });
}

async function chatWithOllama(model, messages, tools) {
  const body = {
    model:    model,
    messages: messages,
    stream:   false,
    options: {
      temperature: 0.1,
      num_predict: 4096
    }
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    dbg(`Sending ${tools.length} tools to model:`, tools.map(t => t.function.name).join(", "));
  } else {
    dbg("No tools in this request");
  }

  dbg(`Sending ${messages.length} messages to model. Last message role: ${messages[messages.length-1]?.role}`);

  const response = await ollamaPost("/api/chat", body);

  if (!response || !response.message) {
    const snippet = JSON.stringify(response).slice(0, 400);
    dbgErr("Unexpected Ollama response (no .message field):", snippet);
    throw new Error("Unexpected Ollama response structure: " + snippet);
  }

  const msg = response.message;
  dbg(`LLM response — role: ${msg.role}, content_len: ${(msg.content||"").length}, tool_calls_count: ${(msg.tool_calls||[]).length}`);
  if ((msg.tool_calls||[]).length > 0) {
    dbg("Tool calls:", JSON.stringify(msg.tool_calls).slice(0, 600));
  }
  return msg;
}

function geminiPost(model, body) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reject(new Error("GEMINI_API_KEY is not set. Please set it in your environment or .env file."));
    }

    const payload = JSON.stringify(body);
    const geminiModel = (model === "hermes3" || !model.startsWith("gemini")) ? "gemini-2.5-flash" : model;
    
    dbg(`POST Gemini API — model: ${geminiModel}, tools: ${(body.tools||[]).length}, contents: ${(body.contents||[]).length}`);

    const options = {
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path: `/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      dbg(`HTTP ${res.statusCode} from Gemini API`);
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            dbgErr("Gemini API returned error:", parsed.error);
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            return;
          }
          resolve(parsed);
        } catch (e) {
          dbgErr("JSON parse failed, raw response:", data.slice(0, 500));
          reject(new Error("Failed to parse Gemini response: " + data.slice(0, 200)));
        }
      });
    });

    req.on("error", (e) => {
      dbgErr("HTTPS request error:", e.message);
      reject(e);
    });
    req.setTimeout(REQUEST_TIMEOUT, () => {
      dbgErr("Gemini request timed out after", REQUEST_TIMEOUT, "ms");
      req.destroy();
      reject(new Error("Gemini request timed out after " + REQUEST_TIMEOUT + "ms"));
    });

    req.write(payload);
    req.end();
  });
}

function convertSchemaToGemini(schema) {
  if (!schema) return schema;
  const newSchema = { ...schema };
  if (typeof newSchema.type === "string") {
    newSchema.type = newSchema.type.toUpperCase();
  }
  if (newSchema.properties) {
    const newProps = {};
    for (const key in newSchema.properties) {
      newProps[key] = convertSchemaToGemini(newSchema.properties[key]);
    }
    newSchema.properties = newProps;
  }
  if (newSchema.items) {
    newSchema.items = convertSchemaToGemini(newSchema.items);
  }
  return newSchema;
}

async function chatWithGemini(model, messages, tools) {
  const geminiContents = [];
  let systemInstructionText = "";

  messages.forEach(msg => {
    if (msg.role === "system") {
      systemInstructionText = msg.content;
    } else if (msg.role === "user") {
      geminiContents.push({
        role: "user",
        parts: [{ text: msg.content }]
      });
    } else if (msg.role === "assistant" || msg.role === "model") {
      const parts = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        msg.tool_calls.forEach(tc => {
          const fnArgs = typeof tc.function.arguments === "string" 
            ? JSON.parse(tc.function.arguments) 
            : tc.function.arguments;
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: fnArgs
            }
          });
        });
      }
      geminiContents.push({
        role: "model",
        parts: parts
      });
    } else if (msg.role === "tool") {
      geminiContents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name,
              response: {
                result: msg.content
              }
            }
          }
        ]
      });
    }
  });

  const body = {
    contents: geminiContents
  };

  if (systemInstructionText) {
    body.systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };
  }

  if (tools && tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: convertSchemaToGemini(t.function.parameters)
        }))
      }
    ];
  }

  const response = await geminiPost(model, body);

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No candidates returned from Gemini API");
  }

  const candidate = response.candidates[0];
  const parts = candidate.content.parts || [];
  
  let textContent = "";
  const toolCalls = [];

  parts.forEach(p => {
    if (p.text) {
      textContent += p.text;
    }
    if (p.functionCall) {
      toolCalls.push({
        function: {
          name: p.functionCall.name,
          arguments: p.functionCall.args
        }
      });
    }
  });

  const resultMsg = {
    role: "assistant",
    content: textContent
  };
  if (toolCalls.length > 0) {
    resultMsg.tool_calls = toolCalls;
  }

  return resultMsg;
}

async function checkOllamaHealth() {
  if (process.env.GEMINI_API_KEY) {
    dbg("GEMINI_API_KEY present — bypassing Ollama check.");
    return { ok: true, models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-3.5-flash"] };
  }

  dbg("Checking Ollama health at http://127.0.0.1:11434/api/tags...");
  return new Promise((resolve) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port:     11434,
      path:     "/api/tags",
      method:   "GET"
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const models = (json.models || []).map(m => m.name || m.model || "");
          dbg("Ollama healthy, models:", models.join(", "));
          resolve({ ok: true, models });
        } catch {
          dbgErr("Could not parse /api/tags response:", data.slice(0, 200));
          resolve({ ok: false, error: "Could not parse Ollama /api/tags response" });
        }
      });
    });
    req.on("error", (e) => {
      dbgErr("Ollama health check failed:", e.message);
      resolve({ ok: false, error: e.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ok: false, error: "Ollama connection timed out (is Ollama running?)" });
    });
    req.end();
  });
}

module.exports = {
  chatWithOllama,
  chatWithGemini,
  checkOllamaHealth
};
