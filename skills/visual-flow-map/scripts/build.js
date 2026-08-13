#!/usr/bin/env node
/**
 * フローJSON群 → 単一HTML
 *
 *   node build.js --data <jsonのあるディレクトリ> --out <出力.html> [--template <template.html>] [--repo <リポジトリ>]
 *                 [--diff-base <前回の出力.html>]
 *
 * --diff-base に前回生成したHTMLを渡すと差分を計算し、
 *   - 追加/変更ノードに NEW/変更 バッジ
 *   - 「前回からの変更点」という擬似フロー（追加された経路が光る・削除/変更は注記に列挙）
 * を図に焼き込む。PRレビューや定期再生成で「何が変わったか」を10秒で見せるための機能。
 *
 * <data> 直下の *.json をすべて読み、ノード/エッジ/フローをマージして
 * assets/template.html の `const DATA = ...` に流し込む。
 *
 * --repo を渡すと、全ノードの ref（パス:行番号）を実ファイルと突き合わせて
 * 「コード参照 n/m 実在検証済み」のスタンプを図の凡例に焼き込む（コミットハッシュ・生成日も）。
 *
 * 同じディレクトリに置くと自動で拾う任意ファイル（無くてもよい）:
 *   meta.json   図のメタ設定 { title, lanes:[{key,label,color?}], catOrder, flowWord, credit, creditUrl }
 *               lanes を書けばテンプレートを編集せずにレーンを総入れ替えできる（事象フローモード用）
 *   aliases.js  同一実体に別IDが付いたときの正規化表   { '正のID': ['別名', ...] }
 *   patches.js  実コードと突き合わせて確定した誤りの修正 { dropEdges, addEdges, nodePatch, flowPatch }
 *   merge.js    レイヤ別に書かれた同一操作の統合定義     [[統合ID, カテゴリ, タイトル, ['file:flowId', ...]], ...]
 *
 * 出力は自己完結HTML1枚。外部CDNを一切参照しない。
 */
const fs = require('fs');
const path = require('path');

/* ---------- 引数 ---------- */
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const DIR = path.resolve(arg('--data', process.cwd()));
const OUT = path.resolve(arg('--out', path.join(process.cwd(), 'flow-map.html')));
const TPL = path.resolve(arg('--template', path.join(__dirname, '..', 'assets', 'template.html')));
const QUIET = argv.includes('--quiet');

const optional = name => {
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) return null;
  try { return require(p); } catch (e) { console.log(`[WARN] ${name} を読めない: ${e.message}`); return null; }
};

/* ---------- 別名の正規化 ---------- */
const ALIAS = new Map();
for (const [c, dupes] of Object.entries(optional('aliases.js') || {})) for (const d of dupes) ALIAS.set(d, c);
const canon = id => ALIAS.get(id) || id;

const SKIP = new Set(['merged.json', 'meta.json', 'package.json', 'package-lock.json']);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !SKIP.has(f)).sort();
if (!files.length) { console.error(`[FATAL] ${DIR} に *.json が無い`); process.exit(1); }

const nodes = new Map(), edges = new Map(), flows = [];
const provenance = new Map(), problems = [];
const BOM = new RegExp('^' + String.fromCharCode(0xFEFF));  // JSON 先頭の BOM を落とす
const SEP = String.fromCharCode(1);  // ID には現れない区切り
const ekey = (a, b) => a + SEP + b;   // ID に出てこない区切りで連結（'a'+'bc' と 'ab'+'c' の衝突を防ぐ）
/* 経路の根拠の強さ。数字が大きいほど弱い（マージ時は弱いほうを残す）。
   ノードの ref は実在検査で機械的に確かめられるが、「AがBを呼ぶ」という経路は確かめられない。
   だから根拠の強さを申告させ、図とスタンプで正直に出す */
const EV_RANK = { direct: 0, inferred: 1, framework: 2, unverified: 3 };

