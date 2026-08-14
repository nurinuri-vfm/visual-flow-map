// The three pairs audit [1] reported as "same ref, same lane, different ID", after opening the real code.
// All three turned out to be the same thing, so they are folded together. The winning ID is the one that
// follows the convention (<lane>.<module>.<function>, camelCase).
module.exports = {
  // exports.doubleCheckPassword at server/util-server.js:658. Named after the file, util-server
  'svc.util.doubleCheckPassword': ['svc.auth.doubleCheckPassword'],

  // checkCertExpiryNotifications at server/util-server.js:924.
  // 'svc.util-server.*' contains a hyphen, which breaks the ID convention (lowercase ASCII, dot-separated),
  // so the camelCase side wins
  'svc.utilServer.checkCertExpiryNotifications': ['svc.util-server.checkCertExpiryNotifications'],

  // router.get("/api/status-page/:slug") at server/routers/status-page-router.js:39.
  // The comment in the real code reads "Status page config, incident, monitor list": it is the endpoint
  // returning the status page's configuration JSON. The ID that reflects the path wins
  'api.http.api_status_page_slug': ['api.http.status_page_slug'],

  // The three below are h-public spelling the module name exactly as the file name (hyphens and all).
  // The ID convention is lowercase ASCII separated by dots, so the existing hyphen-free side wins.
  // In all three the ref is the same line, confirmed to be the same function.
  'svc.server.sendUpdateMonitorIntoList': ['svc.uptime-kuma-server.sendUpdateMonitorIntoList'],
  'svc.server.getMonitorJSONList': ['svc.uptime-kuma-server.getMonitorJSONList'],
  'svc.uptime.getUptimeCalculator': ['svc.uptime-calculator.getUptimeCalculator'],
};
