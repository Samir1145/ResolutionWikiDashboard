# Resolution Bazaar: Complete Case Management & Agentic Engine Handbook

Welcome to the ultimate guide for **Resolution Bazaar**, the specialized Insolvency and Bankruptcy Code (IBC) case management and agentic intelligence extension for TiddlyDesk.

This document serves as both a comprehensive **User Guide** for insolvency practitioners, liquidators, and case managers, and a deep-dive **Technical Reference Manual** for system administrators and software developers.

---

## 👥 Part I: User Handbook

### 1. Introduction to Resolution Bazaar

Resolution Bazaar is a secure, local, offline-first case management dashboard designed specifically to assist Resolution Professionals (RPs), Liquidators, and legal counsel managing corporate insolvency cases under the **Insolvency and Bankruptcy Code (IBC), 2016** of India.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RESOLUTION BAZAAR                                │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │   Case Workspaces     │  │   Interactive Kanban  │  │    OKF Wiki     │  │
│  │ (Separate Debtors)    │  │ (Progress Tracking)   │  │  Catalog & Q&A  │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘  │
│              │                          │                       │           │
│              └──────────────────────────┼───────────────────────┘           │
│                                         ▼                                   │
│                        ┌─────────────────────────────────┐                  │
│                        │     Multi-Agent Audit Teams     │                  │
│                        │   (Section 29A & Plan Audits)   │                  │
│                        └─────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 1.1. Core Case Management Philosophy
Insolvency proceedings are heavily regulated, document-intensive, and time-critical. The Corporate Insolvency Resolution Process (CIRP) requires compiling and reviewing thousands of pages of financial records, audit logs, valuation sheets, and resolution plans.

Resolution Bazaar organizes these documents into a visual, drag-and-drop **Kanban Board**. Files are represented as **Tiddlers** (interactive documents). This layout moves away from traditional nested folder directories into an active, visual board.

#### 1.2. The Role of Agentic AI & Local Security
Legal and financial records of distressed corporate debtors are highly confidential. Uploading files to public cloud models (like OpenAI ChatGPT or Google Gemini) violates NDAs and client confidentiality terms.

Resolution Bazaar solves this with a **zero-trust, offline-first security design**:
* **Open Knowledge Format (OKF) Catalog**: Compiles report cards, wikis, and case records into clean, local Markdown folders structured under `.tiddlydesk-okf/` index schemas. This keeps all metadata in human-readable, vendor-neutral formats.
* **Autonomous ReAct Agent Loop**: Runs multi-agent audits and statutory reviews locally, with fallback to encrypted cloud API providers (Gemini or OpenAI) only if the user explicitly inputs their credentials and opts in.

#### 1.3. User Personas & Workflows
* **Resolution Professionals (RPs)**: Use workspaces to separate corporate debtors, upload documents, run Section 29A eligibility compliance reports on potential resolution applicants, and output statutory plan audits.
* **Liquidators**: Track asset registers, compare independent valuation reports, calculate haircuts, and record liquidator certificates.
* **Legal Advisors**: Query the case repository via the **Ask Agent (OKF Wiki)** sidebar tab to quickly retrieve clauses, identify contract defaults, and track corporate litigation records.

#### 1.4. Key Insolvency Terms & CIRP Timelines
Under the Indian IBC 2016 framework, the Corporate Insolvency Resolution Process (CIRP) must be completed within **180 days** (extendable to a maximum of **330 days** including litigation delays). RPs face severe legal penalties for timeline breaches. Resolution Bazaar groups documents into swimlanes representing key milestones:
* **Section 29A Verification**: Reviewing applicants to prevent defaulting promoters from buying back their own companies at a discount.
* **Section 30(2) Compliance Checklist**: Auditing whether the resolution plan pays operational creditors, liquidation value priorities, and insolvency process costs.
* **Valuation Reconciliation**: Comparing the fair value and liquidation value prepared by two independent registered valuers.

---

### 2. Workspaces & Projects Administration

Workspaces and Projects form the structural hierarchy of Resolution Bazaar, isolating different corporate debtors' data.

