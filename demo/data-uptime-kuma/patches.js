// 敵対的検証2体（監視→通知の鎖 / 公開される面）で、実コードの行を確認して確定した誤りの修正。
// 各項目に根拠（ファイル:行）を残してあるので、次回の再抽出でも同じ修正を再適用できる。
module.exports = {

  dropEdges: [
    // 【断線の原因】DNS の CNAME は HTTP リクエストを送る主体ではない。
    // server/server.js:263 の app.get("/") は request.hostname を domainMappingList と
    // 照合するだけで、DNS を能動的に引く処理は無い。解決はブラウザ側で済んでいる前提。
    ['ext.dns.cname', 'api.http.entry_root'],
  ],

  addEdges: [
    // 上の置き換え。訪問者のブラウザを主体として間に挟む
    { from: 'ext.dns.cname', to: 'ext.visitor_browser.open',
      label: 'CNAME で解決（事前設定）', kind: 'call', branch: 'alt', evidence: 'inferred',
      flows: ['e-statuspage:visit-public-status-page'] },
    { from: 'ext.visitor_browser.open', to: 'api.http.entry_root',
      label: '独自ドメインのトップを要求（GET /）', kind: 'http', branch: 'alt', evidence: 'direct',
      flows: ['e-statuspage:visit-public-status-page'] },

    // 【認証ステップの欠落 4件】いずれもハンドラの実装に checkLogin があるのに、
    // 抽出が経路から落としていた。認証の有無は図の読み手が最も知りたい情報なので必ず通す。
    // server/socket-handlers/status-page-socket-handler.js:86
    { from: 'api.socket.unpinIncident', to: 'svc.auth.checkLogin',
      label: 'ログイン確認', kind: 'call', evidence: 'direct',
      flows: ['e-statuspage:resolve-incident'] },
    // server/socket-handlers/maintenance-socket-handler.js:162
    { from: 'api.socket.getMaintenanceList', to: 'svc.auth.checkLogin',
      label: 'ログイン確認', kind: 'call', evidence: 'direct',
      flows: ['f-maintenance:maintenance-assign-status-pages'] },
    // server/socket-handlers/maintenance-socket-handler.js:178
    { from: 'api.socket.getMonitorMaintenance', to: 'svc.auth.checkLogin',
      label: 'ログイン確認', kind: 'call', evidence: 'direct',
      flows: ['f-maintenance:maintenance-load-edit-form'] },
    // server/socket-handlers/maintenance-socket-handler.js:202
    { from: 'api.socket.getMaintenanceStatusPage', to: 'svc.auth.checkLogin',
      label: 'ログイン確認', kind: 'call', evidence: 'direct',
      flows: ['f-maintenance:maintenance-load-edit-form'] },

    // RSS の説明文変換（ノード定義は z-fixes.json で補完済み）
    { from: 'svc.status_page.overallStatus', to: 'svc.status_page.getStatusDescription',
      label: '説明文に変換', kind: 'call', evidence: 'direct',
      flows: ['e-statuspage:rss-subscribe'] },
  ],

  edgePatch: {
    // 下の addEdges で足した経路にも根拠を明示する（申告なしを残さない）。
    // 認証4件はいずれもハンドラ本体に checkLogin(socket) の行が実在する
    'api.socket.unpinIncident -> svc.auth.checkLogin': { evidence: 'direct' },
    'api.socket.getMaintenanceList -> svc.auth.checkLogin': { evidence: 'direct' },
    'api.socket.getMonitorMaintenance -> svc.auth.checkLogin': { evidence: 'direct' },
    'api.socket.getMaintenanceStatusPage -> svc.auth.checkLogin': { evidence: 'direct' },
    // DNS の解決はブラウザ側で完了しており、コード上の呼び出しではない
    'ext.dns.cname -> ext.visitor_browser.open': { evidence: 'inferred' },
    // 外部からの到達なので、リポジトリ内に呼び出し行は存在しない
    'ext.visitor_browser.open -> api.http.entry_root': { evidence: 'framework' },

    // 【根拠の格上げ】抽出時は「型→実装のマップが担当範囲外」として unverified だったが、
    // 検証で構築箇所（server/uptime-kuma-server.js:116 dns / :128 port）と
    // 呼び出し箇所（server/model/monitor.js:869-872 で monitorTypeList[this.type].check）を
    // 特定できたので direct に上げる。evidence の設計意図どおりの運用例。
    'svc.monitorType.check -> svc.tcp.check': {
      evidence: 'direct', label: 'type=port の実装を呼ぶ（monitorTypeList 経由）' },
    'svc.monitorType.check -> svc.dns.check': {
      evidence: 'direct', label: 'type=dns の実装を呼ぶ（monitorTypeList 経由）' },
  },

  nodePatch: {
    // 【説明の誤り】「UP/DOWN⇄MAINTENANCE を除外」と書くと MAINTENANCE→DOWN も
    // 除外されるように読めるが、実装（server/model/monitor.js:1420-1443）では
    // MAINTENANCE→DOWN は通知対象。除外されるのは UP→MAINTENANCE / DOWN→MAINTENANCE / MAINTENANCE→UP の3つ。
    'svc.monitor.isImportantForNotification': {
      detail: '初回・UP→DOWN・DOWN→UP・PENDING→DOWN・MAINTENANCE→DOWN のみ true。メンテ入り（UP/DOWN→MAINTENANCE）とメンテ復帰（MAINTENANCE→UP）は通知しない',
    },
  },

  flowPatch: {
    'e-statuspage:visit-public-status-page': {
      notesAdd: ['独自ドメインでの来訪は、DNS の CNAME 設定が済んでいる前提でブラウザからリクエストが届く。サーバ側は request.hostname を domainMappingList と照合するだけ（server/server.js:263）'],
    },
    // 【根拠付けの副産物】evidence を後付けする過程で、この経路の前提が
    // 実コードに無いことが判明した。isImportantForNotification（monitor.js:1420）は
    // monitor.js:968 の「重要なビートだった場合」の中でだけ呼ばれ、通知するかを決める。
    // 一方 downCount を進めるのは monitor.js:988-1000 の else 側（＝重要ではなかった場合）で、
    // その分岐に isImportantForNotification は関与しない。
    // 経路自体は「重要でなければ再送カウンタへ」という筋としては正しいので残し、
    // 根拠が無いことは evidence: unverified と notes で示す。
    'd-notify:notify-resend': {
      notesAdd: ['再送カウンタ（downCount）を進める分岐は monitor.js:988 の else 側にあり、isImportantForNotification は関与しない。図では「重要でなければカウンタへ」という流れとして描いているが、その分岐を担う関数は別（コード上は bean.important=false の側）'],
    },
    'd-notify:notify-apprise-check': {
      notesAdd: ['Apprise のインストール状況表示と、実際の通知送信（Apprise.send）は別の経路。図では関連づけて並べているが、前者から後者を呼ぶコードは存在しない'],
    },
  },
};
