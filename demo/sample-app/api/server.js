// HTTP サーバ: ルーティングだけを担当する
const { createOrder, cancelOrder } = require('./orders');

const routes = [
  { method: 'POST', pattern: /^\/orders$/, handler: handleCreateOrder },
  { method: 'POST', pattern: /^\/orders\/(\w+)\/cancel$/, handler: handleCancelOrder },
];

async function handleRequest(req, res) {
  for (const r of routes) {
    const m = req.method === r.method && req.path.match(r.pattern);
    if (m) return r.handler(req, res, m);
  }
  res.writeHead(404).end();
}

async function handleCreateOrder(req, res) {
  const result = await createOrder(req.body.items);
  res.writeHead(result.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.body));
}

async function handleCancelOrder(req, res, match) {
  const result = await cancelOrder(match[1]);
  res.writeHead(result.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.body));
}

module.exports = { handleRequest };