#### 2.1. Dynamic Workspace Segmentation
A Workspace represents a portfolio or category (e.g., *NCLT Mumbai Bench Cases*, *Active CIRPs*, *Completed Liquidations*).
* **Workspace Tab Bar**: Visible at the top of the dashboard. Click between tabs to change your active workspace focus.
* **Workspace Actions**:
  * **Add Workspace**: Click the `Add Workspace` button on the tab bar. Enter a name (e.g., "Delhi Cases"). This creates a fresh workspace tab.
  * **Rename Workspace**: Select a workspace, click the options dropdown, and choose `Rename Workspace`.
  * **Delete Workspace**: Click `Delete Workspace`. To prevent accidental data loss, the default workspace cannot be deleted, and a workspace can only be deleted if it contains no linked projects.

#### 2.2. Linking & Unlinking Local Case Folders
Resolution Bazaar operates as a **Reference-Based System**. It does not duplicate, copy, or relocate your original directories; it registers an absolute pathway hook pointing to them.
* **Add Project**: Click the `Add Project` button. The host file selection window will open. Select the folder containing your case documents (e.g., `/Users/username/Cases/Debtor_ABC`).
* **Under the Hood**: Resolution Bazaar links the folder to your active workspace, reading the files dynamically.
* **Remove Project**: Click the `Remove` button on the project card. This removes the project reference from Resolution Bazaar. **Crucial Safety Note: Unlinking a project never deletes the folder or its files from your hard drive.**

#### 2.3. Under-the-Hood: Configuration Schema & Local Data Paths
All workspace metadata, project references, and report card paths are stored in a single JSON file on your machine.
* **Config File Location**: `~/.tiddlydesktop/dashboard-config.json`
* **JSON Schema Structure**:
```json
{
  "activeWorkspaceId": "ws_1718612345678",
  "workspaces": [
    {
      "id": "default",
      "name": "Default Workspace",
      "projects": []
    },
    {
      "id": "ws_1718612345678",
      "name": "NCLT Cases",
      "projects": [
        {
          "id": "/Users/atulgrover/Documents/IBC_Cases/Debtor_Alpha",
          "name": "Debtor_Alpha"
        }
      ]
    }
  ]
}
```

---

### 3. Operating the Interactive Kanban Board

Clicking on any Project card opens the dedicated **Interactive Kanban Board** for that corporate debtor.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Project: Debtor_Alpha                         [ Main Board ] [ Ask Agent 🤖] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────┐    ┌───────────────────┐    ┌────────────────┐  │
│  │ TO DO             │    │ IN PROGRESS       │    │ COMPLETED      │  │
│  ├───────────────────┤    ├───────────────────┤    ├────────────────┤  │
│  │ [Raw_Valuation.html]─┐  │                   │    │ [Audit_Rep.html]│  │
│  │                   │  └─►[29A_Verify.html]  │    │                │  │
│  │                   │    │                   │    │                │  │
│  └───────────────────┘    └───────────────────┘    └────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### 3.1. Drag-and-Drop Columns Explained
The board categorizes document cards into three standard status columns:
1. **To Do (Raw/New Files)**: Newly imported case documents, raw evidence files, or plans requiring review.
2. **In Progress (Files Under Review)**: Files currently being analyzed, scanned, or actively verified by you or an AI agent.
3. **Completed (Signed/Saved Reports)**: Validated compliance reports, finalized audit outputs, and reconciliation files.

To move a card, simply click and hold a card, drag it over to another column, and release. The UI updates instantly.

#### 3.2. Sub-boards & Swimlanes (Folders vs. Root Board)
The Kanban Board dynamically maps to folders in the case directory:
* **Root Folder**: HTML files placed directly in the project directory are rendered on the **Main Board**.
* **Subfolders (Swimlanes)**: Any subfolder created in the project folder (e.g., `Valuations`, `Resolution_Plans`) is detected as a separate sub-board. A sidebar menu on the left lists all boards in the active project. Click on a sub-board to view the Kanban cards inside that specific sub-folder.

#### 3.3. Document Actions: Open & Reveal
Each card displays the file name and provides two primary buttons:
* **Open**: Launches the document in a secure browser sandbox container within the app. Because it operates within TiddlyDesktop, any TiddlyWiki `.html` file opened this way supports automatic background saves without bringing up a browser download prompt.
* **Reveal**: Opens the default OS file manager (Finder on Mac, Explorer on Windows) and highlights the exact file, allowing you to quickly move, copy, or rename it.

