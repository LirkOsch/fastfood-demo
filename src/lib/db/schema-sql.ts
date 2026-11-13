/**
 * Единая схема для локального PostgreSQL (PGlite) и production-PostgreSQL.
 * При изменении схемы обновите также db/schema.sql в корне проекта.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS app_config (
    id text PRIMARY KEY,
    company jsonb NOT NULL,
    pricing jsonb NOT NULL,
    game jsonb NOT NULL,
    character jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS admin_users (
    id text PRIMARY KEY,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    password_changed_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (email)`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    user_agent text,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS admin_sessions_token_idx ON admin_sessions (token_hash)`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id text PRIMARY KEY,
    order_no text NOT NULL,
    public_token text NOT NULL,
    idempotency_key text NOT NULL,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'completed', 'cancelled')),
    customer_name text NOT NULL,
    phone text NOT NULL,
    delivery_method text NOT NULL CHECK (delivery_method IN ('delivery', 'pickup')),
    address text,
    out_of_town boolean NOT NULL DEFAULT false,
    preferred_date date,
    preferred_time text,
    comment text,
    consent_at timestamptz NOT NULL,
    items jsonb NOT NULL,
    pricing_snapshot jsonb NOT NULL,
    totals jsonb NOT NULL,
    known_subtotal integer NOT NULL,
    total_known integer NOT NULL,
    has_quote boolean NOT NULL DEFAULT false,
    final_total integer,
    agreed_at timestamptz,
    admin_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_no_idx ON orders (order_no)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_token_idx ON orders (public_token)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_idx ON orders (idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)`,
  `CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at)`,
  `CREATE TABLE IF NOT EXISTS order_photos (
    id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    mime text NOT NULL DEFAULT 'image/webp',
    width integer NOT NULL,
    height integer NOT NULL,
    bytes bytea NOT NULL,
    thumb bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS order_photos_order_idx ON order_photos (order_id)`,
  `CREATE TABLE IF NOT EXISTS order_events (
    id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id)`,
  `CREATE TABLE IF NOT EXISTS bonus_codes (
    id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    code text NOT NULL,
    amount integer NOT NULL,
    min_order integer NOT NULL,
    status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'redeemed', 'expired')),
    expires_at timestamptz NOT NULL,
    redeemed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS bonus_codes_order_idx ON bonus_codes (order_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS bonus_codes_code_idx ON bonus_codes (code)`,
];
