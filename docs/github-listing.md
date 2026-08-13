# GitHub 公開用の文言一式

公開時にそのままコピペで使えるように用意したもの。`<your-github-id>` は実際のアカウント名に置換すること。
（この文書自体は運用メモなので、公開後に残しても消してもよい）

---

## 1. リポジトリの About（GitHub 右上の歯車から設定）

**Description**（350字以内。英語。GitHub の検索結果と OGP に出る一等地）

```
Turn a codebase, a manual or a runbook into one self-contained HTML flow map. Press an operation — or a symptom like "Wi-Fi won't connect" — and only its path lights up, step by step. Click any node to see every situation that routes through it. AI agents extract it from the real source, and the diagram states what was verified and what wasn't.
```

（346字。GitHub の About は350字が上限なので、これ以上足すなら何かを削ること。
**「a manual or a runbook」を最初の一文に入れているのは意図的**——コード可視化ツールは競合が多いが、
マニュアルのフローマップ化はほぼ空白地帯で、そこに気づいてもらえるかが流入の分かれ目になる。
`"Wi-Fi won't connect"` という具体例は、エンジニア以外にも用途が一瞬で伝わるので外さない）

**Website**: GitHub Pages を有効化したら `https://<your-github-id>.github.io/visual-flow-map/demo/conduit-flow-map.html`
（デモに直接飛ばすのが一番効く。トップページより「触れる図」）

**Topics**（20個まで。以下を推奨。検索流入の主要ソース）

```
agent-skills  claude-code  claude  ai-agents  code-visualization
flowchart  diagram  architecture-diagram  code-map  codebase-analysis
documentation  developer-tools  onboarding  static-analysis
interactive-visualization  runbook  troubleshooting  business-process
mermaid-alternative  llm  anthropic
```

（`runbook` / `troubleshooting` / `business-process` は**エンジニア以外の流入経路**。
マニュアル・手順書のフローマップ化は競合がほぼ居ない領域なので、この3つは外さない）

---

## 2. Social preview 画像（Settings → General → Social preview）

1280×640。**図のスクリーンショットが最も強い**。作り方:

1. `demo/conduit-flow-map.html` を開き、`create-article` など経路の長いフローを選択して再生を途中で止める
2. ブラウザ幅を 1280px 程度にして、経路が光っている状態でスクリーンショット
3. 上部に一行だけ重ねる: `Pick an operation. Only its path lights up.`

文字を入れすぎないこと。X やチャットで縮小表示されたときに「何かが光っている図」と分かれば十分。

---

## 3. Release v0.1.0 のリリースノート

**Tag**: `v0.1.0` / **Title**: `v0.1.0 — first public release`

```markdown
First public release.

**What it does** — Ask your agent to visualize a repo's flows, or to turn a manual into
something clickable. You get one self-contained HTML file: press an operation (or a symptom)
and only its path lights up, step by step, across UI / API / DB / jobs / external services —
or across the people and records of a procedure. Click any node to reverse-lookup every
operation or situation that passes through it.

**Why it's trustworthy** — Every node carries a `file:line` ref that is verified against the
repo, and the verification result is stamped into the diagram (`59/59 refs verified ·
commit 4b95fb2`). Extraction runs in parallel, then separate adversarial agents re-check
end-to-end chains against the real code.

**Not just code** — the same format maps procedures, incident timelines, and manuals. A manual
is where it pays off most: nobody reads 300 pages front to back, but pressing *"Wi-Fi won't
connect"* and watching only that path light up takes three seconds. Clicking any step lists
every situation that passes through it, which an index cannot do. Manual section numbers work
as refs directly.

**Included**
- The skill (`skills/visual-flow-map/`) — instructions, HTML template, build/audit/inspect scripts, evals
- Three demos you can open by double-click: a small e-commerce app, the Flask RealWorld
  implementation (19 operations · 59 nodes, target code vendored so you can re-verify), and a
  procedure built from a real response manual
- Event-flow mode for procedures, manuals, runbooks and incident timelines
- Diff mode (`--diff-base`) — rebuild and see only what changed
- English / Japanese UI (`"lang": "en"`)

**Requirements** — Node.js, and an agent environment that can run subagents in parallel.
Nothing is executed in the target repo and nothing is uploaded.

MIT.
```

日本語版（Release 本文の下に追記するか、別 Release にはしない）

```markdown
---

初回公開です。エージェントに「このリポジトリの処理フローを可視化して」と頼むと、自己完結した
HTML が1枚できます。操作のボタンを押すと、その操作が通る経路だけが順番に光ります。全ノードが
`ファイル:行番号` を持ち、実在をリポジトリと突き合わせて検証した結果が図に焼き込まれます。
業務手順や障害対応の経緯など、コードが無いものにも使えます（事象フローモード）。
```

---

## 4. アナウンス文面

### X / Twitter（英語）