#### 3.4. Managing Cards without Filesystem Pollution (`.tiddlydesk-meta.json`)
Moving cards on a Kanban board usually forces files to move between subfolders, breaking references. Resolution Bazaar avoids this via a hidden configuration file:
* **File Name**: `.tiddlydesk-meta.json` (saved directly inside your project directory).
* **Metadata Schema**:
```json
{
  "reports": {
    "Admission_Order.html": {
      "status": "done"
    },
    "Resolution_Plans/Plan_Bidder_A.html": {
      "status": "progress"
    }
  }
}
```
* **Benefits**: The files remain exactly where they were originally placed on disk. No directories are polluted, and file structures remain unchanged.

---

### 4. Working with the OKF Catalog & Q&A Agent

The right sidebar houses the **Ask Agent (OKF Wiki)** interface under the **🤖 Agents** tab, providing secure local workspace search and Q&A.

#### 4.1. Fast Mechanical OKF Ingestion
Whenever you query the Agent, the system automatically runs an incremental mechanical crawler to sync your project files into the **Open Knowledge Format (OKF)** standard:
1. All report files, TiddlyWiki `.tid` documents, and user-uploaded text documents are parsed.
2. The parsed contents are generated as Markdown documents with standard YAML frontmatter headings.
3. System tiddlers (prefixed with `$:/`) are automatically filtered out.
4. Legacy document references from `.tiddlydesk-rag/` are automatically migrated to `.tiddlydesk-okf/wiki/documents/`.
5. The system writes a compiled `index.md` catalog sheet mapping reports, tiddlers, and documents.

#### 4.2. Chatting with Case Files via ReAct Agent Loop
* **Query Input**: Type a question in the query input box (e.g., *"What is the liquidation value?"* or *"Summarize Section 29A issues"*).
* **Execution**: Click **`Ask Agent`** or press `Cmd/Ctrl + Enter`.
* **The ReAct Loop**: The agent will run a multi-turn ReAct loop:
  1. *Reading the catalog index...* (Retrieving the `index.md` catalog schema using the `read_wiki_index` tool).
  2. *Searching catalog documents...* (Running `search_wiki` to grep files for matching terms).
  3. *Answering query...* (Consolidating the content to construct a complete legal-compliance answer).
* **Output**: The answer is formatted as rich HTML/Markdown in the agent pane.

#### 4.3. Understanding Context Attribution & Source Citations
The Agent references and logs the sources it examined during tool usage:
* The conversation history details each tool execution (e.g., calling `read_wiki_index`, calling `search_wiki` with target terms).
* This provides clear auditability, showing exactly which files the agent examined to compose its response.

#### 4.4. Saving Custom Agent Reports
You can save any agent analysis back into the case workspace:
1. Click **`💾 Save as Report`** in the response footer.
2. Input a title (e.g., *"Valuation Report Outliers Summary"*).
3. The system compiles the query, response markdown, and source links into a styled HTML document.
4. The file is saved directly to your active board directory, appearing instantly as a new Kanban card in your active column.

---

### 5. Multi-Agent Audit Teams Playground

Clicking the **`🚀 Agent Demo`** button in the sidebar launches the **LexAI Agent Playground**, designed for more complex, multi-step reviews.

