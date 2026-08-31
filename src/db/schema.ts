import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─────────────────────────────────────────────────────────────────────────────
// Commerce types (no longer Drizzle tables).
//
// Products, variants, images, carts, and orders moved to MedusaJS. These types
// are the UI/AI contract: the product/cart adapters (src/lib/commerce/*) map
// Medusa's shapes back to them, and components import them from here. They were
// previously inferred from Drizzle tables; now they're plain interfaces with the
// same fields, so the rest of the app is unchanged. All amounts are in cents.
// ─────────────────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number; // cents
  imageUrl: string;
  category: string;
  featured: boolean | null;
  material: string | null;
  features: string | null; // JSON array as string
  createdAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
  imageUrl: string | null;
  sku: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  variantId: string;
  url: string;
  position: number;
  alt: string | null;
  createdAt: Date;
}

export interface Cart {
  id: string;
  userId: string | null;
  sessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceAtAdd: number; // cents
}

export interface Order {
  id: string;
  status: string;
  totalAmount: number; // minor units
  currency: string;
  customerEmail: string | null;
}

// Maps a storefront session to its MedusaJS cart id. The cart itself (line
// items, totals, inventory reservations) lives in Medusa; this table is just
// the pointer so the demo can find the same cart across requests without
// cookies (matching the fixed DEMO_SESSION model). Replaces the old
// carts/cartItems tables, which are gone.
export const medusaCarts = sqliteTable("medusa_carts", {
  sessionId: text("session_id").primaryKey(),
  medusaCartId: text("medusa_cart_id").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// User preferences table
export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  preferences: text("preferences").notNull(), // JSON stringified preferences
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Custom designs table for AI-generated hoodies
export const customDesigns = sqliteTable("custom_designs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  type: text("type", { enum: ["image", "text"] }).notNull(),
  originalInput: text("original_input").notNull(), // Image URL or text description
  generatedImageUrl: text("generated_image_url").notNull(),
  prompt: text("prompt").notNull(), // Gemini prompt used
  baseColor: text("base_color").default("Black"),
  refinementHistory: text("refinement_history"), // JSON array of refinements
  status: text("status", {
    enum: ["generating", "ready", "in_cart", "ordered"]
  }).default("generating"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Safety events from the AI chat — every time guardrails flag input
// (prompt injection, moderation hit, rate-limit, prompt leak) we log
// here for audit. Write-only at runtime; nothing in the app reads it.
export const chatSafetyEvents = sqliteTable("chat_safety_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  /** "injection" | "moderation" | "leak" | "blocked-recommendation" */
  kind: text("kind").notNull(),
  /** JSON array of pattern labels / category names that triggered. */
  reasons: text("reasons").notNull(),
  /** First 1000 chars of the offending message. */
  excerpt: text("excerpt").notNull(),
  /** True if the request was rejected, false if we let it through anyway. */
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Chat messages table for conversation history
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  products: text("products"), // JSON array of product IDs shown with this message
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// A2A task state.
//
// The protocol assumes an agent remembers its own tasks between requests, and
// on a platform that answers each request from whichever process is free, an
// in-memory store does not. This is that memory: one row per task, scoped the
// way the SDK scopes it (tenant, then owner), with the task itself stored as
// the JSON the SDK already serialises.
export const a2aTasks = sqliteTable("a2a_tasks", {
  id: text("id").primaryKey(),
  /** Which of the three agents owns it — tasks are never shared across them. */
  agent: text("agent").notNull(),
  /** `${tenant}::${owner}`, matching the SDK's own scoping. */
  scope: text("scope").notNull(),
  /** Groups the tasks of one conversation, for `ListTasks`. */
  contextId: text("context_id").notNull(),
  /** Task state as the proto enum name, e.g. TASK_STATE_INPUT_REQUIRED. */
  state: text("state").notNull(),
  /** The serialised Task. Read back whole; never queried into. */
  payload: text("payload").notNull(),
  /** Status timestamp, for the SDK's statusTimestampAfter filter. */
  statusAt: text("status_at"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type exports
// Commerce types (Product/ProductVariant/ProductImage/Cart/CartItem/Order) are
// defined as interfaces at the top of this file — they moved off Drizzle to
// Medusa. The types below are inferred from the remaining (non-commerce) tables.
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
export type CustomDesign = typeof customDesigns.$inferSelect;
export type NewCustomDesign = typeof customDesigns.$inferInsert;
export type ChatSafetyEvent = typeof chatSafetyEvents.$inferSelect;
export type NewChatSafetyEvent = typeof chatSafetyEvents.$inferInsert;
export type MedusaCartRef = typeof medusaCarts.$inferSelect;
export type NewMedusaCartRef = typeof medusaCarts.$inferInsert;