/* ---------- 読み込みとマージ ---------- */
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8').replace(BOM, '')); }
  catch (e) { problems.push(`[PARSE] ${f}: ${e.message}`); continue; }
  for (const n of j.nodes || []) {
    if (!n || !n.id) { problems.push(`[NODE] ${f}: id が無いノード`); continue; }
    const id = canon(String(n.id).trim());
    const prev = nodes.get(id);
    if (!prev) {
      nodes.set(id, { id, lane: n.lane || 'svc', label: n.label || id, detail: n.detail || '', ref: n.ref || '' });
      provenance.set(id, [f]);
    } else {
      provenance.get(id).push(f);
      // 同じノードを複数のエージェントが書いた場合、説明は詳しいほう・ラベルは短いほう（枠に収まる）を採る
      if ((n.detail || '').length > (prev.detail || '').length) prev.detail = n.detail;
      if (!prev.ref && n.ref) prev.ref = n.ref;
      if (n.label && prev.label.length > n.label.length) prev.label = n.label;
    }
  }
  for (let e of j.edges || []) {
    if (!e || !e.from || !e.to) continue;
    e = { ...e, from: canon(e.from), to: canon(e.to) };
    if (e.from === e.to) continue;
    const k = ekey(e.from, e.to);
    if (!edges.has(k)) edges.set(k, { from: e.from, to: e.to, label: e.label || '', kind: e.kind || 'call', ...(EV_RANK[e.evidence] !== undefined ? { evidence: e.evidence } : {}) });
    else {
      const cur = edges.get(k);
      if (!cur.label && e.label) cur.label = e.label;
      // 同じ経路を複数のエージェントが書いたら、根拠は弱いほうを採る（実態より強く見せない）
      if (EV_RANK[e.evidence] !== undefined &&
          (cur.evidence === undefined || EV_RANK[e.evidence] > EV_RANK[cur.evidence])) cur.evidence = e.evidence;
    }
  }
  for (const fl of j.flows || []) {
    if (!fl || !fl.id || !Array.isArray(fl.steps) || !fl.steps.length) { problems.push(`[FLOW] ${f}: 不正な flow ${fl && fl.id}`); continue; }
    if (flows.some(x => x.id === fl.id)) fl.id = fl.id + '-' + f.replace('.json', '');  // 別レイヤの同名フロー
    const steps = [];
    for (const s of fl.steps) {
      if (!s || !s.from || !s.to) continue;
      const from = canon(s.from), to = canon(s.to);
      if (from === to) continue;                                     // 別名を畳んだ結果の自己ループ
      if (steps.some(p => p.from === from && p.to === to)) continue; // 同一フロー内の重複ホップ
      steps.push({ ...s, from, to });
    }
    flows.push({ id: fl.id, title: fl.title || fl.id, category: fl.category || 'その他', trigger: fl.trigger || '', steps, notes: fl.notes || [], src: f });
  }
}

/* ---------- 参照切れの検出（ノードに無いIDを指すエッジ/手順） ---------- */
const dangling = new Map();
const note = id => dangling.set(id, (dangling.get(id) || 0) + 1);
for (const fl of flows) {
  fl.steps = fl.steps.filter(s => {
    let ok = true;
    for (const id of [s.from, s.to]) if (!nodes.has(id)) { ok = false; note(id); }
    if (!ok) return false;
    const k = ekey(s.from, s.to);
    if (!edges.has(k)) edges.set(k, { from: s.from, to: s.to, label: s.label || '', kind: s.kind || 'call', ...(EV_RANK[s.evidence] !== undefined ? { evidence: s.evidence } : {}) });
    else {
      // 既に edges 側にある経路でも、手順が弱い根拠を申告していればそちらを採る
      const cur = edges.get(k);
      if (EV_RANK[s.evidence] !== undefined &&
          (cur.evidence === undefined || EV_RANK[s.evidence] > EV_RANK[cur.evidence])) cur.evidence = s.evidence;
    }
    return true;
  });
}
for (const [k, e] of [...edges]) {
  if (!nodes.has(e.from) || !nodes.has(e.to)) {
    if (!nodes.has(e.from)) note(e.from);
    if (!nodes.has(e.to)) note(e.to);
    edges.delete(k);
  }
}

