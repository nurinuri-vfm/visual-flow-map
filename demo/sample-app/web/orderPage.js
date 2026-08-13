// 注文ページ: ボタンから API を呼ぶ薄い UI 層
import { postJson } from './apiClient.js';

const state = { cart: [], lastOrderId: null };

export async function onCreateOrderClick() {
  const items = state.cart.map(c => ({ sku: c.sku, qty: c.qty }));
  const res = await postJson('/orders', { items });
  if (res.status === 409) {
    showToast('在庫が不足しています');
    return;
  }
  state.lastOrderId = res.body.orderId;
  renderOrderStatus(res.body);
}

export async function onCancelOrderClick(orderId) {
  const res = await postJson(`/orders/${orderId}/cancel`, {});
  if (!res.ok) {
    showToast('キャンセルに失敗しました。時間をおいて再度お試しください');
    return;
  }
  renderOrderStatus(res.body);
}

export function renderOrderStatus(order) {
  const el = document.getElementById('order-status');
  el.textContent = `注文 ${order.orderId}: ${order.status}`;
}

function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}
