// kaiban-skills.js – Multi-Agent Skill Configurations for KaibanJS in TiddlyDesk
"use strict";

const path = require("path");
const { Agent, Task, Team } = require("kaibanjs");

module.exports = {
  // ─── Section 29A Eligibility Verification ──────────────────────────────────
  section_29a: {
    displayName: "Section 29A Compliance Verification",
    description: "Verifies resolution applicant eligibility under IBC Section 29A disqualification criteria using collaborating agents.",
    build(params, tools, llmConfig) {
      const auditor = new Agent({
        name: "Insolvency Compliance Expert",
        role: "Legal Auditor",
        goal: "Analyze the applicant profile for Section 29A (a)-(j) compliance.",
        background: "Expert in Insolvency & Bankruptcy Code 2016.",
        tools: [tools.readReportTool],
        llmConfig
      });

      const reporter = new Agent({
        name: "Corporate Reporter",
        role: "Compliance Writer",
        goal: "Draft the final Section 29A compliance report and write it to disk.",
        background: "Legal reporter and technical document author.",
        tools: [tools.writeReportTool],
        llmConfig
      });

      const auditTask = new Task({
        title: "Compliance Audit",
        description: `Read the report located at: "${params.reportPath}". Analyze the applicant for undischarged insolvency, NPA accounts for 1+ years, RBI wilful defaulter tags, SEBI trading prohibitions, and related connected person disqualifications under Section 29A.`,
        expectedOutput: "A structured summary of findings for criteria (a) through (j).",
        agent: auditor,
        targetFilePath: params.reportPath
      });

      const reportTask = new Task({
        title: "Generate Compliance Report",
        description: `Compile the S.29A audit findings into a detailed Markdown report and call write_report tool.
Parameters:
- board_path: "${params.boardPath}"
- file_name: "${params.outputName}"
- title: "Section 29A Eligibility Report"
- content_markdown: (the structured report with Applicant Details, Verification Summary Table, Red Flags, and Verdict)
- skill_name: "Section 29A Verification"`,
        expectedOutput: "Confirmation of HTML file saved to disk.",
        agent: reporter,
        dependencies: [auditTask]
      });

      return new Team({
        name: "Section 29A Compliance Team",
        agents: [auditor, reporter],
        tasks: [auditTask, reportTask]
      });
    }
  },

  // ─── Statutory Plan Audit ──────────────────────────────────────────────────
  statutory_plan_audit: {
    displayName: "Statutory Plan Audit",
    description: "Performs audit of resolution plans for IBC Section 30(2) and CIRP Regulation 38 compliance.",
    build(params, tools, llmConfig) {
      const auditor = new Agent({
        name: "Resolution Plan Auditor",
        role: "Compliance Auditor",
        goal: "Audit the resolution plan text for statutory compliance.",
        background: "Specialized in S.30(2) minimum payments and CoC requirements.",
        tools: [tools.readReportTool],
        llmConfig
      });

      const compiler = new Agent({
        name: "Audit Compiler",
        role: "Report Compiler",
        goal: "Compile audit findings and write the statutory compliance report to disk.",
        background: "Technical writer for insolvency resolution reporting.",
        tools: [tools.writeReportTool],
        llmConfig
      });

      const auditTask = new Task({
        title: "Statutory Audit",
        description: `Read the resolution plan located at: "${params.reportPath}". Verify compliance with CIRP regulations, payment of CIRP cost, payment of operational creditors, payment of dissenting financial creditors, and implementation timeline.`,
        expectedOutput: "Detailed audit matrix showing compliant / non-compliant items.",
        agent: auditor,
        targetFilePath: params.reportPath
      });

      const reportTask = new Task({
        title: "Compile Audit Report",
        description: `Format the plan audit matrix into a Markdown report and write it to disk.
Parameters:
- board_path: "${params.boardPath}"
- file_name: "${params.outputName}"
- title: "Statutory Plan Audit Report"
- content_markdown: (the final audit report showing Compliance Matrix, Missing Information, and RP Recommendations)
- skill_name: "Statutory Plan Audit"`,
        expectedOutput: "Confirmation of HTML file saved to disk.",
        agent: compiler,
        dependencies: [auditTask]
      });

      return new Team({
        name: "Statutory Plan Audit Team",
        agents: [auditor, compiler],
        tasks: [auditTask, reportTask]
      });
    }
  },

  // ─── Valuation Reconciliation ──────────────────────────────────────────────
  valuation_reconciliation: {
    displayName: "Valuation Reconciliation",
    description: "Cross-references two independent valuer reports and calculates haircuts for Committee of Creditors review.",
    build(params, tools, llmConfig) {
      const extractor = new Agent({
        name: "Valuation Auditor",
        role: "Financial Extractor",
        goal: "Extract asset values, liquidation values, and fair values from two reports.",
        background: "Chartered accountant and valuation compliance expert.",
        tools: [tools.readReportTool],
        llmConfig
      });

      const reconciler = new Agent({
        name: "Lead Reconciler",
        role: "Financial Analyst",
        goal: "Perform calculations to reconcile values, compute variance, and write output report.",
        background: "Investment banker and insolvency professional.",
        tools: [tools.writeReportTool],
        llmConfig
      });

      const extractTask1 = new Task({
        title: "Extract Valuer 1 Report",
        description: `Read the Valuer 1 report at path: "${params.valuation1Path}". Extract Liquidation Value and Fair Value for each asset class.`,
        expectedOutput: "Summary of Valuer 1 values.",
        agent: extractor,
        targetFilePath: params.valuation1Path
      });

      const extractTask2 = new Task({
        title: "Extract Valuer 2 Report",
        description: `Read the Valuer 2 report at path: "${params.valuation2Path}". Extract Liquidation Value and Fair Value for each asset class.`,
        expectedOutput: "Summary of Valuer 2 values.",
        agent: extractor,
        targetFilePath: params.valuation2Path
      });

      const reconTask = new Task({
        title: "Reconcile Valuations",
        description: `Compare values from Valuer 1 and Valuer 2. Calculate variance percentage. Compute the average values and draft the final HTML reconciliation report.
Parameters:
- board_path: "${params.boardPath}"
- file_name: "${params.outputName}"
- title: "Valuation Reconciliation Report"
- content_markdown: (the comparative table, variance math, and recommendations)
- skill_name: "Valuation Reconciliation"`,
        expectedOutput: "Valuation reconciliation report written successfully.",
        agent: reconciler,
        dependencies: [extractTask1, extractTask2]
      });

      return new Team({
        name: "Valuation Reconciliation Team",
        agents: [extractor, reconciler],
        tasks: [extractTask1, extractTask2, reconTask]
      });
    }
  },

  // ─── Investor Fit Analysis ─────────────────────────────────────────────────
  investor_fit: {
    displayName: "Investor Fit Analysis",
    description: "Evaluates applicant capability, financial strength, and sector fit for reviving the Corporate Debtor.",
    build(params, tools, llmConfig) {
      const profileAnalyst = new Agent({
        name: "Corporate Profiler",
        role: "Financial Analyst",
        goal: "Analyze investor profile, capital resources, and track record.",
        background: "Private equity and credit analyst.",
        tools: [tools.readReportTool],
        llmConfig
      });

      const industryExpert = new Agent({
        name: "Sector Specialist",
        role: "Industry Consultant",
        goal: "Evaluate sectoral synergy, track record of managing similar business, and revival plan feasibility.",
        background: "Industrial operations and restructuring advisory.",
        tools: [tools.readReportTool],
        llmConfig
      });

      const complianceManager = new Agent({
        name: "Resolution Partner",
        role: "Lead Restructuring Advisor",
        goal: "Merge the capability and sector analysis into the final evaluation score and write report to disk.",
        background: "Senior Restructuring Partner.",
        tools: [tools.writeReportTool],
        llmConfig
      });

      const profileTask = new Task({
        title: "Analyze Investor Profile",
        description: `Read the profile document at: "${params.reportPath}". Assess net worth, capital availability, and track record.`,
        expectedOutput: "Summary of financial strength and capital resources.",
        agent: profileAnalyst,
        targetFilePath: params.reportPath
      });

      const sectorTask = new Task({
        title: "Evaluate Sector Synergy",
        description: `Read the profile document at: "${params.reportPath}". If provided, read the Corporate Debtor overview at: "${params.cdReportPath || ''}". Assess sector fit and operational capability.`,
        expectedOutput: "Synergy and operations track record assessment.",
        agent: industryExpert
      });

      const reportTask = new Task({
        title: "Generate Fit Assessment Report",
        description: `Combine financial capability and sector fit into a 6-dimension scoring matrix and write report to disk.
Parameters:
- board_path: "${params.boardPath}"
- file_name: "${params.outputName}"
- title: "Investor Fit Analysis"
- content_markdown: (the final 6-dimension scoring matrix, sector fit assessment, and restructuring suggestions)
- skill_name: "Investor Fit Analysis"`,
        expectedOutput: "Investor fit HTML report saved.",
        agent: complianceManager,
        dependencies: [profileTask, sectorTask]
      });

      return new Team({
        name: "Investor Fit Team",
        agents: [profileAnalyst, industryExpert, complianceManager],
        tasks: [profileTask, sectorTask, reportTask]
      });
    }
  },

  // ─── Plan Comparison ───────────────────────────────────────────────────────
  plan_comparison: {
    displayName: "Plan Comparison",
    description: "Performs head-to-head quantitative and qualitative comparison between two competing resolution plans.",
    build(params, tools, llmConfig) {
      const analystA = new Agent({
        name: "Auditor Plan A",
        role: "Financial Analyst",
        goal: "Analyze and extract bids from Resolution Plan A.",
        background: "Specialized in bid evaluation and structured cashflows.",
        tools: [tools.readReportTool],
        llmConfig
      });

      const analystB = new Agent({
        name: "Auditor Plan B",
        role: "Financial Analyst",
        goal: "Analyze and extract bids from Resolution Plan B.",
        background: "Specialized in bid evaluation and structured cashflows.",
        tools: [tools.readReportTool],
        llmConfig
      });

      const headOfRecon = new Agent({
        name: "Lead Insolvency Specialist",
        role: "Audit Chair",
        goal: "Compare extracted bids side-by-side, calculate weighted scores, and write final report.",
        background: "Experienced IP facilitating CoC negotiations.",
        tools: [tools.writeReportTool],
        llmConfig
      });

      const taskA = new Task({
        title: "Analyze Plan A",
        description: `Read Plan A at: "${params.planAPath}". Extract upfront payment, total bid value, haircut %, payment to operational creditors, and timeline.`,
        expectedOutput: "Financial summary of Plan A.",
        agent: analystA,
        targetFilePath: params.planAPath
      });

      const taskB = new Task({
        title: "Analyze Plan B",
        description: `Read Plan B at: "${params.planBPath}". Extract upfront payment, total bid value, haircut %, payment to operational creditors, and timeline.`,
        expectedOutput: "Financial summary of Plan B.",
        agent: analystB,
        targetFilePath: params.planBPath
      });

      const compareTask = new Task({
        title: "Generate Plan Comparison Report",
        description: `Reconcile findings from Plan A and Plan B. Output a comparative matrix table and a 5-dimension weighted scoring board, then call write_report.
Parameters:
- board_path: "${params.boardPath}"
- file_name: "${params.outputName}"
- title: "Resolution Plan Comparative Analysis"
- content_markdown: (the comparisons, scoring matrix, and recommendation)
- skill_name: "Plan Comparison"`,
        expectedOutput: "HTML report saved to disk.",
        agent: headOfRecon,
        dependencies: [taskA, taskB]
      });

      return new Team({
        name: "Plan Comparison Team",
        agents: [analystA, analystB, headOfRecon],
        tasks: [taskA, taskB, compareTask]
      });
    }
  },

  // ─── KaibanJS Demo Team ────────────────────────────────────────────────────
  demo_kaiban: {
    displayName: "KaibanJS Demo Team",
    description: "Collaborative Researcher + Writer demo team that researches KaibanJS and generates an introduction report.",
    build(params, tools, llmConfig) {
      const targetPath = path.join(params.boardPath, params.outputName);

      const researcher = new Agent({
        name: "Kaiban Researcher",
        role: "Research Specialist",
        goal: "Research and explain the benefits, architecture, and features of KaibanJS.",
        background: "Expert in multi-agent orchestration frameworks and LLM agent design patterns.",
        tools: [],
        llmConfig
      });

      const writer = new Agent({
        name: "Kaiban Writer",
        role: "Technical Author",
        goal: "Summarize findings and write a comprehensive HTML guide using writeReportTool.",
        background: "Technical writer specialized in developer documentation and software architectures.",
        tools: [tools.writeReportTool],
        llmConfig
      });

      const researchTask = new Task({
        title: "Research KaibanJS",
        description: "Analyze KaibanJS library. Highlight key concepts (Agents, Tasks, Teams), its visual Kanban board integration, and why it is useful for collaborative multi-agent teams.",
        expectedOutput: "A detailed description of KaibanJS's features, benefits, and components.",
        agent: researcher,
        targetFilePath: targetPath
      });

      const writeTask = new Task({
        title: "Write KaibanJS Report",
        description: `Compile the research findings into a beautifully formatted Markdown report and write it using the write_report tool.
Parameters:
- board_path: "${params.boardPath}"
- file_name: "${params.outputName}"
- title: "Introduction to KaibanJS and Multi-Agent Orchestration"
- content_markdown: (the Markdown report outlining overview, core concepts, team structures, and benefits)
- skill_name: "KaibanJS Demo Team"`,
        expectedOutput: "Confirmation that the KaibanJS guide HTML file has been written to the board path.",
        agent: writer,
        dependencies: [researchTask],
        targetFilePath: targetPath
      });

      return new Team({
        name: "KaibanJS Demo Team",
        agents: [researcher, writer],
        tasks: [researchTask, writeTask]
      });
    }
  }
};
