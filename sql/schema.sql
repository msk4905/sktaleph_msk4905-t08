CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username         text NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 1 AND 40),
  webauthn_user_id text NOT NULL UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key    bytea NOT NULL,
  counter       bigint NOT NULL DEFAULT 0,
  transports    text[] NOT NULL DEFAULT '{}',
  device_type   text NOT NULL,
  backed_up     boolean NOT NULL,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credentials_user_id_idx ON credentials (user_id);

CREATE TABLE challenges (
  challenge           text PRIMARY KEY,
  purpose             text NOT NULL CHECK (purpose IN ('register', 'login')),
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  pending_username    text,
  pending_user_handle text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  used_at             timestamptz
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE private_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX private_items_user_id_idx ON private_items (user_id, created_at);
