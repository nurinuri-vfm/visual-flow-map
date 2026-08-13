#!/usr/bin/env node
/**
 * フローJSON群の品質監査。build.js の前に走らせる。
 *
 *   node audit.js --data <jsonのあるディレクトリ> [--repo <リポジトリのルート>]
 *
 * 出すもの:
 *   1. ID分裂       同じ ref（ファイル:行）と同じレーンなのに別IDになっているノード → aliases.js の候補
 *   2. ラベル衝突    同じレーンで同じ/近いラベルなのに別IDのノード → 目視で判断する候補
 *   3. 参照切れ      エッジや手順が指しているのにノード定義が無いID
 *   4. 孤立         どのエッジにも出てこないノード
 *   5. フロー重複    同じ操作を別レイヤから書いたと思われるフロー → merge.js の候補
 *   6. ハルシネーション  --repo を渡すと ref のファイル存在と行番号の範囲を実際に検証する
 *   7. 規模見積り    全体マップの推定サイズ（横に伸びすぎていないか）
 *
 * 1と5を放置すると「層をまたぐ経路が2本のレールに割れて一生合流しない」図になる。
 * ここで潰すのが一番安い。
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DIR = path.resolve(arg('--data', process.cwd()));
const REPO = arg('--repo', null);
const TOP = Number(arg('--top', 40));

const nodes = new Map(), flows = [], edgeRefs = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8').replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '')); }
  catch (e) { console.log(`[PARSE] ${f}: ${e.message}`); continue; }
  const src = f.replace('.json', '');
  for (const n of j.nodes || []) if (n && n.id && !nodes.has(n.id)) nodes.set(n.id, { ...n, src });
  for (const e of j.edges || []) if (e && e.from && e.to) edgeRefs.push({ ...e, src });
  for (const fl of j.flows || []) if (fl && fl.id) {
    flows.push({ ...fl, src, key: src + ':' + fl.id });
    for (const s of fl.steps || []) if (s && s.from && s.to) edgeRefs.push({ ...s, src });
  }
}
const all = [...nodes.values()];
console.log(`読み込み: ${all.length} ノード / ${edgeRefs.length} エッジ参照 / ${flows.length} フロー\n`);

/* 1. ID分裂 ------------------------------------------------------------- */
const byRef = new Map();
all.forEach(n => { if (!n.ref) return; const k = n.lane + '|' + String(n.ref).trim(); (byRef.get(k) || byRef.set(k, []).get(k)).push(n); });
const split = [...byRef.values()].filter(v => v.length > 1);
console.log(`【1】同じ ref・同じレーンで別ID: ${split.length} 組`);
console.log('   → 同一実体なら aliases.js に畳む。別物なら理由を aliases.js のコメントに残す。');
split.slice(0, TOP).forEach(v => {
  console.log(`   ${v[0].ref}  [${v[0].lane}]`);
  v.forEach(n => console.log(`      ${n.id}  「${n.label}」  (${n.src})`));
});
if (split.length > TOP) console.log(`   … 他 ${split.length - TOP} 組`);

/* 2. ラベル衝突 --------------------------------------------------------- */
const norm = s => String(s || '').replace(/[（）()・\s]/g, '').replace(/[ぁ-ん]/g, '');
const pairs = [];
for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
  const x = all[a], y = all[b];
  if (x.lane !== y.lane || x.ref === y.ref) continue;
  const nx = norm(x.label), ny = norm(y.label);
  if (nx.length < 3) continue;
  if (nx === ny || (nx.length > 4 && ny.length > 4 && (nx.includes(ny) || ny.includes(nx)))) pairs.push([x, y]);
}
console.log(`\n【2】ラベルが同じ/近いのに別ID: ${pairs.length} 組（別画面・別関数なら正しい。要目視）`);
pairs.slice(0, TOP).forEach(([x, y]) => {
  console.log(`   「${x.label}」 ${x.id} (${x.ref})`);
  console.log(`   「${y.label}」 ${y.id} (${y.ref})`);
});
if (pairs.length > TOP) console.log(`   … 他 ${pairs.length - TOP} 組`);

/* 3-4. 参照切れ・孤立 --------------------------------------------------- */
const dangling = new Map(), used = new Set();
edgeRefs.forEach(e => {
  for (const id of [e.from, e.to]) {
    if (nodes.has(id)) used.add(id);
    else dangling.set(id, (dangling.get(id) || 0) + 1);
  }
});
console.log(`\n【3】参照切れ（ノード定義が無いID）: ${dangling.size} 件`);
[...dangling].sort((a, b) => b[1] - a[1]).slice(0, TOP).forEach(([id, c]) => console.log(`   ${id}  (${c}回参照)`));
const orphans = all.filter(n => !used.has(n.id));
console.log(`\n【4】孤立ノード（どのエッジにも出てこない）: ${orphans.length} 件`);
orphans.slice(0, TOP).forEach(n => console.log(`   ${n.id}  「${n.label}」  (${n.src})`));

