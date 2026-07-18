-- Wires Thabiso's live Evolution API instance to the demo tenant (naha-fresh).
-- Run in Neon SQL Editor after 0000_init.sql and 0001_seed_demo.sql.
-- NOTE: the instance API key is stored here for demo/dev convenience only.
-- Before production go-live, encrypt this column at the application layer
-- (Architecture Standard §8 — secrets never stored in plaintext) rather than
-- writing it raw via SQL.

INSERT INTO integrations (tenant_id, provider, status, credentials)
SELECT
  id,
  'evolution',
  'connected',
  jsonb_build_object(
    'instanceName', '6A68F444A703-4578-9BFE-00F24135545A',
    'apiUrl', 'https://smartcart-my-evolution-api.onrender.com',
    'apiKey', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
  )
FROM tenants
WHERE slug = 'naha-fresh';
