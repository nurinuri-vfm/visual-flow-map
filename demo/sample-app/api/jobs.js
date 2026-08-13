// ジョブ発行: ワーカーに渡す仕事を jobs テーブルに積む
const db = require('./dbClient');

async function enqueueJob(type, payload) {
  await db.insertJob({
    type,
    payload: JSON.stringify(payload),
    state: 'pending',
    runAfter: new Date(),
  });
}

module.exports = { enqueueJob };