/* 5. フロー重複 --------------------------------------------------------- */
const fnorm = s => norm(s).toLowerCase();
const dup = new Map();
flows.forEach(f => {
  const k = fnorm(f.title).slice(0, 8) || f.id;
  (dup.get(k) || dup.set(k, []).get(k)).push(f);
});
const dupGroups = [...dup.values()].filter(v => v.length > 1 && new Set(v.map(f => f.src)).size > 1);
const idDup = new Map();
flows.forEach(f => (idDup.get(f.id) || idDup.set(f.id, []).get(f.id)).push(f));
const idGroups = [...idDup.values()].filter(v => v.length > 1);
console.log(`\n【5】同一操作を別レイヤから書いたと思われるフロー: ID一致 ${idGroups.length} 組 / タイトル類似 ${dupGroups.length} 組`);
console.log('   → merge.js に統合グループとして書く。放置すると同じ操作のボタンが3〜5個並ぶ。');
[...idGroups, ...dupGroups].slice(0, TOP).forEach(v => {
  console.log(`   ${v.map(f => f.key).join('  +  ')}`);
  console.log(`      ${v.map(f => '「' + f.title + '」').join(' / ')}`);
});

/* 6. ハルシネーション検査 ----------------------------------------------- */
if (REPO) {
  const lineCache = new Map();
  const lineCount = p => {
    if (lineCache.has(p)) return lineCache.get(p);
    let n = -1;
    try { n = fs.readFileSync(p, 'utf8').split('\n').length; } catch { n = -1; }
    lineCache.set(p, n); return n;
  };
  const bad = [];
  for (const n of all) {
    const m = String(n.ref || '').match(/^(.*?):(\d+)$/);
    if (!m) { if (n.ref) bad.push([n, 'ref の書式が「パス:行」でない']); continue; }
    const p = path.join(REPO, m[1]);
    const lc = lineCount(p);
    if (lc < 0) bad.push([n, 'ファイルが無い']);
    else if (+m[2] > lc) bad.push([n, `行番号が範囲外（ファイルは ${lc} 行）`]);
  }
  console.log(`\n【6】コード参照の実在検査: ${all.length - bad.length}/${all.length} 件 OK、${bad.length} 件が不正`);
  bad.slice(0, TOP).forEach(([n, why]) => console.log(`   ${n.ref}  ${why}   ← ${n.id}`));
} else {
  console.log('\n【6】コード参照の実在検査: --repo を渡すと実行する（ハルシネーション検出に有効）');
}

/* 7. 規模見積り --------------------------------------------------------- */
// 経路ビューの横幅はフローごとの「最長経路の段数」で決まる。閉路があると最長経路が発散するので、
// レンダラと同じく DFS で後退エッジを外してから測る。
function longestPath(stepList) {
  const ns = new Set();
  stepList.forEach(s => { ns.add(s.from); ns.add(s.to); });
  const out = new Map([...ns].map(i => [i, []]));
  stepList.forEach(s => out.get(s.from).push(s.to));
  const state = new Map([...ns].map(i => [i, 0])), back = new Set();
  for (const r of ns) {
    if (state.get(r) !== 0) continue;
    const st = [[r, 0]]; state.set(r, 1);
    while (st.length) {
      const top = st[st.length - 1], kids = out.get(top[0]);
      if (top[1] >= kids.length) { state.set(top[0], 2); st.pop(); continue; }
      const nx = kids[top[1]++], s = state.get(nx);
      if (s === 1) back.add(top[0] + '>' + nx);
      else if (s === 0) { state.set(nx, 1); st.push([nx, 0]); }
    }
  }
  const fwd = stepList.filter(s => !back.has(s.from + '>' + s.to));
  const fo = new Map([...ns].map(i => [i, []])), deg = new Map([...ns].map(i => [i, 0]));
  fwd.forEach(s => { fo.get(s.from).push(s.to); deg.set(s.to, deg.get(s.to) + 1); });
  const depth = new Map([...ns].map(i => [i, 0]));
  const q = [...ns].filter(i => deg.get(i) === 0), seen = new Set(q);
  let max = 0;
  while (q.length) {
    const v = q.shift();
    for (const w of fo.get(v)) {
      if (depth.get(w) < depth.get(v) + 1) depth.set(w, depth.get(v) + 1);
      max = Math.max(max, depth.get(w));
      deg.set(w, deg.get(w) - 1);
      if (deg.get(w) === 0 && !seen.has(w)) { seen.add(w); q.push(w); }
    }
  }
  return { depth: max, nodes: ns.size };
}
const perFlow = flows.map(f => ({ key: f.key, steps: (f.steps || []).length, ...longestPath((f.steps || []).filter(s => s && s.from && s.to)) }));
const depths = perFlow.map(p => p.depth).sort((a, b) => b - a);
// 全体マップはレーンごとに格子詰めするので、幅は「一番ノードの多いレーン」で決まる（列数は22で頭打ち）
const perLane = all.reduce((a, n) => (a[n.lane] = (a[n.lane] || 0) + 1, a), {});
const maxCols = Math.max(...Object.values(perLane).map(c => Math.min(22, Math.ceil(Math.sqrt(c * 2.6)))), 1);
const mapW = maxCols * 192 + 148;
console.log(`\n【7】規模`);
console.log(`   全体マップ: ${all.length} ノード → 格子詰めで推定 約 ${mapW}px 幅（4000px 程度までなら実用範囲）`);
console.log(`   経路ビュー: 最長 ${depths[0] || 0} 段 / 中央値 ${depths[Math.floor(depths.length / 2)] || 0} 段 → 最長フローの推定幅 約 ${((depths[0] || 0) + 1) * 236}px`);
const heavy = perFlow.filter(p => p.steps > 60 || p.depth > 30).sort((a, b) => b.steps - a.steps);
if (heavy.length) {
  console.log(`   重いフロー ${heavy.length} 本（手順60超 または 30段超。分割を検討）:`);
  heavy.slice(0, TOP).forEach(p => console.log(`      ${p.key}  手順${p.steps} / ${p.depth}段 / ${p.nodes}ノード`));
}
