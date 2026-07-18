-- Optional demo data. Run after 0000_init.sql if you want something to test against immediately.

INSERT INTO tenants (name, slug, industry, country, ai_personality, status)
VALUES (
  'Naha Fresh Grocer',
  'naha-fresh',
  'grocery',
  'ZA',
  '{"preset":"friendly"}',
  'sandbox'
);

INSERT INTO products (tenant_id, sku, name, category, price, currency, source)
SELECT id, 'BRD-001', 'White Bread 700g', 'Bakery', 24.99, 'ZAR', 'csv' FROM tenants WHERE slug = 'naha-fresh'
UNION ALL
SELECT id, 'MLK-001', 'Full Cream Milk 2L', 'Dairy', 34.99, 'ZAR', 'csv' FROM tenants WHERE slug = 'naha-fresh'
UNION ALL
SELECT id, 'EGG-001', 'Large Eggs 18s', 'Dairy', 54.99, 'ZAR', 'csv' FROM tenants WHERE slug = 'naha-fresh'
UNION ALL
SELECT id, 'CER-001', 'Corn Flakes 500g', 'Breakfast', 44.99, 'ZAR', 'csv' FROM tenants WHERE slug = 'naha-fresh';

INSERT INTO inventory (tenant_id, product_id, quantity, in_stock)
SELECT p.tenant_id, p.id, 50, true FROM products p
JOIN tenants t ON t.id = p.tenant_id WHERE t.slug = 'naha-fresh';