/* ---------- 実コードと突き合わせて確定した誤りの修正 ---------- */
const P = optional('patches.js') || {};
const flowKey = f => f.src.replace('.json', '') + ':' + f.id.replace(new RegExp('-' + f.src.replace('.json', '') + '$'), '');
const drop = new Set((P.dropEdges || []).map(([a, b]) => ekey(canon(a), canon(b))));
let dropped = 0, added = 0;
const patchMiss = [];
for (const k of drop) if (edges.delete(k)) dropped++;
for (const f of flows) {
  const before = f.steps.length;
  f.steps = f.steps.filter(s => !drop.has(ekey(s.from, s.to)));
  dropped += before - f.steps.length;
}
for (const e of P.addEdges || []) {
  const from = canon(e.from), to = canon(e.to);
  if (!nodes.has(from) || !nodes.has(to)) { patchMiss.push(`addEdge 未知ノード ${from} -> ${to}`); continue; }
  const k = ekey(from, to);
  if (!edges.has(k)) { edges.set(k, { from, to, label: e.label || '', kind: e.kind || 'call' }); added++; }
  for (const key of e.flows || []) {
    const f = flows.find(x => flowKey(x) === key);
    if (!f) { patchMiss.push(`addEdge 未知フロー ${key}`); continue; }
    if (f.steps.some(s => s.from === from && s.to === to)) continue;
    const step = { from, to, label: e.label || '', branch: e.branch || 'main' };
    const at = f.steps.findIndex(s => s.to === from);   // 直前の手順の後ろへ差し込む
    if (at >= 0) f.steps.splice(at + 1, 0, step); else f.steps.push(step);
  }
}
// 検証で根拠が確定した経路の evidence / label / kind を上書きする。
// キーは 'from -> to'。edges と、その経路を含む全 flow の steps の両方に効く
for (const [key, patch] of Object.entries(P.edgePatch || {})) {
  const m = String(key).split('->');
  if (m.length !== 2) { patchMiss.push(`edgePatch キーの書式が 'from -> to' でない: ${key}`); continue; }
  const a = canon(m[0].trim()), b = canon(m[1].trim());
  const e = edges.get(ekey(a, b));
  if (!e) { patchMiss.push(`edgePatch 未知の経路 ${key}`); continue; }
  Object.assign(e, patch);
  for (const f of flows) for (const s of f.steps) if (s.from === a && s.to === b) Object.assign(s, patch);
}
for (const [id, patch] of Object.entries(P.nodePatch || {})) {
  const n = nodes.get(canon(id));
  if (!n) { patchMiss.push(`nodePatch 未知ノード ${id}`); continue; }
  Object.assign(n, patch);
}
for (const [key, patch] of Object.entries(P.flowPatch || {})) {
  const f = flows.find(x => flowKey(x) === key);
  if (!f) { patchMiss.push(`flowPatch 未知フロー ${key}`); continue; }
  if (patch.title) f.title = patch.title;
  if (patch.trigger) f.trigger = patch.trigger;
  if (patch.category) f.category = patch.category;
  if (patch.notesDrop) f.notes = f.notes.filter(n => !patch.notesDrop.some(d => n.includes(d)));
  if (patch.notesAdd) f.notes = [...patch.notesAdd, ...f.notes];
}

const emptyFlows = flows.filter(f => !f.steps.length).map(f => f.id);
let kept = flows.filter(f => f.steps.length);

