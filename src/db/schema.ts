import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Products table
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier (e.g., "classic-comfort-hoodie")
  description: text("description").notNull(),
  basePrice: integer("base_price").notNull(), // in cents
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(),
  featured: integer("featured", { mode: "boolean" }).default(false),
  material: text("material"),
  features: text("features"), // JSON array as string
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Extra product images (lifestyle, back, detail). The main hero shot stays
// on products.imageUrl; this table holds the *additional* angles that the
// PDP carousel + Google Shopping additional_image_link fields consume.
export const productImages = sqliteTable("product_images", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  /** 0-based render order in the carousel. */
  position: integer("position").notNull().default(0),
  /** Short prompt-derived caption (e.g. "back view", "fabric close-up"). */
  alt: text("alt"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Product variants table (color + size combinations)
export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  color: text("color").notNull(),
  colorHex: text("color_hex").notNull(),
  size: text("size").notNull(),
  stock: integer("stock").notNull().default(100),
  imageUrl: text("image_url"), // Color-specific product image
  sku: text("sku").notNull().unique(),
});

// Shopping carts table
export const carts = sqliteTable("carts", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  sessionId: text("session_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Cart items table
export const cartItems = sqliteTable("cart_items", {
  id: text("id").primaryKey(),
  cartId: text("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  variantId: text("variant_id")
    .notNull()
    .references(() => productVariants.id),
  quantity: integer("quantity").notNull().default(1),
  priceAtAdd: integer("price_at_add").notNull(), // in cents
});

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

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

// Kustom Checkout orders table — synced from Kustom via push webhook
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  kustomOrderId: text("kustom_order_id").notNull().unique(),
  status: text("status").notNull(),
  totalAmount: integer("total_amount").notNull(), // minor units (öre)
  currency: text("currency").notNull(),
  customerEmail: text("customer_email"),
  sessionId: text("session_id"),
  snapshotJson: text("snapshot_json").notNull(), // full Order Management response
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
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

// Type exports
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
export type CustomDesign = typeof customDesigns.$inferSelect;
export type NewCustomDesign = typeof customDesigns.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
