# visual-flow-map（ビジュアルフローマップ）

**「操作や事象を選ぶと、通る経路だけが順番に光る」単一HTMLのフロー図を、AIエージェントが実コードから抽出・検証して生成する Agent Skill。**

[English README is here → README.en.md](README.en.md)

システムの処理フローだけでなく、業務手順・事故対応・出来事の経緯（事象フロー）も同じ形式で図にできます。

> 動く実物が `demo/` に2枚入っています（ダウンロードしてダブルクリック）。まずそれを触るのが一番早いです。

## なにが違うのか

| よくある図 | このスキルの図 |
|---|---|
| 人が手で描く（描いた瞬間から腐る） | エージェントがコードを読んで抽出。再生成が安い |
| 「たぶん合ってる」 | 全ノードが `ファイル:行番号` を持ち、**実在を機械検証**。結果（例: `コード参照 22/22 実在検証済み ・ commit abc1234`）を図の中にスタンプ |
| 1シナリオ=1枚のシーケンス図 | 静的な全体図の上に経路を重ねる。**共有ノードから「この処理を通る操作」を逆引き**できる |
| SaaS にコードを上げる | **自己完結HTML 1枚**。CDN もサーバも不要、ダブルクリックで開く。コードは手元から出ない |

## デモ

リポジトリの `demo/` に生成済みのデモが2枚入っています。ダウンロードしてダブルクリックするだけで動きます。

- [`demo/order-flow-map.html`](demo/order-flow-map.html) — コード対象（入門）。ミニECサイト（[`demo/sample-app/`](demo/sample-app/)、web / api / worker / DB の4層）の「注文確定・キャンセル・返金再試行・メール送信」。全22ノードの `ファイル:行` は実在検証済み
- [`demo/conduit-flow-map.html`](demo/conduit-flow-map.html) — **コード対象（実在OSS・複雑版）**。[RealWorld](https://github.com/gothinkster/flask-realworld-example-app) の Flask 実装を抽出2体＋敵対的検証1体で図化した **19操作・59ノード・130経路**。検証では抽出の事実誤認4件を修正し、副産物として対象OSSの実バグ2件（削除時の存在チェック欠落・未使用の例外定義）も発見した。対象コードは [`demo/conduit-app/`](demo/conduit-app/) に同梱（MIT・無改変）してあり、`audit.js --repo` で全59参照をあなたの手元でも再検証できる
- [`demo/incident-flow-map.html`](demo/incident-flow-map.html) — 事象フロー対象。保育園の発熱対応（通常の引き渡し／緊急受診）。レーンは技術レイヤでなく「保育士・主任・連絡・保護者・記録・医療機関」

図の中でできること: 操作ボタンで経路が順番に光る／ノードをクリックで逆引き／`#flow=<id>` のURLで「この経路を見て」を共有／検索・ズーム・再生。

## インストール

### Claude Code（プラグインとして）

```bash
/plugin marketplace add <your-github-id>/visual-flow-map
/plugin install visual-flow-map
```

### 手動（スキルを直接置く）

```bash
git clone https://github.com/<your-github-id>/visual-flow-map
cp -r visual-flow-map/skills/visual-flow-map ~/.claude/skills/
```

Agent Skills 標準（[agentskills.io](https://agentskills.io)）準拠なので、対応する他のエージェントでも使えます。スクリプト実行に Node.js が必要です。

## 使い方

インストール後、エージェントにこう頼むだけです。

```
このリポジトリの処理フローを可視化して。操作ごとにどこを通るのか追える図にして。
```

```
先週の障害対応の経緯を、対応記録をもとに事象フローの図にして。
```

スキルが領域分割 → 並列抽出 → 監査（ID分裂・参照切れ・コード実在）→ 敵対的検証 → ビルドまでの手順を持っています。詳細は [`skills/visual-flow-map/SKILL.md`](skills/visual-flow-map/SKILL.md)。

## 手動でビルドする場合

```bash
node skills/visual-flow-map/scripts/build.js \
  --data demo/data-code --out flow-map.html --repo demo/sample-app
```

- `--repo` を渡すと全ノードの `ファイル:行` を実在検証し、結果を図にスタンプ
- データディレクトリの `meta.json` で題名・レーン・用語を設定（テンプレート編集不要）
- `scripts/audit.js` が抽出データの7項目監査、`scripts/inspect.js` が経路の断線検査

## ライセンス

MIT