```
Built an Agent Skill that turns a codebase into one interactive HTML flow map.

Pick an operation → only its path lights up, step by step, across UI / API / DB / workers.
Click a node → reverse-lookup every operation that goes through it.

Every file:line ref is machine-verified and stamped into the diagram.

MIT: <URL>
```

（1枚目に図の GIF、2枚目にスタンプ部分の拡大を添えると伝わる）

### X / Twitter（日本語）

```
コードベースを「押した操作の経路だけが光る HTML 1枚」にする Agent Skill を作りました。

・画面→API→DB→ジョブ→外部サービスを貫く経路が順番に光る
・ノードをクリックすると「ここを通る操作」を逆引き
・全ノードの ファイル:行番号 を機械検証して、結果を図に焼き込む

コードは手元から出ません。MIT: <URL>
```

### X / Twitter（日本語・マニュアル切り口）

エンジニア以外にも届く角度。コード版とは別の日に投稿する。

```
300ページのマニュアル、誰も読まないですよね。

手順書をフロー図にするスキルを作りました。「Wi-Fiが繋がらない」を押すと、その対処の経路だけが順番に光ります。
どの手順をクリックしても「ここを通る症状は6つ」と逆引きできるので、索引より速い。

しかも図にすると、マニュアル自体の抜け（片側しか書かれていない分岐など）が見えます。

<URL>
```

### Hacker News（Show HN）

**Title**: `Show HN: An agent skill that turns a codebase into a verified interactive flow map`

```
I kept running into the same problem: architecture diagrams are stale the moment they ship,
and nobody can tell whether the one they're looking at still matches the code.

So instead of drawing diagrams, I wrote an agent skill that (1) splits a repo into areas,
(2) has agents extract the flow graph in parallel with a file:line reference on every node,
(3) machine-verifies those references against the repo, and (4) sends separate adversarial
agents to re-check end-to-end chains against the real code.

The output is one self-contained HTML file — no CDN, no server. You press a button for an
operation and only its path lights up, step by step. Click a shared node and it tells you
every operation that passes through it, which is the thing sequence diagrams can't do.

The verification result is stamped into the diagram itself, so the person receiving it can
see "59/59 refs verified · commit 4b95fb2" instead of taking it on faith.

Demo (double-click, no install): <URL to demo>

On the RealWorld Flask app, the audits came back clean but adversarial verification still
caught 4 factual errors in the extraction — and incidentally surfaced 2 real bugs in the
target project (a missing existence check before a delete, and an exception class that's
defined but never raised). That asymmetry is the whole reason step 4 exists.

It also works on things with no code. One demo maps a nursery school's response to a child
running a fever, built from the school's own manual, with people as lanes instead of layers.
That turned out to be the use case I underestimated: nobody reads a long manual, but pressing
"Wi-Fi won't connect" and watching only that path light up takes three seconds — and clicking
any step tells you every situation that routes through it, which an index can't. Turning a
manual into a flow also exposes its gaps: branches with only one side written, steps whose
precondition lives in another chapter.
```

### Reddit r/ClaudeAI（英語）

```
Title: I built a Claude Code skill that maps a codebase into an interactive flow diagram (and verifies its own output)

Body: 上の Show HN 本文を流用。最後に「Feedback welcome — especially on where the
extraction gets it wrong on your codebase」を足す。
```

### スキルレジストリ（skills.sh / SkillsMP / LobeHub）の登録説明

```
Generates a single self-contained HTML flow map from a real codebase. Selecting an operation
lights up only its path across UI / API / DB / jobs / external services, and clicking a node
reverse-looks-up every operation passing through it. Agents extract in parallel, every
file:line ref is machine-verified against the repo, and adversarial verifier agents re-check
end-to-end chains. Also maps things with no code — procedures, incident timelines, manuals and
runbooks — where the same "press your symptom, see only your path" model turns a document
nobody reads into something clickable.
```

---

## 5. GitHub Pages（デモを触れる状態にする）

Settings → Pages → Source: `Deploy from a branch` → `main` / `/ (root)`。

有効化後、デモは以下で直接開ける:

- `https://<your-github-id>.github.io/visual-flow-map/demo/conduit-flow-map.html`
- `https://<your-github-id>.github.io/visual-flow-map/demo/order-flow-map.html`
- `https://<your-github-id>.github.io/visual-flow-map/demo/incident-flow-map.html`

**「触れるデモ」の URL が最大の営業資産**なので、有効化したら README 冒頭・About の Website・
各アナウンス文面の `<URL>` を全てこれに差し替える。

---

## 6. 公開直後にやること（優先順）

1. Pages を有効化し、README 冒頭に「▶ Try the live demo」リンクを1行追加する
2. Social preview 画像を設定する（未設定だと OGP がただのテキストになる）
3. 10秒程度の GIF を README 冒頭に置く（経路が光る様子は文章で伝わらない）
4. Topics を設定する（検索流入の主要ソース）
5. レジストリ登録 → 記事 → SNS の順。記事に「触れるデモ」への直リンクを必ず入れる