```
┌────────────────────────────────────────────────────────────────────────┐
│ LexAI: Multi-Agent Resolution Audit                                    │
├────────────────────────────────────────────────────────────────────────┤
│ Configuration:  Provider: [ Gemini API ]   Model: [ gemini-2.5-flash ] │
│                 API Key:  [ ********************************** ]       │
├────────────────────────────────────────────────────────────────────────┤
│ Debtor Profile: [ Debtor XYZ is a steel manufacturer with 500Cr debt ] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  🚀 [Start Multi-Agent Team]                                           │
│                                                                        │
│  Tasks Board:                                                          │
│  ┌───────────────────┐    ┌───────────────────┐    ┌─────────────────┐ │
│  │ TO DO             │    │ DOING             │    │ DONE            │ │
│  ├───────────────────┤    ├───────────────────┤    ├─────────────────┤ │
│  │                   │    │ [Zoe: Profile]    │    │                 │ │
│  │                   │    │ [Alex: Summary]   │    │                 │ │
│  └───────────────────┘    └───────────────────┘    └─────────────────┘ │
│                                                                        │
│  Log Output:                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ [AgentSvc] Starting Multi-Agent skill execution: section_29a      │ │
│  │   📖 Reading: Admission_Order.html...                             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

#### 5.1. Introducing LexAI Multi-Agent Teams
LexAI models a multi-agent team collaborating on specialized tasks:
* **Zoe (Profile Analyst)**: Responsible for reading raw text, extracting key figures, identifying entity names, and cataloging dates.
* **Alex (Resume/Report Writer)**: Consolidates Zoe's findings, formats tables, runs calculations, writes legal analysis drafts, and generates the final HTML report card.

#### 5.2. Supported Auditing Skills
* **Section 29A Compliance Check**: Audits financial records, promoter lists, and court records against the ten disqualification criteria (NPA status, wilful defaults, director bans).
* **Statutory Plan Auditor**: Audits resolution plans against IBC Section 30(2) to ensure priority payouts, cost coverages, and management transition terms.
* **Valuation Reconciliation**: Parses reports from independent valuers, extracts asset valuations, and highlights variance outliers.
* **Investor Fit**: Profiles prospective bidders to assess net worth, funding capacity, and past sector experience.
* **Plan Comparison**: Compares two competing resolution bids, matching financial payouts, asset rehabilitation plans, and implementation timelines.

#### 5.3. Configuring API Providers
In the Playground configuration drawer:
* Select your LLM Provider: **Google Gemini API** or **Local Ollama**.
* If choosing Gemini API, enter your `GEMINI_API_KEY` (or save it in a `.env` file at the root of the project directory).
* If using Ollama, ensure the Ollama background daemon is running on your machine on port `11434` with the `hermes3` model installed.

#### 5.4. Triggering, Observing & Log Streaming
1. Enter the background profile of the case.
2. Select the target file to analyze.
3. Click **`Start Multi-Agent Team`**.
4. The Playground dynamically updates task cards across the status board (To Do, Doing, Done).
5. The terminal panel at the bottom streams real-time logs (e.g., *"Reading report"*, *"Writing report"*).
6. When complete, the final HTML report card is saved to your Kanban board.

---

## ⚙️ Part II: Admin & Developer Handbook

### 6. Technology Stack & Architectural Overview

Resolution Bazaar operates in a hybrid environment, merging chromium browser interfaces with background node threads.

```
       ┌─────────────────────────────────────────────────────────┐
       │             NW.js Desktop Runtime Container             │
       │                                                         │
       │   ┌───────────────────────────┐                         │
       │   │ Chromium Renderer Process │                         │
       │   │  - UI Views & Controllers │ (Mixed Context)         │
       │   └─────────────┬─────────────┘                         │
       │                 │                                       │
       │        IPC Channels (stdin/stdout JSON Pipes)           │
       │                 │                                       │
       │   ┌─────────────▼─────────────┐                         │
       │   │   Background Node.js      │                         │
       │   │  - Multi-Agent Teams      │                         │
       │   │  - KaibanJS Engine        │                         │
       │   └───────────────────────────┘                         │
       └─────────────────────────────────────────────────────────┘
