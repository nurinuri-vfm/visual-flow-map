# 公開手順（未公開。実行はオーナーの判断で）

このリポジトリはローカルのみに存在する（`git remote` 未設定）。公開する場合は以下のどちらかで行う。

## 事前に決めること

- [ ] GitHub のユーザー名（または組織名）
- [ ] public か private か（まず private で上げて中身を確認してから public 化も可）
- [ ] リポジトリ名（推奨: `interactive-flow-map`）

## 方法A: GitHub CLI（gh）を使う

このマシンには gh が未インストール（2026-08-13 時点）。`winget install GitHub.cli` → `gh auth login` の後:

```bash
gh repo create <ユーザー名>/interactive-flow-map --private --source . --push
```

（public にするなら `--private` を `--public` に。後から公開する場合は `gh repo edit --visibility public`）

## 方法B: ブラウザで作って push する

1. github.com/new でリポジトリ作成（README等は追加しない・空のまま）
2. このディレクトリで:

```bash
git remote add origin https://github.com/<ユーザー名>/interactive-flow-map.git
git push -u origin main
```

## push 前の置き換え（2箇所）

- `README.md` / `README.en.md` 内の `<your-github-id>` を実ユーザー名に置換
- `demo/data-code/meta.json` に `"creditUrl": "https://github.com/<ユーザー名>/interactive-flow-map"` を追加してデモを再ビルドすると、図のクレジットがリポジトリへのリンクになる:

```bash
node skills/interactive-flow-map/scripts/build.js --data demo/data-code --out demo/order-flow-map.html --repo demo/sample-app
node skills/interactive-flow-map/scripts/build.js --data demo/data-event --out demo/incident-flow-map.html
```

## 公開後にやると効果が大きい順

1. GitHub Pages を有効化して `demo/` の2枚を直接触れるようにする（Settings → Pages → main / root）
2. README 冒頭に10秒のGIF（経路が光る様子）を追加
3. skills.sh / SkillsMP / LobeHub へ登録
4. Zenn/Qiita にデモ付き記事（日本語圏はここが最短）
5. 動作クリップを X に投稿

## 公開しない場合

このファイルとローカルリポジトリはそのまま置いておけばよい。スキル本体は `~/.claude/skills/interactive-flow-map` で既に動いている（公開と無関係に使える）。
