#!/usr/bin/env node
/**
 * 生成済みHTML（または JSON ディレクトリ）の中身を人が読める形で覗く。
 * 「経路が本当に繋がっているか」を目で確かめるのに使う。図を開かなくても確認できる。
 *
 *   node inspect.js --html flow-map.html --flow <flowId>     フローの手順を順番に出す
 *   node inspect.js --html flow-map.html --node <nodeId>     そのノードの入出力エッジを出す
 *   node inspect.js --html flow-map.html --list              フロー一覧（カテゴリ・手順数つき）
 *   node inspect.js --data ./flowdata --flow <flowId>        HTML の代わりに JSON 群から読む
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const HTML = arg('--html', null), DATA = arg('--data', null);
const FLOW = arg('--flow', null), NODE = arg('--node', null);
const LIST = argv.includes('--list');

let data;
if (HTML) {
  const m = fs.readFileSync(path.resolve(HTML), 'utf8').match(/const DATA = (\{[\s\S]*?\});\r?\n/);
  if (!m) { console.error('[FATAL] HTML から const DATA を取り出せない'); process.exit(1); }
  data = JSON.parse(m[1]);
} else if (DATA) {
  data = { nodes: [], edges: [], flows: [] };
  for (const f of fs.readdirSync(path.resolve(DATA)).filter(x => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(path.resolve(DATA), f), 'utf8'));
    data.nodes.push(...(j.nodes || [])); data.edges.push(...(j.edges || [])); data.flows.push(...(j.flows || []));
  }
} else { console.error('--html か --data のどちらかを渡す'); process.exit(1); }

const N = new Map(data.nodes.map(n => [n.id, n]));
const show = id => { const n = N.get(id); return n ? `[${n.lane}] ${n.label}` : `[?] ${id}`; };

if (LIST || (!FLOW && !NODE)) {
  const byCat = new Map();
  data.flows.forEach(f => (byCat.get(f.category) || byCat.set(f.category, []).get(f.category)).push(f));
  console.log(`ノード ${data.nodes.length} / エッジ ${data.edges.length} / フロー ${data.flows.length}\n`);
  for (const [cat, fs_] of byCat) {
    console.log(`■ ${cat}`);
    fs_.forEach(f => console.log(`   ${String(f.steps.length).padStart(3)}手順  ${f.id.padEnd(34)} ${f.title}`));
  }
}

if (FLOW) {
  const f = data.flows.find(x => x.id === FLOW);
  if (!f) { console.error(`フロー ${FLOW} が無い`); process.exit(1); }
  console.log(`=== ${f.title}  (${f.category} / ${f.steps.length}手順)`);
  if (f.trigger) console.log(`操作: ${f.trigger}\n`);
  f.steps.forEach((s, i) => {
    const b = s.branch && s.branch !== 'main' ? ` <${s.branch}>` : '';
    console.log(`${String(i + 1).padStart(3)}. ${show(s.from)} → ${show(s.to)}${b}`);
    if (s.label) console.log(`      « ${s.label} »`);
    const to = N.get(s.to);
    if (to && to.ref) console.log(`      ${to.ref}`);
  });
  if (f.notes && f.notes.length) { console.log('\n注意点:'); f.notes.forEach(n => console.log(`  - ${n}`)); }
  // 手順が一本に繋がっているか（前の手順の to が次の from になっているか）を機械的に見る
  let breaks = 0;
  for (let i = 1; i < f.steps.length; i++) {
    const reach = new Set(f.steps.slice(0, i).flatMap(s => [s.from, s.to]));
    if (!reach.has(f.steps[i].from)) { breaks++; if (breaks <= 5) console.log(`\n[断線] ${i + 1}番目の起点 ${show(f.steps[i].from)} は、それ以前の手順に一度も出てこない`); }
  }
  if (breaks) console.log(`\n断線 ${breaks} 件。入口のエッジが書かれていない可能性が高い。`);
}

if (NODE) {
  const n = N.get(NODE);
  if (!n) { console.error(`ノード ${NODE} が無い`); process.exit(1); }
  console.log(`=== ${n.label}  (${n.id})`);
  console.log(`レーン: ${n.lane}\n参照: ${n.ref}\n説明: ${n.detail}\n`);
  console.log('入力:'); data.edges.filter(e => e.to === NODE).forEach(e => console.log(`   ${show(e.from)}  « ${e.label || ''} »`));
  console.log('出力:'); data.edges.filter(e => e.from === NODE).forEach(e => console.log(`   → ${show(e.to)}  « ${e.label || ''} »`));
  const via = data.flows.filter(f => f.steps.some(s => s.from === NODE || s.to === NODE));
  console.log(`\nこのノードを通る操作 ${via.length} 件:`);
  via.forEach(f => console.log(`   ${f.title}`));
}