/* ---------- レイヤ別に書かれた同一操作を1本に統合 ---------- */
const GROUPS = optional('merge.js') || [];
const index = new Map();
for (const f of kept) index.set(flowKey(f), f);
const consumed = new Set(), merged = [];
for (const [gid, cat, title, members] of GROUPS) {
  const ms = members.map(k => { const f = index.get(k); if (!f) problems.push(`[MERGE] 未解決: ${k}`); return f; }).filter(Boolean);
  if (ms.length < 2) { if (ms.length === 1) problems.push(`[MERGE] ${gid}: メンバー1件のみ（統合せず）`); continue; }
  ms.forEach(f => consumed.add(f));
  // 手順の和集合。同じホップは最初の出現を採り、branch は main を優先（正常系として扱う）
  const uni = new Map();
  ms.forEach((f, mi) => f.steps.forEach((s, si) => {
    const k = ekey(s.from, s.to), prev = uni.get(k);
    if (!prev) uni.set(k, { ...s, branch: s.branch || 'main', mi, si });
    else {
      if ((prev.branch || 'main') !== 'main' && (s.branch || 'main') === 'main') prev.branch = 'main';
      if (!prev.label && s.label) prev.label = s.label;
    }
  }));
  const steps = [...uni.values()];
  // 統合すると元の並び順は意味を失うので、部分グラフ内の「起点からの距離」で時系列に並べ直す
  const ns = new Set(); steps.forEach(s => { ns.add(s.from); ns.add(s.to); });
  const outm = new Map([...ns].map(i => [i, []])), indeg = new Map([...ns].map(i => [i, 0]));
  steps.forEach(s => { outm.get(s.from).push(s.to); indeg.set(s.to, indeg.get(s.to) + 1); });
  const depth = new Map([...ns].map(i => [i, 0]));
  const q = [...ns].filter(i => indeg.get(i) === 0), seen = new Set(q);
  while (q.length) {
    const v = q.shift();
    for (const w of outm.get(v)) {
      if (depth.get(w) < depth.get(v) + 1) depth.set(w, depth.get(v) + 1);
      indeg.set(w, indeg.get(w) - 1);
      if (indeg.get(w) === 0 && !seen.has(w)) { seen.add(w); q.push(w); }
    }
  }
  [...ns].forEach(i => { if (!seen.has(i)) depth.set(i, 900); });   // 閉路の中だけにいるノード
  // 正常系 → 条件分岐 → 失敗・再試行 の順。同じ組の中は起点からの距離順。
  // こうしないと、入口エッジが書かれなかった例外系の枝が深さ0になって先頭に来てしまう。
  const BR = { main: 0, alt: 1, error: 2 };
  steps.sort((a, b) =>
    (BR[a.branch] || 0) - (BR[b.branch] || 0) ||
    depth.get(a.from) - depth.get(b.from) ||
    (a.mi - b.mi) || (a.si - b.si));
  merged.push({
    id: gid, title, category: cat,
    trigger: (ms.find(f => f.trigger) || {}).trigger || '',
    steps: steps.map(({ mi, si, ...s }) => s),
    notes: [...new Set(ms.flatMap(f => f.notes || []))],
  });
}
kept = [...merged, ...kept.filter(f => !consumed.has(f))];

/* ---------- どのエッジにも現れないノードは落とす ---------- */
const used = new Set();
for (const e of edges.values()) { used.add(e.from); used.add(e.to); }
const orphans = [...nodes.keys()].filter(id => !used.has(id));
orphans.forEach(id => nodes.delete(id));

