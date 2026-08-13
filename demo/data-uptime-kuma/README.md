# Uptime Kuma のフローマップ入力データ

`demo/uptime-kuma-flow-map.html` を生成した入力一式。

対象は [Uptime Kuma](https://github.com/louislam/uptime-kuma) v2.5.0（commit `b980621`）。
**対象コードはこのリポジトリに同梱していません**（server 21.5k行＋UI 33.5k行あり、
デモとして持つには大きすぎるため）。参照の実在検証を手元で再現するには、対象を clone して `--repo` に指してください。

```bash
git clone --depth 1 https://github.com/louislam/uptime-kuma.git /tmp/uk
node ../../skills/visual-flow-map/scripts/audit.js --data . --repo /tmp/uk
node ../../skills/visual-flow-map/scripts/build.js --data . --out out.html --repo /tmp/uk
```

（行番号は commit によってずれます。上の commit と違う版では ref 検証が 100% になりません）

## 中身

| ファイル | 内容 |
|---|---|
| `a-auth` 〜 `h-public`（8本） | 8体のエージェントが領域ごとに抽出した生データ。全ステップに `evidence`（経路の根拠）が付いているのは後半5本で、前半3本は根拠を導入する前に抽出したため未申告 |
| `z-fixes.json` | 敵対的検証で判明した欠落ノードの補完（`patches.js` は既存ノードの修正しかできないため別ファイル） |
| `aliases.js` | 監査【1】が出したID分裂6組。実コードを開いて同一実体と確認したうえで畳んでいる |
| `patches.js` | 敵対的検証2体が確定させた誤りの修正。**なぜそう直したかを各項目にコメントで残してある**ので、次に再抽出しても同じ修正を再適用できる |
| `meta.json` | 題名・レーン・カテゴリ表示順 |

## この抽出で分かったこと

`patches.js` に記録した修正のほか、対象プロジェクト側の問題も見つかっています（図の notes に記載）。

- モニター削除で対象が存在しない/所有していない場合、例外を投げず `{ok:true, msg:"successDeleted"}` を返す
- モニター編集で対象が無いとき null チェックなしで `bean.user_id` を参照する
- 破壊的操作（履歴削除・統計削除・DB圧縮）にパスワード再確認が無い
- 設定画面の保存が `currentPassword` を渡さないため、認証無効化時の `doubleCheckPassword` が実質到達不能
- `clearHeartbeats` は名前に反して統計テーブル（分/時/日）も削除する
- `getMonitorBeats` は両端に実装があるが呼び出し元が存在しない
