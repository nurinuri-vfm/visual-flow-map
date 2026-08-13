-- 注文・決済・在庫・ジョブの4テーブル
CREATE TABLE orders (
  id         BIGSERIAL PRIMARY KEY,
  items      JSONB NOT NULL,
  payment_id TEXT REFERENCES payments(id),
  status     TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id     TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  state  TEXT NOT NULL CHECK (state IN ('captured', 'refunded'))
);

CREATE TABLE inventory (
  sku   TEXT PRIMARY KEY,
  stock INTEGER NOT NULL CHECK (stock >= 0)
);

CREATE TABLE jobs (
  id        BIGSERIAL PRIMARY KEY,
  type      TEXT NOT NULL,
  payload   JSONB NOT NULL,
  state     TEXT NOT NULL CHECK (state IN ('pending', 'running', 'done', 'dead')),
  run_after TIMESTAMPTZ NOT NULL DEFAULT now()
);