/* ---------- メタ設定と検証スタンプ ---------- */
let META = {};
const metaPath = path.join(DIR, 'meta.json');
if (fs.existsSync(metaPath)) {
  try { META = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(BOM, '')) || {}; }
  catch (e) { problems.push(`[META] meta.json: ${e.message}`); }
}
if (Array.isArray(META.lanes)) {
  // レーンキーはそのまま CSS 変数名（--<key>）になるので、書式不正と
  // テンプレートの意味色変数（正常系/失敗系/背景など）との衝突は警告して除外する
  const RESERVED = new Set(['main', 'alt', 'err', 'bg', 'bg2', 'panel', 'panel2', 'line', 'line2',
    'fg', 'fg2', 'fg3', 'accent', 'accent2', 'rt', 'net']);
  META.lanes = META.lanes.filter(l => {
    const key = String((l && l.key) || '');
    if (!l || !/^[a-z][a-z0-9_-]*$/.test(key)) {
      problems.push(`[META] lanes のキーが不正なので除外（英小文字始まり・英数字/-/_のみ）: ${l && l.key}`);
      return false;
    }
    if (RESERVED.has(key)) {
      problems.push(`[META] lanes のキー「${key}」はテンプレートの予約変数と衝突するので除外（別名にする。例: ${key}2）`);
      return false;
    }
    return true;
  });
}
const stamp = { builtAt: new Date().toISOString() };
const REPO = arg('--repo', null);
const badRefs = [];
if (REPO) {
  const repo = path.resolve(REPO);
  let ok = 0, total = 0;
  const lineCache = new Map();
  for (const n of nodes.values()) {
    const m = String(n.ref || '').match(/^(.*?):(\d+)$/);
    if (!m) continue;
    total++;
    const fp = path.join(repo, m[1]);
    let lines = lineCache.get(fp);
    if (lines === undefined) {
      lines = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8').split('\n').length : -1;
      lineCache.set(fp, lines);
    }
    if (lines >= +m[2]) ok++; else badRefs.push(`${n.ref} ← ${n.id}`);
  }
  stamp.refTotal = total; stamp.refOk = ok;
  stamp.refScope = 'node';   // 実在検査したのはノードの参照だけ。経路（エッジ）は検査対象外
  try { stamp.commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) {}
}

