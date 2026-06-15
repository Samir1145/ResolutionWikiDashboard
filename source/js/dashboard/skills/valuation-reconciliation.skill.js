// valuation-reconciliation.skill.js
// IBC Valuation Reconciliation Skill
"use strict";

const TOOLS = require("./tools");

const VALUATION_FRAMEWORK = `
IBC VALUATION REQUIREMENTS (Regulation 27):
- Two independent Registered Valuers mandatory
- If divergence > 25%: Third valuer must be appointed
- If divergence ≤ 25%: Average of both is the benchmark

KEY METRICS TO RECONCILE:
- Enterprise Value (EV), Net Asset Value (NAV)
- Fair Value vs Liquidation Value of fixed assets
- Going concern value, EBITDA multiples, DCF assumptions
- Haircut % = (Admitted Claims - Resolution Plan Value) / Admitted Claims × 100
`;

const SYSTEM_PROMPT = `You are an expert valuation analyst and Insolvency Professional specialising in asset valuation under the IBC framework.

CRITICAL INSTRUCTION: You have exactly THREE steps:
STEP 1: Call read_report to read Valuer 1's report.
STEP 2: Call read_second_report to read Valuer 2's report.
STEP 3: Immediately call write_report with your COMPLETE reconciliation. Do NOT call any other tool.

Do NOT call list_reports. Do NOT call read_report more than once. Go directly from reading both reports to writing.

${VALUATION_FRAMEWORK}

Your write_report content_markdown must follow this structure:
# Valuation Reconciliation Report

## Valuation Summary
| Metric | Valuer 1 | Valuer 2 | Variance % | Benchmark |
|---|---|---|---|---|
| Fair Value (INR Cr) | | | | |
| Liquidation Value (INR Cr) | | | | |
| EV (INR Cr) | | | | |

## Methodology Comparison
## Divergence Analysis
**Divergence: __% → Third Valuer Required: YES/NO**

## Liquidation Value vs Resolution Plan
| Item | Amount (INR Cr) |
|---|---|
| Average Liquidation Value | |
| Resolution Plan Offer | |
| Shortfall/Surplus | |

## Haircut Analysis
## Red Flags in Valuation Assumptions
## VERDICT: COMPLIANT / REQUIRES THIRD VALUER / NON-COMPLIANT
## Recommendations to CoC
`;

module.exports = {
  displayName: "Valuation Reconciliation",
  description:  "Reconciles two independent valuation reports and compares against resolution plan value under Regulation 27",

  build(params) {
    const {
      valuation1Path,
      valuation2Path,
      planPath,
      boardPath,
      outputName = "Valuation_Reconciliation_Report.html"
    } = params;

    const userMessage = `Perform a valuation reconciliation analysis.

EXACT STEPS — follow in order:
1. Call read_report with file_path="${valuation1Path}"
2. Call read_second_report with file_path="${valuation2Path || valuation1Path}"
${planPath ? `3a. Call read_report with file_path="${planPath}" for plan offer amount\n3b.` : "3."}  Immediately call write_report with your COMPLETE reconciliation

write_report parameters:
- board_path: "${boardPath}"
- file_name: "${outputName}"
- title: "Valuation Reconciliation Report"
- content_markdown: (your full markdown reconciliation with all tables)

IMPORTANT: Do NOT call list_reports or any extra tools. Read → Reconcile → Write.`;

    return {
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      tools: [
        TOOLS.READ_REPORT,
        TOOLS.READ_SECOND_REPORT,
        TOOLS.WRITE_REPORT
      ]
    };
  }
};
