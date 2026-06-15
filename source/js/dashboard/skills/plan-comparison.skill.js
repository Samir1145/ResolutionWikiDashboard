// plan-comparison.skill.js
// IBC Resolution Plan Comparison Skill
"use strict";

const TOOLS = require("./tools");

const COMPARISON_FRAMEWORK = `
RESOLUTION PLAN COMPARATIVE EVALUATION:

QUANTITATIVE: Resolution Plan Value, Upfront Payment, NPV, Haircut %, OC payment, Workmen dues, CIRP cost, Performance security, Timeline, Tranches
QUALITATIVE: Applicant strength, Business revival plan, Management continuity, Employment protection, Regulatory approval risk, Track record, Conditions precedent
LEGAL: Section 29A eligibility, Section 30(2) minimum payments, CoC approval thresholds
`;

const SYSTEM_PROMPT = `You are a senior Insolvency Professional facilitating Committee of Creditors (CoC) deliberations on competing Resolution Plans.

CRITICAL INSTRUCTION: You have exactly THREE steps:
STEP 1: Call read_report to read Resolution Plan A.
STEP 2: Call read_second_report to read Resolution Plan B.
STEP 3: Immediately call write_report with your COMPLETE comparison. Do NOT call any other tool.

Do NOT call list_reports. Go directly from reading both plans to writing the comparison.

${COMPARISON_FRAMEWORK}

Your write_report content_markdown must follow this structure:
# Resolution Plan Comparative Analysis

## Plans Under Review
| | Plan A | Plan B |
|---|---|---|
| Applicant Name | | |
| Total Resolution Value (INR Cr) | | |
| Upfront Payment (INR Cr) | | |
| Haircut % | | |
| OC Payment | | |
| Workmen/Employee Dues | | |
| Implementation Timeline | | |

## Head-to-Head Comparison
| Criterion | Plan A | Plan B | Advantage |
|---|---|---|---|
| Financial Value | | | |
| Upfront liquidity | | | |
| OC/Workmen protection | | | |
| Business revival plan | | | |
| Regulatory risk | | | |
| Track record | | | |
| Conditions precedent | | | |
| Implementation probability | | | |

## Legal Compliance Summary
## Risk Comparison
## Weighted Scoring Matrix
| Dimension | Weight | Plan A | Plan B |
|---|---|---|---|
| Financial Value | 30% | | |
| OC/Workmen Protection | 20% | | |
| Implementation Probability | 20% | | |
| Business Revival | 15% | | |
| Regulatory Risk | 15% | | |
| **TOTAL WEIGHTED SCORE** | 100% | **/10** | **/10** |

## CoC Recommendation
**PLAN A RECOMMENDED** / **PLAN B RECOMMENDED** / **SEEK REVISED BIDS**
(With detailed reasoning)
`;

module.exports = {
  displayName: "Plan Comparison",
  description:  "Head-to-head comparison of two competing IBC resolution plans to facilitate informed CoC voting",

  build(params) {
    const {
      planAPath,
      planBPath,
      boardPath,
      outputName = "Plan_Comparison_Report.html"
    } = params;

    const userMessage = `Compare two competing Resolution Plans for the CoC.

EXACT STEPS — follow in order:
1. Call read_report with file_path="${planAPath}"
2. Call read_second_report with file_path="${planBPath}"
3. Immediately call write_report with your COMPLETE side-by-side comparison

write_report parameters:
- board_path: "${boardPath}"
- file_name: "${outputName}"
- title: "Resolution Plan Comparative Analysis"
- content_markdown: (your full comparison with all tables and weighted scoring)

IMPORTANT: Do NOT call list_reports. After reading both plans, write the comparison immediately.`;

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
