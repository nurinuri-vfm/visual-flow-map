// API クライアント: JSON POST の共通ラッパ
const BASE = '/api';

export async function postJson(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try { parsed = await res.json(); } catch (e) { /* empty body */ }
  return { ok: res.ok, status: res.status, body: parsed };
}
