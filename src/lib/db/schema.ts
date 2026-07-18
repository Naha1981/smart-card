/**
 * SmartCart canonical schema (Architecture Standard §6).
 * Every business table carries tenant_id — enforced again at the query-helper
 * layer in `tenant-scope.ts`. Raw unscoped access to these tables from
 * application code is disallowed by convention (and lint rule, see eslint config).
 */
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  integer,
  numeric,
  vector,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ── Tenancy ──────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  industry: varchar("industry", { length: 32 }).notNull().default("grocery"), // grocery | pharmacy | hardware | fashion | electronics
  country: varchar("country", { length: 2 }).notNull().default("ZA"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Africa/Johannesburg"),
  branding: jsonb("branding").$type<{ logoUrl?: string; primaryColor?: string; secondaryColor?: string }>().default({}),
  aiPersonality: jsonb("ai_personality").$type<{
    preset: "professional" | "friendly" | "luxury" | "family" | "youth" | "local_vernacular" | "custom";
    customInstructions?: string;
    guardrails?: string[];
  }>().default({ preset: "friendly" }),
  plan: varchar("plan", { length: 16 }).notNull().default("sme"), // sme | growth | enterprise
  status: varchar("status", { length: 16 }).notNull().default("sandbox"), // sandbox | live | suspended
  ...timestamps,
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 32 }).notNull(), // owner | admin | analyst | agent
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("agent"), // owner | admin | analyst | agent
    ...timestamps,
  },
  (t) => ({
    tenantUserIdx: index("memberships_tenant_user_idx").on(t.tenantId, t.userId),
  })
);

// ── Catalog ──────────────────────────────────────────────────
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 128 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("ZAR"),
    imageUrl: text("image_url"),
    nutrition: jsonb("nutrition"),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().default({}),
    source: varchar("source", { length: 32 }).notNull().default("csv"), // csv | shopify | woocommerce | rest
    embedding: vector("embedding", { dimensions: 1536 }),
    ...timestamps,
  },
  (t) => ({
    tenantSkuIdx: index("products_tenant_sku_idx").on(t.tenantId, t.sku),
  })
);

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    storeId: uuid("store_id"),
    quantity: integer("quantity").notNull().default(0),
    inStock: boolean("in_stock").notNull().default(true),
    ...timestamps,
  },
  (t) => ({ tenantProductIdx: index("inventory_tenant_product_idx").on(t.tenantId, t.productId) })
);

export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  discountType: varchar("discount_type", { length: 16 }).notNull(), // percent | fixed | bogo
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// ── Customers, conversations, chat ──────────────────────────
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    whatsappNumberHash: varchar("whatsapp_number_hash", { length: 128 }),
    email: text("email"),
    name: text("name"),
    loyaltyBalance: numeric("loyalty_balance", { precision: 12, scale: 2 }).notNull().default("0"),
    preferences: jsonb("preferences").$type<{ dietary?: string[]; favoriteStoreId?: string }>().default({}),
    ...timestamps,
  },
  (t) => ({ tenantWaIdx: index("customers_tenant_wa_idx").on(t.tenantId, t.whatsappNumberHash) })
);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  channel: varchar("channel", { length: 16 }).notNull(), // whatsapp | web | mobile | voice
  status: varchar("status", { length: 16 }).notNull().default("open"), // open | escalated | closed
  ...timestamps,
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(), // user | assistant | system | tool
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ convIdx: index("messages_conversation_idx").on(t.conversationId) })
);

// ── Commerce ─────────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | paid | fulfilled | cancelled
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("ZAR"),
    aiInfluenced: boolean("ai_influenced").notNull().default(false),
    attributionType: varchar("attribution_type", { length: 32 }), // ai_built_basket | ai_recommended | ai_recovered_cart
    paymentProvider: varchar("payment_provider", { length: 16 }), // payfast | yoco | stripe
    paymentRef: text("payment_ref"),
    ...timestamps,
  },
  (t) => ({ tenantStatusIdx: index("orders_tenant_status_idx").on(t.tenantId, t.status) })
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
});

// ── Documents / RAG ──────────────────────────────────────────
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  ...timestamps,
});

export const aiMemory = pgTable("ai_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 128 }).notNull(),
  value: jsonb("value").notNull(),
  consented: boolean("consented").notNull().default(true),
  ...timestamps,
});

// ── Notifications, integrations, settings ────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("queued"),
  payload: jsonb("payload"),
  ...timestamps,
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).notNull(), // shopify | woocommerce | evolution | payfast | yoco
  status: varchar("status", { length: 16 }).notNull().default("disconnected"),
  credentials: jsonb("credentials"), // encrypted at the app layer before write
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
});

export const settings = pgTable("settings", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 128 }).notNull(),
  value: jsonb("value").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.tenantId, t.key] }) }));

// ── Events & audit (the extraction seam, §6 / §11) ───────────
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(), // MessageReceived | CartBuilt | OrderPlaced | PaymentConfirmed | ...
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantTypeIdx: index("events_tenant_type_idx").on(t.tenantId, t.type) })
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
