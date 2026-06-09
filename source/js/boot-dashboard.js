// boot-dashboard.js – launch the Project Dashboard on app start
"use strict";
// Compute URL for the dashboard page relative to this script location
const dashboardUrl = "../html/dashboard.html";
// If we aren't already on the dashboard, redirect there
if (!window.location.pathname.endsWith("dashboard.html")) {
  window.location.replace(dashboardUrl);
}
