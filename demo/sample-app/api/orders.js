// 注文サービス: 作成とキャンセルのユースケースを束ねる
const db = require('./dbClient');
const { reserveStock, releaseStock } = require('./inventory');
const { chargeCard, refundPayment } = require('./payments');
const { enqueueJob } = require('./jobs');

async function createOrder(items) {
  const reserved = await reserveStock(items);
  if (!reserved.ok) {
    return { status: 409, body: { error: 'out_of_stock', skus: reserved.missing } };
  }
  const charge = await chargeCard(items);
  if (!charge.ok) {
    // 決済に失敗したら確保した在庫は必ず戻す
    await releaseStock(items);
    return { status: 402, body: { error: 'payment_declined' } };
  }
  const orderId = await db.insertOrder({ items, paymentId: charge.paymentId, status: 'confirmed' });
  await enqueueJob('send-order-email', { orderId, kind: 'confirmed' });
  return { status: 201, body: { orderId, status: 'confirmed' } };
}

async function cancelOrder(orderId) {
  const order = await db.getOrder(orderId);
  if (!order || order.status !== 'confirmed') {
    return { status: 409, body: { error: 'not_cancellable' } };
  }
  const refund = await refundPayment(order.paymentId);
  if (!refund.ok) {
    // 返金は同期では諦め、ワーカーの再試行ジョブに委ねる
    await enqueueJob('retry-refund', { orderId, paymentId: order.paymentId, attempt: 1 });
  }
  await releaseStock(order.items);
  await db.updateOrderStatus(orderId, 'cancelled');
  await enqueueJob('send-order-email', { orderId, kind: 'cancelled' });
  return { status: 200, body: { orderId, status: 'cancelled' } };
}

module.exports = { createOrder, cancelOrder };