```

* **Core Runtime Container**: **NW.js v0.108.0-sdk**. NW.js allows running Node.js and Chromium side-by-side, enabling files access, child process management, and local system thread tasks directly inside your UI scripts.
* **ReAct Agent Loop Engine**: Built with a custom reasoning loop supporting standard tools like directory crawling, text files search (`search_wiki`), and index file reading.
* **LLM Engine Options**:
  * **Llamafile (v0.8.8+)**: A single-file executable local server compiled using Cosmopolitan Libc. It listens on port `8080` to provide an offline, OpenAI-compatible local chat endpoint.
  * **Ollama (v0.1.48+)**: A local developer runner service listening on port `11434`.
  * **Gemini API**: Connected via HTTPS using the `/v1beta/models/` Google API endpoint.

---

### 7. Directory Structure & Key Code Mappings

The dashboard and agent components are organized into highly modular, decoupled directories:

```
TiddlyDesk/
├── package.json              # Main package configuration with dependencies
├── run.sh                    # Startup wrapper for synchronizing and running the app
├── test_interactive.js       # CDP interactive browser automation script
│
└── source/
    ├── package.json          # NW.js app entry and Chromium arguments configuration
    │
    ├── html/
    │   ├── main.html         # Boot window template
    │   ├── dashboard.html    # Core dashboard view, boards, and sidebar layout
    │   └── kaiban-playground.html # Multi-agent playground view
    │
    └── js/
        ├── run_agent.js      # Background process runner for KaibanJS
        ├── dashboard.js      # Thin mediator script booting controllers
        │
        └── dashboard/
            ├── controllers/         # UI Component Controllers
            │   ├── workspace.controller.js # Workspace tabs creation and renaming
            │   ├── project.controller.js   # Link projects, watchers, and UI refresh
            │   ├── kanban.controller.js    # Card rendering, drag-drop, and filters
            │   ├── basket.controller.js    # Analyse basket dropzone and extractions
            │   └── agent.controller.js     # Unified agent sidebar pane controller
            │
            ├── services/            # Business Logic Services
            │   ├── project.service.js      # Workspace project scanning and database
            │   ├── config.service.js       # Global config storage manager
            │   ├── agent.service.js        # Custom single-agent reasoning loop orchestrator
            │   ├── kaiban.service.js       # Multi-agent team orchestration driver
            │   └── okf.service.js          # Ingestion crawler converting files to OKF format
            │
            ├── agent/               # Custom ReAct Agent Runner
            │   ├── llm.client.js           # HTTP/HTTPS clients for Ollama and Gemini APIs
            │   └── tool.executor.js        # Tools executor (read_wiki_index, search_wiki, read_report)
            │
            ├── skills/              # Prompts and configuration checklists
            │   ├── okf-qa.skill.js         # Prompt structure for case Q&A agent
            │   ├── section-29a.skill.js    # Guidelines for applicant eligibility audits
            │   └── index.js                # Core register exporting all skills
            │
            └── utils/               # Decoupled Stateless Utilities
                ├── safe-fs.js              # Try/catch wrapped safe file-system helper
                ├── markdown.utils.js       # Regex converter mapping markdown to HTML
                └── agent.utils.js          # Text cleaners and HTML templates compiler
```

#### 7.1. Core Mediator (`dashboard.js`)
The main file [dashboard.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard.js) serves as a thin mediator script that boots up individual component controllers:
```javascript
// dashboard.js - Mediator Pattern Bootstrapper
"use strict";

const projectService = require("../js/dashboard/services/project.service");

window.controllers = {
  markdown:  require("../js/dashboard/utils/markdown.utils"),
  workspace: require("../js/dashboard/controllers/workspace.controller"),
  project:   require("../js/dashboard/controllers/project.controller"),
  kanban:    require("../js/dashboard/controllers/kanban.controller"),
  basket:    require("../js/dashboard/controllers/basket.controller"),
  agent:     require("../js/dashboard/controllers/agent.controller")
};

function boot() {
  window.projectService = projectService;
  window._loadWikis = window.controllers.kanban.loadWikis;

  showView("dashboardView");
  
  window.controllers.workspace.initWorkspaces();
  window.controllers.project.initDashboard();
  window.controllers.kanban.initDragAndDrop();
  window.controllers.basket.initBasket();
  window.controllers.agent.initAgent();
}
```

#### 7.2. Split Controller Architecture
To keep the codebase easy to maintain, UI controls are split into independent files under [source/js/dashboard/controllers/](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/controllers/):
* [workspace.controller.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/controllers/workspace.controller.js): Handles creating, deleting, renaming, and switching workspaces.
* [project.controller.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/controllers/project.controller.js): Manages adding, removing, and renaming case project card links. Establishes the `fs.watch` event hooks to update the Kanban view dynamically when files are added or deleted.
* [kanban.controller.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/controllers/kanban.controller.js): Binds drag-and-drop actions to columns, renders cards, and applies sorting filters.
* [basket.controller.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/controllers/basket.controller.js): Binds mouse drop gestures to the bottom sidebar dropzone, extracting file contents.
* [agent.controller.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/controllers/agent.controller.js): Connects sidebar form fields to the OKF ingestion and ReAct Agent loop, updates thinking logs, and compiles reports.

---

### 8. Mixed-Context Crash Prevention & Decoupling

#### 8.1. Analysis of the Chromium Module Record Resolver Crash
When running NW.js in a mixed-context environment (where Node.js context and browser DOM context are shared), importing CommonJS modules that contain nested ES modules or WebAssembly libraries (such as `@xenova/transformers` or `kaibanjs` + `@langchain/core`) inside a renderer page triggers a fatal V8 resolver crash:

```
FATAL:module_record_resolver_impl.cc(132)] Check failed: it != record_to_module_script_map_.end(). Failed to find ModuleScript corresponding to the record.[[HostDefined]]
```

This occurs because the Chromium V8 engine tries to resolve imports using its standard browser module resolver, which conflicts with Node's CommonJS module system during async initialization.

#### 8.2. Background Node Processes
To prevent this, Resolution Bazaar isolates heavy libraries inside background Node.js processes.
* **Agent Engine**: The agent playground (`kaiban-playground.js`) spawns a child process running `run_agent.js`, which loads `kaibanjs` safely.
* **Inter-Process Communication (IPC)**:
  * The main window sends instructions by writing to `stdin` on the spawned child process.
  * The child process writes results back as structured JSON lines on `stdout`, which the parent process parses in real-time.

```javascript
// IPC Spawn in kaiban-playground.js
const { spawn } = require("child_process");
const child = spawn("node", [path.join(__dirname, "run_agent.js")]);

