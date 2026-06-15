// investor-fit.skill.js
// IBC Investor / Resolution Applicant Fit Analysis Skill
"use strict";

const TOOLS = require("./tools");

const INVESTOR_FIT_FRAMEWORK = `
RESOLUTION APPLICANT EVALUATION DIMENSIONS:
1. Financial Capability (Net worth, debt capacity, funding confirmation)
2. Operational Expertise (Sector experience, management bandwidth, synergies)
3. Strategic Fit (Rationale, business plan credibility, employment preservation)
4. Regulatory & Compliance Profile (Licences, CCI/SEBI/RBI approvals needed)
5. Commercial Terms (Upfront payment, deferred structure, guarantees, CPs)
6. Risk Assessment (Implementation risk, litigation, concentration risk)
`;

const SYSTEM_PROMPT = `You are a senior Insolvency Professional and M&A specialist with deep expertise in IBC CIRP resolution.

CRITICAL INSTRUCTION: You have exactly TWO steps:
STEP 1: Call read_report to read the applicant's document.
STEP 2: Immediately call write_report with your COMPLETE fit analysis. Do NOT call any other tool.

Do NOT call list_reports. Do NOT call read_report more than once.

${INVESTOR_FIT_FRAMEWORK}

Your write_report content_markdown must follow this structure:
# Investor Fit Analysis Report

## Applicant Profile Summary

## Scoring Matrix
| Dimension | Score (/10) | Key Evidence | Risk |
|---|---|---|---|
| Financial Capability | | | |
| Operational Expertise | | | |
| Strategic Fit | | | |
| Regulatory Profile | | | |
| Commercial Terms | | | |
| Risk Assessment | | | |
| **TOTAL (Weighted)** | **/10** | | |

## Regulatory Clearances Required
## Commercial Terms Analysis
## Risk Matrix
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

## Comparison vs Liquidation
## Overall Recommendation to CoC
**RECOMMEND ACCEPTANCE** / **RECOMMEND REJECTION** / **CONDITIONAL ACCEPTANCE**
`;

module.exports = {
  displayName: "Investor Fit Analysis",
  description:  "Analyses resolution applicant financial capability, operational fit, strategic rationale, and risk profile for CoC decision-making",

  build(params) {
    const {
      reportPath,
      boardPath,
      cdReportPath,
      outputName = "Investor_Fit_Analysis.html"
    } = params;

    const steps = cdReportPath
      ? `1. Call read_report with file_path="${reportPath}"
2. Call read_second_report with file_path="${cdReportPath}"
3. Immediately call write_report`
      : `1. Call read_report with file_path="${reportPath}"
2. Immediately call write_report`;

    const userMessage = `Perform an investor fit analysis for the resolution applicant.

EXACT STEPS — follow in order:
${steps}

write_report parameters:
- board_path: "${boardPath}"
- file_name: "${outputName}"
- title: "Investor Fit Analysis Report"
- content_markdown: (your full 6-dimension analysis with scoring matrix)

IMPORTANT: Do NOT call list_reports. Do NOT call any extra tools. Read → Analyse → Write immediately.`;

    return {
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      tools: cdReportPath
        ? [TOOLS.READ_REPORT, TOOLS.READ_SECOND_REPORT, TOOLS.WRITE_REPORT]
        : [TOOLS.READ_REPORT, TOOLS.WRITE_REPORT]
    };
  }
};
