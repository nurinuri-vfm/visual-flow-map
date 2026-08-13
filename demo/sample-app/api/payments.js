// 決済サービス: 外部決済ゲートウェイの呼び出しと記録
const db = require('./dbClient');
const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'https://pay.example.com/v1';

async function chargeCard(items) {
  const amount = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const res = await callGateway('/charges', { amount, currency: 'jpy' });
  if (!res.ok) return { ok: false };
  await db.insertPayment({ paymentId: res.id, amount, state: 'captured' });
  return { ok: true, paymentId: res.id };
}

async function refundPayment(paymentId) {
  const res = await callGateway(`/charges/${paymentId}/refund`, {});
  if (!res.ok) return { ok: false, reason: res.error };
  await db.updatePaymentState(paymentId, 'refunded');
  return { ok: true };
}

async function callGateway(path, body) {
  const res = await fetch(GATEWAY_URL + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PAYMENT_API_KEY}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

module.exports = { chargeCard, refundPayment };
