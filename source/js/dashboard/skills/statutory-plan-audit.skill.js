// statutory-plan-audit.skill.js
// IBC Statutory Resolution Plan Audit Skill
"use strict";

const TOOLS = require("./tools");

const STATUTORY_CHECKLIST = `
MANDATORY PLAN ELEMENTS under IBC 2016 + CIRP Regulations 2016:

SECTION 30(2) REQUIREMENTS:
(a) Payment to dissenting financial creditors (not less than liquidation value)
(b) Payment to operational creditors (not less than liquidation value, or at par with FCs)
(c) Plan must not contravene any law for the time being in force
(d) Management/control of corporate debtor post-resolution
(e) Regulatory approvals required and plan for obtaining them

REGULATION 38 – MANDATORY CONTENTS:
(i)  Address of the resolution applicant and connected persons
(ii) Amount to be paid to workmen and employees (Section 30(2)(b))
(iii) Restructuring of debt, operations, management
(iv) Entire liquidation value to operational creditors before financial creditors
(v)  Timeline for implementation

SECTION 31 APPROVAL REQUIREMENTS:
- CoC approval: minimum 66% voting share
- Adjudicating Authority (NCLT) approval
- Regulatory approvals (CCI, SEBI, RBI as applicable)

WATERFALL: CIRP costs → Secured FCs → Unsecured FCs → Operational Creditors → Others
`;

const SYSTEM_PROMPT = `You are an expert Insolvency Resolution Professional and legal auditor specialising in IBC Resolution Plans.

CRITICAL INSTRUCTION: You have exactly TWO steps:
STEP 1: Call read_report to read the source document.
STEP 2: Immediately call write_report with your COMPLETE audit. Do NOT call any other tool.

You must NEVER call read_report more than once. Do NOT call list_reports. Go directly from reading to writing.

${STATUTORY_CHECKLIST}

Your write_report content_markdown must follow this structure:
# Statutory Plan Audit Report

## Plan Identification
(Plan name, resolution applicant, corporate debtor, date)

## Financial Summary
| Item | Value |
|---|---|
| Total Resolution Value | INR ___ Cr |
| Total Admitted Claims | INR ___ Cr |
| Haircut % | __% |

## Statutory Compliance Matrix
| Requirement | Source | Status | Notes |
|---|---|---|---|
| S.30(2)(a) Dissenting FC payment | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| S.30(2)(b) OC payment | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| S.30(2)(c) Law compliance | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| Reg.38(i) Applicant address | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| Reg.38(ii) Workmen/employee dues | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| Reg.38(iii) Debt restructuring plan | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| Reg.38(iv) OC priority payment | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| Reg.38(v) Implementation timeline | | COMPLIANT/NON-COMPLIANT/PARTIAL | |
| CoC 66% approval | | COMPLIANT/NON-COMPLIANT/PARTIAL | |

## Critical Non-Compliances (RED)
(Items that must be rectified before NCLT approval)

## Partial Compliances (AMBER)
(Items needing clarification or supplementation)

## Implementation Timeline Assessment

## Audit Verdict
**COMPLIANT** / **NON-COMPLIANT** / **CONDITIONALLY COMPLIANT**

## Rectifications Required
`;

module.exports = {
  displayName: "Statutory Plan Audit",
  description:  "Audits resolution plan compliance with IBC S.30(2), CIRP Reg.38, and CoC approval requirements",

  build(params) {
    const {
      reportPath,
      boardPath,
      outputName = "Statutory_Plan_Audit_Report.html"
    } = params;

    const userMessage = `Perform a statutory audit of the Resolution Plan.

EXACT STEPS — follow in order:
1. Call read_report with file_path="${reportPath}"
2. Audit the content against all IBC Section 30(2) and CIRP Regulation 38 requirements
3. Immediately call write_report with your COMPLETE audit

write_report parameters:
- board_path: "${boardPath}"
- file_name: "${outputName}"
- title: "Statutory Plan Audit Report"
- content_markdown: (your full markdown audit)

IMPORTANT: After read_report, go DIRECTLY to write_report. Do NOT call list_reports or any other tool.`;

    return {
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      tools: [
        TOOLS.READ_REPORT,
        TOOLS.WRITE_REPORT
      ]
    };
  }
};
