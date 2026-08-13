// audit【1】が出した「同じ ref・同じレーンで別ID」3組を、実コードを開いて確認した結果。
// 3組とも同一実体だったので畳む。正のIDは規約（<レーン>.<モジュール>.<関数>、camelCase）に沿う側を採る。
module.exports = {
  // server/util-server.js:658 の exports.doubleCheckPassword。util-server というファイル名に合わせる
  'svc.util.doubleCheckPassword': ['svc.auth.doubleCheckPassword'],

  // server/util-server.js:924 の checkCertExpiryNotifications。
  // ハイフンを含む 'svc.util-server.*' は ID 規約（小文字ASCIIのドット区切り）から外れるため camelCase 側を正とする
  'svc.utilServer.checkCertExpiryNotifications': ['svc.util-server.checkCertExpiryNotifications'],

  // server/routers/status-page-router.js:39 の router.get("/api/status-page/:slug")。
  // 実コードのコメントは "Status page config, incident, monitor list" で、
  // ステータスページの設定JSONを返すエンドポイント。パスを反映した側を正とする
  'api.http.api_status_page_slug': ['api.http.status_page_slug'],

  // 以下3組は h-public が モジュール名をファイル名そのまま（ハイフン入り）で綴ったもの。
  // ID規約は小文字ASCIIのドット区切りなので、ハイフンを含まない既存側を正とする。
  // いずれも ref が同一行で、同じ関数であることを確認済み。
  'svc.server.sendUpdateMonitorIntoList': ['svc.uptime-kuma-server.sendUpdateMonitorIntoList'],
  'svc.server.getMonitorJSONList': ['svc.uptime-kuma-server.getMonitorJSONList'],
  'svc.uptime.getUptimeCalculator': ['svc.uptime-calculator.getUptimeCalculator'],
};
