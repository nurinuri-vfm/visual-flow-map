# interactive-flow-map（フローマップ）

**「操作や事象を選ぶと、通る経路だけが順番に光る」単一HTMLのフロー図を、AIエージェントが実コードから抽出・検証して生成する Agent Skill。**

[English README is here → README.en.md](README.en.md)

![demo](docs/demo.gif)

システムの処理フローだけでなく、業務手順・事故対応・出来事の経緯（事象フロー）も同じ形式で図にできます。

## なにが違うのか

| よくある図 | このスキルの図 |
|---|---|
| 人が手で描く（描いた瞬間から腐る） | エージェントがコードを読んで抽出。再生成が安い |
| 「たぶん合ってる」 | 全ノードが `ファイル:行番号` を持ち、**実在を機械検証**。結果（例: `コード参照 22/22 実在検証済み ・ commit abc1234`）を図の中にスタンプ |
| 1シナリオ=1枚のシーケンス図 | 静的な全体図の上に経路を重ねる。**共有ノードから「この処理を通る操作」を逆引き**できる |
| SaaS にコードを上げる | **自己完結HTML 1枚**。CDN もサーバも不要、ダブルクリックで開く。コードは手元から出ない |

## デモ

リポジトリの `demo/` に生成済みのデモが2枚入っています。ダウンロードしてダブルクリックするだけで動きます。

- [`demo/order-flow-map.html`](demo/order-flow-map.html) — コード対象。ミニECサイト（[`demo/sample-app/`](demo/sample-app/)、web / api / worker / DB の4層）の「注文確定・キャンセル・返金再試行・メール送信」。全22ノードの `ファイル:行` は実在検証済み
- [`demo/incident-flow-map.html`](demo/incident-flow-map.html) — 事象フロー対象。保育園の発熱対応（通常の引き渡し／緊急受診）。レーンは技術レイヤでなく「保育士・主任・連絡・保護者・記録・医療機関」

図の中でできること: 操作ボタンで経路が順番に光る／ノードをクリックで逆引き／`#flow=<id>` のURLで「この経路を見て」を共有／検索・ズーム・再生。

## インストール

### Claude Code（プラグインとして）

```bash
/plugin marketplace add <your-github-id>/interactive-flow-map
/plugin install interactive-flow-map
```

### 手動（スキルを直接置く）

```bash
git clone https://github.com/<your-github-id>/interactive-flow-map
cp -r interactive-flow-map/skills/interactive-flow-map ~/.claude/skills/
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

スキルが領域分割 → 並列抽出 → 監査（ID分裂・参照切れ・コード実在）→ 敵対的検証 → ビルドまでの手順を持っています。詳細は [`skills/interactive-flow-map/SKILL.md`](skills/interactive-flow-map/SKILL.md)。

## 手動でビルドする場合

```bash
node skills/interactive-flow-map/scripts/build.js \
  --data demo/data-code --out flow-map.html --repo demo/sample-app
```

- `--repo` を渡すと全ノードの `ファイル:行` を実在検証し、結果を図にスタンプ
- データディレクトリの `meta.json` で題名・レーン・用語を設定（テンプレート編集不要）
- `scripts/audit.js` が抽出データの7項目監査、`scripts/inspect.js` が経路の断線検査

## ライセンス

MIT
