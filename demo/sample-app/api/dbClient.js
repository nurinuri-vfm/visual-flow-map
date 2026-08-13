// DB クライアント: SQL 実行の薄いラッパ（スキーマは db/schema.sql）
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  insertOrder: async (o) => (await pool.query(
    'INSERT INTO orders (items, payment_id, status) VALUES ($1, $2, $3) RETURNING id',
    [JSON.stringify(o.items), o.paymentId, o.status])).rows[0].id,
  getOrder: async (id) => (await pool.query('SELECT * FROM orders WHERE id = $1', [id])).rows[0],
  updateOrderStatus: (id, status) => pool.query('UPDATE orders SET status = $2 WHERE id = $1', [id, status]),
  insertPayment: (p) => pool.query(
    'INSERT INTO payments (id, amount, state) VALUES ($1, $2, $3)', [p.paymentId, p.amount, p.state]),
  updatePaymentState: (id, state) => pool.query('UPDATE payments SET state = $2 WHERE id = $1', [id, state]),
  decrementStock: async (sku, qty) => (await pool.query(
    'UPDATE inventory SET stock = stock - $2 WHERE sku = $1 AND stock >= $2', [sku, qty])).rowCount > 0,
  incrementStock: (sku, qty) => pool.query('UPDATE inventory SET stock = stock + $2 WHERE sku = $1', [sku, qty]),
  insertJob: (j) => pool.query(
    'INSERT INTO jobs (type, payload, state, run_after) VALUES ($1, $2, $3, $4)',
    [j.type, j.payload, j.state, j.runAfter]),
};