/* ---------- 前回ビルドとの差分 ---------- */
const DIFF_BASE = arg('--diff-base', null);
let diffSummary = null;
if (DIFF_BASE) {
  let old = null;
  try {
    const m = fs.readFileSync(path.resolve(DIFF_BASE), 'utf8').match(/const DATA = (\{[\s\S]*?\});\r?\n/);
    if (m) old = JSON.parse(m[1]);
  } catch (e) { problems.push(`[DIFF] --diff-base を読めない: ${e.message}`); }
  if (old && old.nodes) {
    const oldNodes = new Map(old.nodes.map(n => [n.id, n]));
    const oldEdges = new Set((old.edges || []).map(e => ekey(e.from, e.to)));
    const oldFlows = new Map((old.flows || []).map(f => [f.id, f]));
    const flowSig = f => JSON.stringify((f.steps || []).map(s => [s.from, s.to, s.branch || 'main']));

    const addedNodes = [...nodes.keys()].filter(id => !oldNodes.has(id));
    const changedNodes = [...nodes.entries()]
      .filter(([id, n]) => { const o = oldNodes.get(id); return o && (o.label !== n.label || o.detail !== n.detail || o.ref !== n.ref); })
      .map(([id]) => id);
    const removedNodes = [...oldNodes.values()].filter(n => !nodes.has(n.id));
    const addedEdges = [...edges.values()].filter(e => !oldEdges.has(ekey(e.from, e.to)));
    const newEdgeKeys = new Set([...edges.keys()]);
    const removedEdges = (old.edges || []).filter(e => !newEdgeKeys.has(ekey(e.from, e.to)));
    const addedFlows = kept.filter(f => !oldFlows.has(f.id)).map(f => f.id);
    const changedFlows = kept.filter(f => { const o = oldFlows.get(f.id); return o && flowSig(o) !== flowSig(f); }).map(f => f.id);
    const removedFlows = [...oldFlows.values()].filter(f => !kept.some(k => k.id === f.id));

    const baseLabel = (old.meta && old.meta.stamp && (old.meta.stamp.commit || String(old.meta.stamp.builtAt || '').slice(0, 10))) || '前回';
    const total = addedNodes.length + changedNodes.length + removedNodes.length + addedEdges.length + removedEdges.length;
    diffSummary = { addedNodes: addedNodes.length, changedNodes: changedNodes.length, removedNodes: removedNodes.length,
      addedEdges: addedEdges.length, removedEdges: removedEdges.length, baseLabel };
    if (total === 0 && !addedFlows.length && !changedFlows.length && !removedFlows.length) {
      diffSummary.unchanged = true;
    } else {
      META.diff = { baseLabel, addedNodes, changedNodes, addedFlows, changedFlows };
      // 「前回からの変更点」擬似フロー: 追加された経路が光る。削除・変更は注記に列挙する
      const label = n => `「${n.label}」(${n.id})`;
      const notes = [];
      if (removedNodes.length) notes.push('削除されたノード: ' + removedNodes.map(label).join('、'));
      if (removedEdges.length) notes.push('削除された経路: ' + removedEdges.map(e => `${e.from} → ${e.to}`).join('、'));
      if (removedFlows.length) notes.push('削除されたフロー: ' + removedFlows.map(f => `「${f.title}」`).join('、'));
      if (changedNodes.length) notes.push('内容が変わったノード: ' + changedNodes.map(id => label(nodes.get(id))).join('、'));
      if (changedFlows.length) notes.push('経路が変わったフロー: ' + changedFlows.map(id => `「${(kept.find(f => f.id === id) || {}).title}」`).join('、'));
      if (addedNodes.length) notes.push('追加されたノード: ' + addedNodes.map(id => label(nodes.get(id))).join('、'));
      if (addedEdges.length) {
        kept.push({
          id: 'diff-changes', title: '前回からの変更点', category: '変更点',
          trigger: `前回ビルド（${baseLabel}）との差分`,
          steps: addedEdges.map(e => ({ from: e.from, to: e.to, label: e.label || '追加された経路', branch: 'alt' })),
          notes,
        });
      } else if (notes.length) {
        // 追加経路が無い（削除・変更のみ）の場合もボタンは出す。既存の任意の1エッジを足場にする
        const anchor = [...edges.values()][0];
        if (anchor) kept.push({ id: 'diff-changes', title: '前回からの変更点', category: '変更点',
          trigger: `前回ビルド（${baseLabel}）との差分（追加経路なし）`,
          steps: [{ from: anchor.from, to: anchor.to, label: '（参考表示）追加された経路はない', branch: 'main' }], notes });
      }
    }
  }
}

/* ---------- 経路の根拠の集計 ---------- */
// ノードの ref は実ファイルと突き合わせられるが、「AがBを呼ぶ」は機械的に確かめようがない。
// 抽出側の申告（evidence）を集計して図に出し、「何を検証して何をしていないか」を受け手に見せる。
// 1本も申告が無いデータ（旧形式）では内訳を出さず、従来どおりの表示に落ちる。
const evCount = { direct: 0, inferred: 0, framework: 0, unverified: 0, unspecified: 0 };
for (const e of edges.values()) evCount[EV_RANK[e.evidence] !== undefined ? e.evidence : 'unspecified']++;
const evDeclared = evCount.direct + evCount.inferred + evCount.framework + evCount.unverified;
stamp.edgeTotal = edges.size;
if (evDeclared) stamp.evidence = evCount;
const weakEdges = [...edges.values()].filter(e => e.evidence === 'unverified');

