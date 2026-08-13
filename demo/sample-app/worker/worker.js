// ワーカー: jobs テーブルを 5 秒ごとにポーリングして処理する常駐プロセス
const db = require('../api/dbClient');
const { refundPayment } = require('../api/payments');
const { sendEmail } = require('./mailer');

const MAX_REFUND_ATTEMPTS = 3;

async function mainLoop() {
  while (true) {
    const job = await fetchNextJob();
    if (job) await processJob(job);
    else await sleep(5000);
  }
}

async function fetchNextJob() {
  const { rows } = await db.pool.query(
    "UPDATE jobs SET state = 'running' WHERE id = (SELECT id FROM jobs WHERE state = 'pending' AND run_after <= now() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *");
  return rows[0] || null;
}

async function processJob(job) {
  const payload = JSON.parse(job.payload);
  if (job.type === 'send-order-email') return sendOrderEmail(job, payload);
  if (job.type === 'retry-refund') return retryRefund(job, payload);
  await markJob(job.id, 'dead');
}

async function sendOrderEmail(job, { orderId, kind }) {
  const order = await db.getOrder(orderId);
  const subject = kind === 'cancelled' ? 'キャンセルを承りました' : 'ご注文ありがとうございます';
  const sent = await sendEmail(order.email, subject, renderBody(order, kind));
  await markJob(job.id, sent ? 'done' : 'pending');
}

async function retryRefund(job, { orderId, paymentId, attempt }) {
  const refund = await refundPayment(paymentId);
  if (refund.ok) return markJob(job.id, 'done');
  if (attempt >= MAX_REFUND_ATTEMPTS) {
    // 3 回失敗したら dead にして人間の対応に回す
    return markJob(job.id, 'dead');
  }
  await db.insertJob({ type: 'retry-refund', payload: JSON.stringify({ orderId, paymentId, attempt: attempt + 1 }),
    state: 'pending', runAfter: new Date(Date.now() + 60000 * attempt) });
  await markJob(job.id, 'done');
}

const markJob = (id, state) => db.pool.query('UPDATE jobs SET state = $2 WHERE id = $1', [id, state]);
const renderBody = (order, kind) => `注文 ${order.id} は ${kind} になりました。`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

mainLoop();
