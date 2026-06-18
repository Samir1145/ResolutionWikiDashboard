// skills/index.js – IBC Skill Registry for Resolution Bazaar
"use strict";

const section29ASkill          = require("./section-29a.skill");
const statutoryPlanAuditSkill  = require("./statutory-plan-audit.skill");
const valuationReconciliation  = require("./valuation-reconciliation.skill");
const investorFitSkill         = require("./investor-fit.skill");
const planComparisonSkill      = require("./plan-comparison.skill");
const okfQaSkill               = require("./okf-qa.skill");

module.exports = {
  "section_29a":           section29ASkill,
  "statutory_plan_audit":  statutoryPlanAuditSkill,
  "valuation_reconciliation": valuationReconciliation,
  "investor_fit":          investorFitSkill,
  "plan_comparison":       planComparisonSkill,
  "okf_qa":                okfQaSkill
};