/* ---------- 出力 ---------- */
const data = { meta: { ...META, stamp }, nodes: [...nodes.values()], edges: [...edges.values()], flows: kept.map(({ src, ...f }) => f) };
if (!fs.existsSync(TPL)) { console.error(`[FATAL] テンプレートが無い: ${TPL}`); process.exit(1); }
const tpl = fs.readFileSync(TPL, 'utf8');
const MARK = '/*__FLOW_DATA__*/{nodes:[],edges:[],flows:[]}';
if (!tpl.includes(MARK)) { console.error(`[FATAL] テンプレートに差し込み位置 ${MARK} が無い`); process.exit(1); }
// "</script>" を含む文字列が <script> ブロックを破らないよう "<" をエスケープして埋め込む（JSONとしては同値）
const html = tpl.replace(MARK, () => JSON.stringify(data).replace(/</g, '\\u003c'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

/* ---------- レポート ---------- */
if (!QUIET) {
  const byCat = {};
  kept.forEach(f => byCat[f.category] = (byCat[f.category] || 0) + 1);
  console.log('files      :', files.join(', '));
  console.log('nodes      :', data.nodes.length, '| edges:', data.edges.length, '| flows:', data.flows.length);
  console.log('categories :', JSON.stringify(byCat));
  console.log('lanes      :', JSON.stringify(data.nodes.reduce((a, n) => (a[n.lane] = (a[n.lane] || 0) + 1, a), {})));
  console.log('shared ids :', [...provenance].filter(([, v]) => v.length > 1).length, '個が複数ファイルに登場（層をまたいで繋がった証拠）');
  if (GROUPS.length) console.log('merged     :', merged.length, 'グループに統合（元', consumed.size, '本）');
  if (P.dropEdges || P.addEdges) console.log('patches    : 削除', dropped, '| 追加', added, '| 適用漏れ', patchMiss.length);
  patchMiss.forEach(m => console.log('   !', m));
  if (dangling.size) console.log('DANGLING   :', [...dangling].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k}(x${v})`).join(' '));
  if (orphans.length) console.log('ORPHANS    :', orphans.slice(0, 30).join(' '));
  if (emptyFlows.length) console.log('EMPTY FLOWS:', emptyFlows.join(' '));
  if (problems.length) console.log('PROBLEMS   :\n  ' + problems.join('\n  '));
  if (META.lanes) console.log('meta       : レーン', META.lanes.length, '本に総入れ替え', META.title ? `| タイトル「${META.title}」` : '');
  if (diffSummary) console.log('diff       :', diffSummary.unchanged ? `変更なし（基準: ${diffSummary.baseLabel}）` :
    `+${diffSummary.addedNodes}ノード / 変更${diffSummary.changedNodes} / 削除${diffSummary.removedNodes} | 経路 +${diffSummary.addedEdges}/-${diffSummary.removedEdges}（基準: ${diffSummary.baseLabel}）`);
  if (stamp.refTotal !== undefined) {
    console.log('ref verify : ノード参照', stamp.refOk + '/' + stamp.refTotal, '実在OK（経路は検査対象外）', stamp.commit ? `| commit ${stamp.commit}` : '');
    badRefs.slice(0, 20).forEach(r => console.log('   !', r));
  }
  if (evDeclared) {
    console.log('edge basis :', `直接 ${evCount.direct} / 推定 ${evCount.inferred} / 暗黙 ${evCount.framework} / 未確認 ${evCount.unverified}`
      + (evCount.unspecified ? ` / 申告なし ${evCount.unspecified}` : ''));
    weakEdges.slice(0, 15).forEach(e => console.log('   ? 未確認:', e.from, '->', e.to, e.label ? `« ${e.label} »` : ''));
    if (weakEdges.length) console.log('   → 未確認の経路は、知っている人に確認して patches.js に根拠つきで書き直す');
  } else if (edges.size) {
    console.log('edge basis : 申告なし（全', edges.size, '経路）。抽出時に evidence を書かせると、図に根拠の内訳が出る');
  }
  console.log('no-ref     :', data.nodes.filter(n => !n.ref).length, '個のノードにコード参照が無い');
  console.log('avg steps  :', data.flows.length ? (data.flows.reduce((s, f) => s + f.steps.length, 0) / data.flows.length).toFixed(1) : 0);
  console.log('->', OUT, (html.length / 1024).toFixed(0) + 'KB');
}
