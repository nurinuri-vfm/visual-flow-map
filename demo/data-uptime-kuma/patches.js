// Corrections settled by two adversarial reviewers (the monitor-to-notification chain / everything
// that is publicly exposed), each confirmed against the actual lines of the source.
// Every entry keeps its evidence (file:line), so the same corrections can be re-applied after a re-extraction.
module.exports = {

  dropEdges: [
    // [why this edge was wrong] A DNS CNAME is not what sends the HTTP request.
    // app.get("/") at server/server.js:263 only matches request.hostname against domainMappingList;
    // nothing there resolves DNS. Resolution is assumed to have happened in the browser already.
    ['ext.dns.cname', 'api.http.entry_root'],
  ],

  addEdges: [
    // The replacement for the edge above: put the visitor's browser in between as the actor
    { from: 'ext.dns.cname', to: 'ext.visitor_browser.open',
      label: 'Resolved by the CNAME (configured beforehand)', kind: 'call', branch: 'alt', evidence: 'inferred',
      flows: ['e-statuspage:visit-public-status-page'] },
    { from: 'ext.visitor_browser.open', to: 'api.http.entry_root',
      label: 'Request the custom domain root (GET /)', kind: 'http', branch: 'alt', evidence: 'direct',
      flows: ['e-statuspage:visit-public-status-page'] },

    // [4 missing auth steps] Every one of these handlers does call checkLogin, but the
    // extraction dropped it from the path. Whether a path is authenticated is the single thing a
    // reader most wants to know, so it always has to be drawn.
    // server/socket-handlers/status-page-socket-handler.js:86
    { from: 'api.socket.unpinIncident', to: 'svc.auth.checkLogin',
      label: 'Check login', kind: 'call', evidence: 'direct',
      flows: ['e-statuspage:resolve-incident'] },
    // server/socket-handlers/maintenance-socket-handler.js:162
    { from: 'api.socket.getMaintenanceList', to: 'svc.auth.checkLogin',
      label: 'Check login', kind: 'call', evidence: 'direct',
      flows: ['f-maintenance:maintenance-assign-status-pages'] },
    // server/socket-handlers/maintenance-socket-handler.js:178
    { from: 'api.socket.getMonitorMaintenance', to: 'svc.auth.checkLogin',
      label: 'Check login', kind: 'call', evidence: 'direct',
      flows: ['f-maintenance:maintenance-load-edit-form'] },
    // server/socket-handlers/maintenance-socket-handler.js:202
    { from: 'api.socket.getMaintenanceStatusPage', to: 'svc.auth.checkLogin',
      label: 'Check login', kind: 'call', evidence: 'direct',
      flows: ['f-maintenance:maintenance-load-edit-form'] },

    // Turning the RSS status into wording (the node itself is filled in by z-fixes.json)
    { from: 'svc.status_page.overallStatus', to: 'svc.status_page.getStatusDescription',
      label: 'Turn it into a description', kind: 'call', evidence: 'direct',
      flows: ['e-statuspage:rss-subscribe'] },
  ],

  edgePatch: {
    // The edges added above get their evidence stated too (nothing is left undeclared).
    // All four auth edges have a real checkLogin(socket) line in the body of the handler
    'api.socket.unpinIncident -> svc.auth.checkLogin': { evidence: 'direct' },
    'api.socket.getMaintenanceList -> svc.auth.checkLogin': { evidence: 'direct' },
    'api.socket.getMonitorMaintenance -> svc.auth.checkLogin': { evidence: 'direct' },
    'api.socket.getMaintenanceStatusPage -> svc.auth.checkLogin': { evidence: 'direct' },
    // DNS resolution finishes in the browser; it is not a call in the code
    'ext.dns.cname -> ext.visitor_browser.open': { evidence: 'inferred' },
    // It arrives from outside, so no calling line exists anywhere in the repository
    'ext.visitor_browser.open -> api.http.entry_root': { evidence: 'framework' },

    // [evidence upgraded] At extraction time this was unverified, on the grounds that
    // mapping a type to its implementation was out of scope. Verification located both the
    // construction (server/uptime-kuma-server.js:116 dns / :128 port) and the call site
    // (server/model/monitor.js:869-872, monitorTypeList[this.type].check), so it is now direct.
    // A textbook example of what the evidence field is for.
    'svc.monitorType.check -> svc.tcp.check': {
      evidence: 'direct', label: 'Call the type=port implementation (through monitorTypeList)' },
    'svc.monitorType.check -> svc.dns.check': {
      evidence: 'direct', label: 'Call the type=dns implementation (through monitorTypeList)' },
  },

  nodePatch: {
    // [the description was wrong] Writing "UP/DOWN to and from MAINTENANCE are excluded" reads as if
    // MAINTENANCE to DOWN were excluded as well, but in the implementation
    // (server/model/monitor.js:1420-1443) MAINTENANCE to DOWN is notified. The three that are
    // excluded are UP to MAINTENANCE, DOWN to MAINTENANCE and MAINTENANCE to UP.
    'svc.monitor.isImportantForNotification': {
      detail: 'True only for the first beat, UP to DOWN, DOWN to UP, PENDING to DOWN and MAINTENANCE to DOWN. Entering maintenance (UP/DOWN to MAINTENANCE) and leaving it (MAINTENANCE to UP) are not notified',
    },
  },

  flowPatch: {
    'e-statuspage:visit-public-status-page': {
      notesAdd: ['A visit on a custom domain assumes the DNS CNAME is already set up, and the request simply arrives from the browser. All the server does is match request.hostname against domainMappingList (server/server.js:263)'],
    },
    // [a by-product of adding evidence] While back-filling evidence it turned out that the premise of
    // this path is not in the code. isImportantForNotification (monitor.js:1420) is called only inside
    // the "this was an important beat" branch at monitor.js:968, where it decides whether to notify.
    // downCount, on the other hand, is advanced in the else side at monitor.js:988-1000 (= it was not
    // important), and isImportantForNotification plays no part in that branch.
    // The edge itself is still a fair reading of "not important, so on to the counter", so it stays,
    // and the absence of evidence is shown with evidence: unverified plus a note.
    'd-notify:notify-resend': {
      notesAdd: ['The branch that advances the resend counter (downCount) is the else side at monitor.js:988, and isImportantForNotification is not involved. The map draws it as "not important, so on to the counter", but the function responsible for that branch is a different one (in the code it is the bean.important=false side)'],
    },
    'd-notify:notify-apprise-check': {
      notesAdd: ['Showing whether Apprise is installed and actually sending through it (Apprise.send) are separate paths. The map places them side by side, but no code calls the latter from the former'],
    },
  },
};