// Send JSON instructions
child.stdin.write(JSON.stringify({ provider, apiKey, model, aboutMeText }));
child.stdin.end();

// Receive JSON events
child.stdout.on("data", (data) => {
  const payload = JSON.parse(data.toString());
  if (payload.type === "log") {
    log(payload.message, payload.style);
  }
});
```

#### 8.3. Lazy Requirements & Scoped Modules Resolution
To prevent the main renderer thread from inadvertently loading heavy node modules at startup, all requires are loaded lazily inside function blocks rather than at the top of the file:
```javascript
// Correct: Lazy load inside action handlers
function triggerIngest() {
  const okfService = require("../services/okf.service"); // Loaded only when needed
  okfService.ingestProject(...);
}
```

#### 8.4. Network Debugging: Replacing "localhost" with "127.0.0.1"
When connecting to debugging sockets (such as Chrome DevTools Protocol or local WebSocket endpoints), Node.js DNS resolution on macOS defaults to IPv6 (`::1`). Since the NW.js runtime listens on IPv4 (`127.0.0.1`), using `"localhost"` causes connections to hang or throw `ECONNRESET`. All service connections in the codebase explicitly target `"127.0.0.1"` directly.

---

### 9. OKF Ingestion & In-Memory Grep Search Implementation Details

#### 9.1. Mechanical Ingestion & Normalization
The ingestion pipeline converts all workspace reports, wikis, and uploads into a standard, vendor-neutral directory structure inside `.tiddlydesk-okf/`:
1. **Metadata Headers Extraction**: Standardizes files by compiling their properties (such as title, tags, and last modification timestamp) into a formatted YAML frontmatter block at the top of each Markdown document.
2. **Text Normalization**: Strips HTML tags, script elements, CSS style declarations, and entities from raw reports and documents before saving.
3. **Filter System Tiddlers**: Ignores TiddlyWiki system files starting with `$:/` to ensure only actual workspace data is indexed.

#### 9.2. Incremental Crawler Algorithm
To keep workspace crawling lightning-fast (<10ms on subsequent runs), the ingestion pipeline uses an incremental check:
* The system checks the filesystem modification timestamp (`mtimeMs`) for each file in the workspace directory.
* It compares the `mtimeMs` against the recorded timestamp inside `.tiddlydesk-okf/manifest.json`.
* Files that haven't been modified are skipped. Only modified or new files are crawled.

#### 9.3. Grep Search Tool Implementation
The Agent runs keyword queries on the OKF catalog using the `search_wiki` tool. Instead of complex vector embeddings databases, this tool leverages lightweight, fast regex search:
* Performs recursive, case-insensitive keyword searches matching terms inside the `.tiddlydesk-okf/` catalog text files.
* Returns snippets containing the matched text, allowing the agent to locate precise information across the catalog.

---

### 10. Multi-Agent ReAct Execution Engine

For the custom single-agent skills, the application runs a lightweight autonomous reasoning loop implementing the **ReAct (Reasoning and Action)** framework.

```
                  ┌──────────────────────────────┐
                  │          User Prompt         │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
  ┌────────────────►│     LLM Thought Turn     │◀─────────────────┐
  │                 └────────────┬─────────────┘                  │
  │                              │                                │
  │                     Does it call a Tool?                      │
  │                     /                  \                      │
  │                    YES                 NO                     │
  │                    /                     \                    │
  │         ┌─────────▼────────┐     ┌────────▼────────┐          │
  │         │   Execute Tool   │     │  Return Final   │          │
  │         │  (Local JS Fn)   │     │  HTML Report    │          │
  │         └─────────┬────────┘     └─────────────────┘          │
  │                   │                                           │
  │                   ▼                                           │
  └───────────── Observation                                      │
                (Feed output back into LLM history) ──────────────┘
