// 在庫サービス: 確保と解放（確保は原子的に行う）
const db = require('./dbClient');

async function reserveStock(items) {
  const missing = [];
  for (const item of items) {
    const ok = await db.decrementStock(item.sku, item.qty);
    if (!ok) missing.push(item.sku);
  }
  if (missing.length) {
    // 一部でも足りなければ、確保できた分も含めて全て戻す
    await releaseStock(items.filter(i => !missing.includes(i.sku)));
    return { ok: false, missing };
  }
  return { ok: true };
}

async function releaseStock(items) {
  for (const item of items) {
    await db.incrementStock(item.sku, item.qty);
  }
}

module.exports = { reserveStock, releaseStock };
