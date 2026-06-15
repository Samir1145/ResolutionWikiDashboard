// section-29a.skill.js
// IBC Section 29A Eligibility Compliance Verification Skill
"use strict";

const TOOLS = require("./tools");

const DISQUALIFICATION_CRITERIA = `
SECTION 29A DISQUALIFICATION CRITERIA (IBC 2016, as amended):

(a) Undischarged insolvent
(b) Wilful defaulter as classified by RBI guidelines
(c) NPA account classified as NPA for 1+ year (Section 29A(c))
(d) Convicted of any offence punishable with imprisonment for 2+ years
(e) Disqualified as director under Companies Act 2013 (Section 164)
(f) Prohibited by SEBI from trading in securities
(g) Indicted for economic offence or offence against any law for the time being
(h) Account classified as fraud under RBI Fraud guidelines
(i) Promoter/director of Corporate Debtor with NPA for 1 year+
(j) Connected person who is related party to any of the above

CONNECTED PERSONS include:
- Holding company, subsidiary, associate company
- Related parties as defined in Companies Act 2013 Section 2(76)
- Persons acting in concert under SEBI Takeover Code
`;

const SYSTEM_PROMPT = `You are a senior Insolvency Professional (IP) and legal compliance expert specialising in the Insolvency and Bankruptcy Code 2016 (IBC).

CRITICAL INSTRUCTION: You have exactly TWO steps to complete this task:
STEP 1: Call read_report to read the source document.
STEP 2: Immediately call write_report with your complete analysis. Do NOT call any other tool.

You must NEVER call read_report more than once. You must NEVER call list_reports. After reading the document, write your full analysis immediately using write_report.

${DISQUALIFICATION_CRITERIA}

Your write_report content_markdown must follow this exact structure:
# Section 29A Eligibility Report

## Applicant Details
(Name, role, company from the document)

## Verification Summary Table
| Criterion | Description | Status | Evidence |
|---|---|---|---|
| (a) | Undischarged insolvent | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (b) | Wilful defaulter | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (c) | NPA 1+ year | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (d) | Criminal conviction 2+ years | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (e) | Director disqualification | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (f) | SEBI prohibition | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (g) | Economic offence | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (h) | RBI fraud classification | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (i) | NPA promoter/director | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |
| (j) | Connected person issues | CLEAR / RED FLAG / INSUFFICIENT INFO | (cite document) |

## Red Flags Identified
(List any RED FLAG items with reasoning)

## Connected Person Analysis
(Identify holding/subsidiary/related party concerns)

## VERDICT
**ELIGIBLE** / **INELIGIBLE** / **REQUIRES FURTHER VERIFICATION**

## Recommendations to Resolution Professional
(Action items, additional documents needed)
`;

module.exports = {
  displayName: "Section 29A Compliance Verification",
  description:  "Verifies resolution applicant eligibility under IBC Section 29A disqualification criteria",

  build(params) {
    const {
      reportPath,
      boardPath,
      outputName = "Section_29A_Eligibility_Report.html"
    } = params;

    const userMessage = `Perform a Section 29A eligibility verification.

EXACT STEPS — follow in order, no deviations:
1. Call read_report with file_path="${reportPath}"
2. Read the document content carefully
3. Immediately call write_report with your COMPLETE analysis

write_report parameters:
- board_path: "${boardPath}"
- file_name: "${outputName}"
- title: "Section 29A Eligibility Report"
- content_markdown: (your full markdown analysis as described in the system prompt)

IMPORTANT: After step 1 (read_report), go DIRECTLY to step 3 (write_report). Do NOT call any other tool. Do NOT call read_report again. Do NOT call list_reports.`;

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