```

#### 10.1. ReAct Execution Protocol
The execution engine runs for a maximum of 12 turns:
1. **Thought**: The LLM determines the next action and decides whether to call a tool (such as `read_wiki_index` or `search_wiki`).
2. **Action**: If a tool is called, the loop pauses and executes the associated local JavaScript helper.
3. **Observation**: The output from the tool is formatted and appended to the model's message history.
4. The loop repeats until the LLM returns its final text response or calls `write_report`.

#### 10.2. Tool Definitions & Arguments Translator
The client file [llm.client.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/agent/llm.client.js) translates standard JSON Schema tool declarations into format-compliant payloads:
* **Ollama**: Sends standard OpenAI-like function declarations.
* **Gemini**: Translates parameters to uppercase structure formats (`type: "string"` -> `type: "STRING"`) and wraps function calls under `functionCall`/`functionResponse` block declarations.

```javascript
// Translation adapter for Gemini compatibility
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
  return newSchema;
}
```

---

### 11. Custom Skill Configuration

Specialized agent tasks are defined in the `source/js/dashboard/skills/` directory.

#### 11.1. Section 29A Eligibility Compliance Check
* **File**: [section-29a.skill.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/skills/section-29a.skill.js)
* **Goal**: Analyzes profile summaries and applicant declarations against Indian IBC Section 29A clauses (a) to (j) to verify applicant eligibility.
* **Target Output**: Generates an eligibility verification summary table containing compliance flags (`CLEAR`, `RED FLAG`, `INSUFFICIENT INFO`) alongside a final eligibility verdict.

#### 11.2. Statutory Plan Auditor
* **File**: [statutory-plan-audit.skill.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/skills/statutory-plan-audit.skill.js)
* **Goal**: Compares resolution plans against the compliance checklist defined under IBC Section 30(2) and CIRP Regulation 38.
* **Target Output**: Generates a structured statutory compliance table confirming payouts, priority coverages, and process costs.

#### 11.3. Valuation Reconciliation
* **File**: [valuation-reconciliation.skill.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/skills/valuation-reconciliation.skill.js)
* **Goal**: Parses asset valuation logs prepared by two independent registered valuers.
* **Target Output**: Identifies both valuers' estimates, extracts fair and liquidation values across asset classes (Land & Buildings, Plant & Machinery, Financial Assets), computes variance margins, and flags variances exceeding 25% (triggering third-valuer requirements under CIRP rules).

#### 11.4. OKF Catalog Q&A Skill
* **File**: [okf-qa.skill.js](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/source/js/dashboard/skills/okf-qa.skill.js)
* **Goal**: Instructs the agent to answer questions by navigating the Case Catalog, reading the index, and running keyword searches.

---

### 12. Build System, Testing, & Release Packaging

#### 12.1. Sync-to-Bundle Script (`run.sh`)
During development, running full compilation cycles to preview changes is slow. The script [run.sh](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/run.sh) speeds this up by using `rsync` to sync your code edits in `source/js` and `source/html` directly to the active NW.js bundle directories before starting the application:
```bash
sync_to_bundle() {
  rsync -a --include="*/" --include="*.js" --include="*.html" --include="*.css" \
        --exclude="*" source/js/ "$BUNDLE/js/"
}
```
* **Command**: Run `./run.sh` to quickly start the application with your latest code updates.

#### 12.2. Standard Compilation (`bld.sh` and `package.sh`)
When packaging a release:
* [bld.sh](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/bld.sh): Downloads the NW.js runtime, minifies JS files, and builds binaries for Mac (Intel & Apple Silicon), Windows, and Linux.
* [package.sh](file:///Users/atulgrover/Desktop/TiddlyDesktop/TiddlyDesk/package.sh): Zips the built assets into release-ready files inside the `output/` directory.

#### 12.3. Offline Verification Suite
To verify changes without running the full application UI:
* **OKF Ingestion Unit Tests**: Run the unit test suite (`test_okf.js`) using Node to verify HTML stripping, YAML frontmatter output schema, manifest caching, and incremental crawl efficiency.
* **Interactive Automation Tests**: Run `node test_interactive.js` to open the application in SDK debug mode, connect via Chrome DevTools Protocol, and verify UI tabs navigation, drag-and-drop operations, and indexing triggers.
