-- Apply to a NEW development database first. Review and back up before production.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','moderator','support','admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_expiry_idx ON sessions(user_id,expires_at);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 3000),
  category text NOT NULL CHECK (category IN ('electronics','fashion','home','beauty','services','digital')),
  price_minor bigint NOT NULL CHECK (price_minor > 0),
  currency text NOT NULL DEFAULT 'MMK' CHECK (currency='MMK'),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('draft','pending_review','published','rejected','suspended','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_public_search_idx ON products(status,category,created_at DESC);
CREATE INDEX IF NOT EXISTS products_seller_idx ON products(seller_id,created_at DESC);

-- Intentionally no public table grants or Row Level Security bypasses are defined here.
-- Restrict DB credentials to this API. Add per-role database policies before direct
-- client/database access is ever enabled. Moderation state changes are admin-only work.

CREATE TABLE IF NOT EXISTS seller_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 24),
  region text NOT NULL CHECK (char_length(region) BETWEEN 2 AND 80),
  about text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_applications_status_idx ON seller_applications(status,created_at);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','preparing','shipped','delivered','cancelled','disputed')),
  payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method='cod'),
  currency text NOT NULL DEFAULT 'MMK' CHECK (currency='MMK'),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor>0),
  total_minor bigint NOT NULL CHECK (total_minor>0),
  delivery_address text NOT NULL CHECK (char_length(delivery_address) BETWEEN 10 AND 500),
  buyer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id<>seller_id)
);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_seller_idx ON orders(seller_id,created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_title text NOT NULL,
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor>0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  moderator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('publish','reject')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
