# 公開手順（未公開。実行はオーナーの判断で）

このリポジトリはローカルのみに存在する（`git remote` 未設定）。公開する場合は以下のどちらかで行う。

## 事前に決めること

- [ ] GitHub のユーザー名（または組織名）
- [ ] public か private か（まず private で上げて中身を確認してから public 化も可）
- [ ] リポジトリ名（推奨: `visual-flow-map`）

## 方法A: GitHub CLI（gh）を使う

このマシンには gh が未インストール（2026-08-13 時点）。`winget install GitHub.cli` → `gh auth login` の後:

```bash
gh repo create <ユーザー名>/visual-flow-map --private --source . --push
```

（public にするなら `--private` を `--public` に。後から公開する場合は `gh repo edit --visibility public`）

## 方法B: ブラウザで作って push する

1. github.com/new でリポジトリ作成（README等は追加しない・空のまま）
2. このディレクトリで:

```bash
git remote add origin https://github.com/<ユーザー名>/visual-flow-map.git
git push -u origin main
```

## push 前の置き換え（2箇所）

- **`<your-github-id>` を実ユーザー名に置換**（`README.md` 2箇所 / `README.ja.md` 2箇所 / `PUBLISH.md` 1箇所 / `docs/github-listing.md` 5箇所）。一括なら:
  ```bash
  grep -rl '<your-github-id>' --include='*.md' . | xargs sed -i 's/<your-github-id>/実際のID/g'
  ```
- `demo/data-code/meta.json` に `"creditUrl": "https://github.com/<ユーザー名>/visual-flow-map"` を追加してデモを再ビルドすると、図のクレジットがリポジトリへのリンクになる:

```bash
node skills/visual-flow-map/scripts/build.js --data demo/data-code --out demo/order-flow-map.html --repo demo/sample-app
node skills/visual-flow-map/scripts/build.js --data demo/data-event --out demo/incident-flow-map.html
```

## 公開後にやると効果が大きい順

1. GitHub Pages を有効化して `demo/` の2枚を直接触れるようにする（Settings → Pages → main / root）
2. README 冒頭に10秒のGIF（経路が光る様子）を追加
3. skills.sh / SkillsMP / LobeHub へ登録
4. Zenn/Qiita にデモ付き記事（日本語圏はここが最短）
5. 動作クリップを X に投稿

## 公開前チェックの結果（2026-08-14 実施）

機械走査 84ファイル。**案件名・個人パス・認証情報・秘密鍵はいずれも0件**でクリーン。

| 項目 | 結果 |
|---|---|
| 案件固有の情報（otomil 等） | 0件 |
| 個人のファイルパス（`C:\Users\...`） | 0件 |
| APIキー・トークン・秘密鍵 | 0件 |
| 一時ファイル（`.tmp` 等） | 削除済み |
| メールアドレス | 1件（`shop@example.com`＝自作サンプルの架空アドレス） |
| localhost 参照 | 4件（`demo/conduit-app/conduit/settings.py`＝取り込んだ対象OSSの原文。無改変） |
| `<your-github-id>` | 12件（**公開時に置換が必要**。上の手順参照） |

## 未完了（公開の障害にはならないが、把握しておくこと）

- ~~SKILL.md 本体は日本語のまま~~ → **2026-08-14 に英語化完了**（SKILL.md=英語 / SKILL.ja.md=日本語）。
- references も英訳済み（data-schema / extraction-prompt / pitfalls / language-notes）。日本語版は `*.ja.md` に併置。

## 公開しない場合

このファイルとローカルリポジトリはそのまま置いておけばよい。スキル本体は `~/.claude/skills/visual-flow-map` で既に動いている（公開と無関係に使える）。
