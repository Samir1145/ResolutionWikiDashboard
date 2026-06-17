// run_agent.js - Background process to run KaibanJS agents safely without crashing NW.js UI
"use strict";

const { Agent, Task, Team } = require("kaibanjs");

// Read configuration from stdin
let inputData = "";
process.stdin.on("data", chunk => {
  inputData += chunk;
});

process.stdin.on("end", async () => {
  try {
    const config = JSON.parse(inputData);
    const { provider, apiKey, model, aboutMeText } = config;

    const llmConfig = {
      provider: provider === "gemini" ? "google" : "openai",
      model: model,
      apiKey: apiKey
    };

    // Define Agents
    const profileAnalyst = new Agent({
      name: "Mary",
      role: "Profile Analyst",
      goal: "Extract structured information from conversational user input.",
      background: "Data Processor",
      tools: [],
      llmConfig
    });

    const resumeWriter = new Agent({
      name: "Alex Mercer",
      role: "Resume Writer",
      goal: "Craft compelling, well-structured resumes that effectively showcase job seekers qualifications.",
      background: "Recruiter and professional resume writer.",
      tools: [],
      llmConfig
    });

    // Define Tasks
    const processingTask = new Task({
      description: `Extract relevant details such as name, experience, skills, and job history from the user's 'aboutMe' input. aboutMe: ${aboutMeText}`,
      expectedOutput: "Structured data ready to be used for a resume creation.",
      agent: profileAnalyst
    });

    const resumeCreationTask = new Task({
      description: `Utilize the structured data to create a detailed and attractive resume. Enrich the resume content by inferring additional details. Include sections such as a personal summary, detailed work experience, skills, and educational background.`,
      expectedOutput: "A professionally formatted resume in markdown format.",
      agent: resumeWriter
    });

    const team = new Team({
      name: "Resume Creation Team",
      agents: [profileAnalyst, resumeWriter],
      tasks: [processingTask, resumeCreationTask],
      env: {
        GEMINI_API_KEY: apiKey,
        OPENAI_API_KEY: apiKey
      }
    });

    // Subscribe to Zustand store for real-time logs
    const store = team.getStore();
    let lastProcessedIndex = 0;

    const unsubscribe = store.subscribe((state) => {
      const logs = state.workflowLogs;
      if (!logs) return;

      while (lastProcessedIndex < logs.length) {
        const logEntry = logs[lastProcessedIndex];
        lastProcessedIndex++;

        // Send logs to parent process via stdout JSON lines
        if (logEntry.logType === "WorkflowStatusUpdate") {
          const wfSt = logEntry.workflowStatus || "";
          const msg = (logEntry.metadata && logEntry.metadata.message) || "";
          const err = (logEntry.metadata && logEntry.metadata.error) || "";
          let outMessage = `Workflow: ${wfSt}`;
          if (msg) outMessage += ` — ${msg}`;
          if (err) outMessage += ` — ${err}`;
          
          let style = "info";
          if (wfSt === "FINISHED") style = "success";
          else if (wfSt === "BLOCKED" || wfSt === "ERRORED") style = "error";

          console.log(JSON.stringify({ type: "log", message: outMessage, style }));

        } else if (logEntry.logType === "TaskStatusUpdate") {
          const task = logEntry.task;
          const status = logEntry.taskStatus;
          if (task && status) {
            let cardId = "";
            const taskTitle = task.title || "";
            const taskDesc = task.description || "";
            const agentName = task.agent ? task.agent.name : "";

            if (taskTitle.toLowerCase().includes("extract") || taskDesc.toLowerCase().includes("extract") || agentName === "Mary") {
              cardId = "card-task-zoe";
            } else {
              cardId = "card-task-alex";
            }

            let message = `[Task: ${taskTitle || taskDesc.substring(0, 30)}...] → ${status}`;
            if ((status === "BLOCKED" || status === "ERROR") && logEntry.metadata && logEntry.metadata.error) {
              const errText = logEntry.metadata.error.message || String(logEntry.metadata.error);
              message += ` (${errText})`;
            }

            let style = "info";
            if (status === "DONE") style = "success";
            else if (status === "BLOCKED" || status === "ERROR") style = "error";

            console.log(JSON.stringify({ type: "task", cardId, status, message, style }));
          }

        } else if (logEntry.logType === "AgentStatusUpdate") {
          const agent = logEntry.agent;
          if (agent) {
            let thought = null;
            if (logEntry.metadata) {
              if (logEntry.metadata.thought) {
                thought = logEntry.metadata.thought;
              } else if (logEntry.metadata.output && logEntry.metadata.output.thought) {
                thought = logEntry.metadata.output.thought;
              } else if (logEntry.metadata.message) {
                thought = logEntry.metadata.message;
              } else if (logEntry.metadata.error) {
                const errMsg = logEntry.metadata.error.message || String(logEntry.metadata.error);
                thought = `⚠️ Error: ${errMsg}`;
              }
            }

            if (thought) {
              const isErr = thought.startsWith("⚠️");
              console.log(JSON.stringify({
                type: "agent",
                name: agent.name,
                thought: thought,
                style: isErr ? "error" : "thought"
              }));
            }
          }
        }
      }
    });

    const workflowResult = await team.start();
    unsubscribe();

    // Determine final output
    function coerceToString(val) {
      if (val == null) return "";
      if (typeof val === "string") return val;
      if (typeof val === "object") {
        if (typeof val.result === "string") return val.result;
        if (typeof val.output === "string") return val.output;
        if (typeof val.finalAnswer === "string") return val.finalAnswer;
        return JSON.stringify(val, null, 2);
      }
      return String(val);
    }

    const rawOutput =
      coerceToString(resumeCreationTask.result) ||
      coerceToString(workflowResult && workflowResult.result) ||
      "";

    console.log(JSON.stringify({ type: "result", markdown: rawOutput }));
    process.exit(0);

  } catch (err) {
    console.log(JSON.stringify({ type: "error", message: err.message, stack: err.stack }));
    process.exit(1);
  }
});
