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
