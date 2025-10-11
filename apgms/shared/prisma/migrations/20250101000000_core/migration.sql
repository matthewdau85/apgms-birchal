CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE ROLE app_read NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE app_write NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS org (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Australia/Melbourne',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'VIEWER',
  mfa_enabled boolean NOT NULL DEFAULT false,
  invited_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_account_email_per_org UNIQUE (org_id, email),
  CONSTRAINT user_account_role_chk CHECK (role IN ('OWNER','ADMIN','ACCOUNTANT','VIEWER'))
);

CREATE TABLE IF NOT EXISTS bank_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  external_id text NOT NULL,
  bank_account text NOT NULL,
  posted_at timestamptz NOT NULL,
  value_date timestamptz NOT NULL,
  amount_cents bigint NOT NULL,
  balance_cents bigint,
  counterparty text,
  description text,
  reference text,
  gst_txn_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_line_amount_chk CHECK (amount_cents % 1 = 0),
  CONSTRAINT bank_line_balance_chk CHECK (balance_cents IS NULL OR balance_cents % 1 = 0),
  CONSTRAINT bank_line_external_per_org UNIQUE (org_id, external_id)
);

CREATE TABLE IF NOT EXISTS gst_txn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  source_document text NOT NULL,
  period_key text NOT NULL,
  gst_collected_cents bigint NOT NULL,
  gst_paid_cents bigint NOT NULL,
  net_amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'unmatched',
  txn_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gst_txn_collected_chk CHECK (gst_collected_cents % 1 = 0),
  CONSTRAINT gst_txn_paid_chk CHECK (gst_paid_cents % 1 = 0),
  CONSTRAINT gst_txn_net_chk CHECK (net_amount_cents % 1 = 0),
  CONSTRAINT gst_txn_document_per_org UNIQUE (org_id, source_document)
);

CREATE TABLE IF NOT EXISTS paygw_txn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  payroll_run_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  paygw_withheld_cents bigint NOT NULL,
  super_accrued_cents bigint NOT NULL,
  gross_pay_cents bigint NOT NULL,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paygw_txn_withheld_chk CHECK (paygw_withheld_cents % 1 = 0),
  CONSTRAINT paygw_txn_super_chk CHECK (super_accrued_cents % 1 = 0),
  CONSTRAINT paygw_txn_gross_chk CHECK (gross_pay_cents % 1 = 0),
  CONSTRAINT paygw_txn_run_per_org UNIQUE (org_id, payroll_run_id)
);

CREATE TABLE IF NOT EXISTS bas_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  period_key text NOT NULL,
  prepared_by_user_id uuid,
  reviewed_by_user_id uuid,
  gst_payable_cents bigint NOT NULL,
  gst_receivable_cents bigint NOT NULL,
  paygw_withheld_cents bigint NOT NULL,
  net_payable_cents bigint NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bas_draft_payable_chk CHECK (gst_payable_cents % 1 = 0),
  CONSTRAINT bas_draft_receivable_chk CHECK (gst_receivable_cents % 1 = 0),
  CONSTRAINT bas_draft_paygw_chk CHECK (paygw_withheld_cents % 1 = 0),
  CONSTRAINT bas_draft_net_chk CHECK (net_payable_cents % 1 = 0),
  CONSTRAINT bas_draft_period_per_org UNIQUE (org_id, period_key)
);

CREATE TABLE IF NOT EXISTS audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS secret_blob (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  secret_key text NOT NULL,
  version integer NOT NULL,
  cipher text NOT NULL,
  iv bytea NOT NULL,
  ciphertext bytea NOT NULL,
  auth_tag bytea,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  CONSTRAINT secret_blob_version_per_key UNIQUE (org_id, secret_key, version)
);

CREATE INDEX IF NOT EXISTS idx_user_account_org_role ON user_account (org_id, role);
CREATE INDEX IF NOT EXISTS idx_bank_line_org_posted_at ON bank_line (org_id, posted_at);
CREATE INDEX IF NOT EXISTS idx_gst_txn_org_period_key ON gst_txn (org_id, period_key);
CREATE INDEX IF NOT EXISTS idx_paygw_txn_org_period_end ON paygw_txn (org_id, period_end);
CREATE INDEX IF NOT EXISTS idx_bas_draft_org_status ON bas_draft (org_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_event_org_created_at ON audit_event (org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_secret_blob_org_key ON secret_blob (org_id, secret_key);

ALTER TABLE user_account
  ADD CONSTRAINT user_account_org_fk
  FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;

ALTER TABLE bank_line
  ADD CONSTRAINT bank_line_org_fk
  FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;

ALTER TABLE bank_line
  ADD CONSTRAINT bank_line_gst_fk
  FOREIGN KEY (gst_txn_id) REFERENCES gst_txn(id) ON DELETE SET NULL;

ALTER TABLE gst_txn
  ADD CONSTRAINT gst_txn_org_fk
  FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;

ALTER TABLE paygw_txn
  ADD CONSTRAINT paygw_txn_org_fk
  FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;

ALTER TABLE bas_draft
  ADD CONSTRAINT bas_draft_org_fk
  FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;

ALTER TABLE bas_draft
  ADD CONSTRAINT bas_draft_prepared_by_fk
  FOREIGN KEY (prepared_by_user_id) REFERENCES user_account(id) ON DELETE SET NULL;

ALTER TABLE bas_draft
  ADD CONSTRAINT bas_draft_reviewed_by_fk
  FOREIGN KEY (reviewed_by_user_id) REFERENCES user_account(id) ON DELETE SET NULL;

ALTER TABLE audit_event
  ADD CONSTRAINT audit_event_org_fk
  FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;

ALTER TABLE audit_event
  ADD CONSTRAINT audit_event_actor_fk
  FOREIGN KEY (actor_user_id) REFERENCES user_account(id) ON DELETE SET NULL;

ALTER TABLE secret_blob
  ADD CONSTRAINT secret_blob_org_fk
  FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;

GRANT USAGE ON SCHEMA public TO app_read, app_write;
GRANT SELECT ON TABLE org, user_account, bank_line, gst_txn, paygw_txn, bas_draft, audit_event, secret_blob TO app_read;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE org, user_account, bank_line, gst_txn, paygw_txn, bas_draft, audit_event, secret_blob TO app_write;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO app_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_write;

ALTER TABLE org ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_txn ENABLE ROW LEVEL SECURITY;
ALTER TABLE paygw_txn ENABLE ROW LEVEL SECURITY;
ALTER TABLE bas_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_blob ENABLE ROW LEVEL SECURITY;

ALTER TABLE org FORCE ROW LEVEL SECURITY;
ALTER TABLE user_account FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_line FORCE ROW LEVEL SECURITY;
ALTER TABLE gst_txn FORCE ROW LEVEL SECURITY;
ALTER TABLE paygw_txn FORCE ROW LEVEL SECURITY;
ALTER TABLE bas_draft FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;
ALTER TABLE secret_blob FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON org
  USING (id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY user_account_isolation ON user_account
  USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY bank_line_isolation ON bank_line
  USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY gst_txn_isolation ON gst_txn
  USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY paygw_txn_isolation ON paygw_txn
  USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY bas_draft_isolation ON bas_draft
  USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY audit_event_isolation ON audit_event
  USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY secret_blob_isolation ON secret_blob
  USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);
