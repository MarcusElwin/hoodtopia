# Hoodtopia - Agentic Commerce Demo Implementation Plan

> An AI-powered e-commerce demo for the LangChain Stockholm Meetup showcasing AI in E-commerce, Agentic Commerce, and Generative UX.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Phases](#implementation-phases)
5. [Database Schema](#database-schema)
6. [AI Integration Design](#ai-integration-design)
7. [Component Architecture](#component-architecture)
8. [API Routes](#api-routes)
9. [Testing Strategy](#testing-strategy)
10. [File Structure](#file-structure)
11. [Implementation Checklist](#implementation-checklist)

---

## Project Overview

**Hoodtopia** is a demo e-commerce application selling hoodies that demonstrates three key concepts:

1. **AI in E-commerce** - LLM-powered shopping assistance
2. **Agentic Commerce** - Proactive AI agents guiding the shopping experience
3. **Generative UX** - Dynamic, personalized UI that adapts in real-time

### Success Metrics

- ✅ Users can browse products and add to cart
- ✅ AI chat responds appropriately to product questions
- ✅ AI recommendations return 1-3 relevant products with reasoning
- ✅ Generative product cards show different results for different queries
- ✅ All TypeScript compiles without errors
- ✅ All tests pass
- ✅ Mobile responsive
- ✅ Documentation is comprehensive
- ✅ Demo is impressive and easy to present

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router + Turbopack |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | UI component library |
| **Lucide React** | Icon library |
| **streamdown** | Markdown rendering for AI responses |

### Backend
| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | Server endpoints |
| **tRPC** | End-to-end typesafe APIs |
| **Drizzle ORM** | Type-safe database queries |
| **SQLite/Turso** | Database (simple setup for demo) |
| **Zod** | Schema validation |

### AI/LLM
| Technology | Purpose |
|------------|---------|
| **OpenAI GPT-5.1 Responses API** | AI chat, recommendations, search |
| **Zod + zodResponseFormat** | Type-safe structured outputs |
| **Google Gemini 2.5 Flash / Gemini 3 Pro** | AI-generated product images |
| **LangChain** | LLM orchestration (optional, for meetup relevance) |

### Testing & DevOps
| Technology | Purpose |
|------------|---------|
| **Vitest** | Unit testing |
| **Playwright** | E2E testing (optional) |
| **ESLint + Prettier** | Code quality |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Homepage   │  │   Products   │  │   Product Detail     │  │
│  │   - Hero     │  │   - Browse   │  │   - Variants         │  │
│  │   - Featured │  │   - AI Recs  │  │   - Add to Cart      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │     Cart     │  │   AI Chat    │  │  Generative Cards    │  │
│  │   - Items    │  │   - Dialog   │  │   - Confidence       │  │
│  │   - Summary  │  │   - History  │  │   - Reasoning        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      tRPC API LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   products   │  │    cart      │  │        ai            │  │
│  │   .list()    │  │   .get()     │  │   .chat()            │  │
│  │   .byId()    │  │   .addItem() │  │   .recommend()       │  │
│  │   .search()  │  │   .update()  │  │   .search()          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI SERVICE LAYER                            │
│  ┌────────────────────────────┐  ┌───────────────────────────┐  │
│  │   OpenAI GPT-5.1           │  │   Google Gemini           │  │
│  │   (Responses API)          │  │   (Image Generation)      │  │
│  │  - Chat assistance         │  │  - gemini-2.5-flash-preview-05-20 │
│  │  - Recommendations         │  │  - or gemini-3-pro (when available) │
│  │  - Zod structured outputs  │  │  - AI-generated assets    │  │
│  └────────────────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE (SQLite)                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │  products  │  │  variants  │  │   carts    │  │cartItems │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Project Setup & Foundation (30 min)

#### 1.1 Initialize Next.js Project
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

#### 1.2 Install Dependencies
```bash
# Core
npm install @trpc/server @trpc/client @trpc/react-query @trpc/next @tanstack/react-query
npm install drizzle-orm better-sqlite3 zod
npm install -D drizzle-kit @types/better-sqlite3

# UI
npx shadcn@latest init
npx shadcn@latest add button card input dialog tabs badge skeleton scroll-area select

# AI
npm install openai zod-to-json-schema
npm install @google/genai  # Gemini for image generation (new SDK)
npm install langchain @langchain/openai  # Optional for meetup relevance

# Utils
npm install lucide-react clsx tailwind-merge
npm install -D vitest @testing-library/react
```

#### 1.3 Configure Environment
Create `.env.example`:
```env
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...         # For Gemini 2.5 Pro image generation
DATABASE_URL=./db/hoodtopia.db
```

#### 1.4 Setup Drizzle Config
Create `drizzle.config.ts` for database migrations.

---

### Phase 2: Database Schema & Seeding (45 min)

#### 2.1 Define Schema

**File: `src/db/schema.ts`**

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  basePrice: integer("base_price").notNull(), // in cents
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(),
  featured: integer("featured", { mode: "boolean" }).default(false),
  material: text("material"),
  features: text("features"), // JSON array as string
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id),
  color: text("color").notNull(),
  colorHex: text("color_hex").notNull(),
  size: text("size").notNull(),
  stock: integer("stock").notNull().default(100),
  imageUrl: text("image_url"),
  sku: text("sku").notNull(),
});

export const carts = sqliteTable("carts", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  sessionId: text("session_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const cartItems = sqliteTable("cart_items", {
  id: text("id").primaryKey(),
  cartId: text("cart_id").notNull().references(() => carts.id),
  productId: text("product_id").notNull().references(() => products.id),
  variantId: text("variant_id").notNull().references(() => productVariants.id),
  quantity: integer("quantity").notNull().default(1),
  priceAtAdd: integer("price_at_add").notNull(), // in cents
});
```

#### 2.2 Seed Data

**6 Products with Rich Descriptions:**

| Product | Base Price | Category | Key Features |
|---------|-----------|----------|--------------|
| **Classic Comfort Hoodie** | $59.99 | casual | Soft cotton blend, everyday wear, relaxed fit |
| **Tech Fleece Pro** | $89.99 | performance | Moisture-wicking, thermal regulation, athletic fit |
| **Athletic Performance Hoodie** | $79.99 | athletic | Breathable, lightweight, reflective details |
| **Oversized Street Hoodie** | $69.99 | streetwear | Dropped shoulders, urban style, bold colors |
| **Premium Zip-Up** | $99.99 | premium | Full zip, premium materials, minimalist design |
| **Heavyweight Winter Hoodie** | $109.99 | outdoor | Extra warm, wind-resistant, fleece lined |

**Variant Generation:**
- Colors: 8 options (Black, Navy, Heather Gray, Forest Green, Burgundy, Royal Blue, Charcoal, Cream)
- Sizes: 6 options (XS, S, M, L, XL, XXL)
- **Total variants: 6 products × 8 colors × 6 sizes = 288 variants**

#### 2.3 AI-Generated Product Images (Gemini 2.5 Flash / Gemini 3 Pro)

**File: `src/scripts/generate-images.ts`**

Use Google Gemini with native image generation to create consistent product images:

```typescript
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

// Model options (use whichever is available):
// - "gemini-2.5-flash-preview-05-20" (current, supports image gen)
// - "gemini-3-pro" (when released)
const IMAGE_MODEL = "gemini-2.5-flash-preview-05-20";

interface ProductImageConfig {
  productName: string;
  style: string;
  color: string;
  colorHex: string;
}

async function generateProductImage(config: ProductImageConfig): Promise<string> {
  const prompt = `
    Professional e-commerce product photo of a ${config.style} hoodie.
    Color: ${config.color} (${config.colorHex})
    Style: ${config.productName}
    Background: Clean, minimal, gradient gray studio background
    Lighting: Soft, professional product photography lighting
    Angle: Front view, slightly angled, flatlay or on invisible mannequin
    Quality: High-resolution, sharp details, fabric texture visible
    No people, no faces, just the hoodie product shot.
  `;

  // Generate image using Gemini's native image generation
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  // Extract image data from response
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      const imageData = part.inlineData.data; // base64 encoded
      const mimeType = part.inlineData.mimeType; // e.g., "image/png"

      // Save to file
      const filename = `${config.productName.toLowerCase().replace(/ /g, '-')}-${config.color.toLowerCase()}.png`;
      const filepath = `public/images/products/${filename}`;

      await fs.writeFile(filepath, Buffer.from(imageData, 'base64'));
      return `/images/products/${filename}`;
    }
  }

  throw new Error("No image generated");
}

// Generate images for all product/color combinations
async function generateAllProductImages() {
  const products = [
    { name: "Classic Comfort Hoodie", style: "relaxed fit cotton blend pullover" },
    { name: "Tech Fleece Pro", style: "athletic technical fleece performance" },
    { name: "Athletic Performance Hoodie", style: "lightweight breathable sport" },
    { name: "Oversized Street Hoodie", style: "oversized urban streetwear" },
    { name: "Premium Zip-Up", style: "minimalist premium full-zip" },
    { name: "Heavyweight Winter Hoodie", style: "thick insulated winter outdoor" },
  ];

  const colors = [
    { name: "Black", hex: "#000000" },
    { name: "Navy", hex: "#1e3a5f" },
    { name: "Heather Gray", hex: "#9ca3af" },
    { name: "Forest Green", hex: "#166534" },
    { name: "Burgundy", hex: "#7f1d1d" },
    { name: "Royal Blue", hex: "#1d4ed8" },
    { name: "Charcoal", hex: "#374151" },
    { name: "Cream", hex: "#fef3c7" },
  ];

  for (const product of products) {
    for (const color of colors) {
      console.log(`Generating: ${product.name} in ${color.name}...`);
      await generateProductImage({
        productName: product.name,
        style: product.style,
        color: color.name,
        colorHex: color.hex,
      });
      // Rate limiting - pause between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
```

**Image Generation Strategy:**
- Generate 6 base product images (one per product in a neutral color)
- Generate 8 color variants per product = **48 total images**
- Store in `public/images/products/{product-slug}/{color}.png`
- Use consistent prompts for visual coherence across the catalog

---

### Phase 3: tRPC API Layer (45 min)

#### 3.1 tRPC Setup

**File: `src/server/trpc.ts`**
- Initialize tRPC context
- Create router factory
- Setup error handling

#### 3.2 Product Router

**File: `src/server/routers/products.ts`**

```typescript
export const productsRouter = router({
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      featured: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Return products with their variants
    }),

  byId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      // Return single product with all variants
    }),

  search: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      // Basic text search on name/description
    }),

  featured: publicProcedure
    .query(async ({ ctx }) => {
      // Return featured products for homepage
    }),
});
```

#### 3.3 Cart Router

**File: `src/server/routers/cart.ts`**

```typescript
export const cartRouter = router({
  get: publicProcedure
    .query(async ({ ctx }) => {
      // Get or create cart for session
    }),

  addItem: publicProcedure
    .input(z.object({
      productId: z.string(),
      variantId: z.string(),
      quantity: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Add item to cart
    }),

  updateQuantity: publicProcedure
    .input(z.object({
      itemId: z.string(),
      quantity: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // Update or remove if quantity is 0
    }),

  removeItem: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      // Remove item from cart
    }),

  clear: publicProcedure
    .mutation(async ({ ctx }) => {
      // Clear all items from cart
    }),
});
```

#### 3.4 AI Router

**File: `src/server/routers/ai.ts`**

```typescript
export const aiRouter = router({
  chat: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Chat with AI assistant
    }),

  recommend: publicProcedure
    .input(z.string()) // User preferences as natural language
    .mutation(async ({ ctx, input }) => {
      // Get structured recommendations
    }),

  search: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      // AI-powered semantic search
    }),
});
```

---

### Phase 4: AI Service Implementation (45 min)

#### 4.1 Core AI Service with GPT-5.1 Responses API + Zod

**File: `src/services/ai.ts`**

```typescript
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI();

// ============================================
// ZOD SCHEMAS FOR STRUCTURED OUTPUTS
// ============================================

// Recommendation schema - used for AI product recommendations
const RecommendationSchema = z.object({
  recommendations: z.array(z.object({
    productName: z.string().describe("Exact product name from catalog"),
    reason: z.string().describe("Why this product matches the user's needs"),
    confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
    highlightedFeatures: z.array(z.string()).describe("Key features that match"),
  })).min(1).max(3),
  followUpQuestions: z.array(z.string()).optional().describe("Questions to refine recommendations"),
});

// Search results schema
const SearchResultsSchema = z.object({
  productNames: z.array(z.string()).describe("Matching product names from catalog"),
  isRelevant: z.boolean().describe("Whether the query is relevant to hoodies"),
  searchIntent: z.string().optional().describe("Interpreted user intent"),
});

// Chat response schema (for structured chat when needed)
const ChatResponseSchema = z.object({
  message: z.string().describe("The assistant's response"),
  suggestedProducts: z.array(z.string()).optional().describe("Products mentioned"),
  shouldShowProducts: z.boolean().describe("Whether to display product cards"),
});

// Type exports from Zod schemas
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type SearchResults = z.infer<typeof SearchResultsSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// Build system prompt with product catalog
function buildSystemPrompt(products: Product[]): string {
  return `You are a helpful AI shopping assistant for Hoodtopia, an online hoodie store.

Your personality:
- Friendly and knowledgeable about hoodies and fashion
- Helpful but not pushy
- You explain WHY products fit the customer's needs

Available Products:
${products.map(p => `
**${p.name}** ($${(p.basePrice / 100).toFixed(2)})
- Category: ${p.category}
- ${p.description}
- Features: ${p.features}
- Available colors: ${getProductColors(p.id).join(", ")}
`).join("\n")}

Rules:
1. ONLY recommend products from the list above
2. Always explain why a product fits the customer's needs
3. If asked about products not in our catalog, politely say we don't carry them
4. For sizing questions, ask about their usual fit preference (relaxed, fitted, etc.)
5. Mention specific features that match their requirements`;
}
```

#### 4.2 Three Core AI Functions (GPT-5.1 Responses API)

**Function 1: Conversational Chat**
```typescript
export async function chatWithAssistant(
  messages: Message[],
  products: Product[]
): Promise<string> {
  // Using GPT-5.1 Responses API for chat
  const response = await openai.responses.create({
    model: "gpt-5.1",
    input: [
      { role: "system", content: buildSystemPrompt(products) },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.7,
    max_output_tokens: 500,
  });

  return response.output_text;
}
```

**Function 2: Structured Recommendations (Zod + zodResponseFormat)**
```typescript
export async function getProductRecommendations(
  preferences: string,
  products: Product[]
): Promise<z.infer<typeof RecommendationSchema>> {
  // Using GPT-5.1 Responses API with Zod structured output
  const response = await openai.responses.parse({
    model: "gpt-5.1",
    input: [
      {
        role: "system",
        content: `You are a product recommendation engine for Hoodtopia.

Available products: ${JSON.stringify(products.map(p => ({
  name: p.name,
  price: p.basePrice,
  category: p.category,
  description: p.description,
  features: p.features,
})))}

Analyze the user's preferences and return 1-3 product recommendations.
Only recommend products from the available list.
Match product names EXACTLY as they appear in the list.`,
      },
      { role: "user", content: preferences },
    ],
    // Zod schema automatically converted to JSON schema
    text: {
      format: zodResponseFormat(RecommendationSchema, "product_recommendations"),
    },
  });

  // Type-safe parsed result thanks to Zod
  const result = response.output_parsed;

  if (!result) {
    throw new Error("Failed to parse AI response");
  }

  // Match AI product names to actual database products
  return {
    ...result,
    recommendations: result.recommendations.map(rec => ({
      ...rec,
      product: products.find(p =>
        p.name.toLowerCase() === rec.productName.toLowerCase()
      ),
    })).filter(rec => rec.product), // Filter out any hallucinated products
  };
}
```

**Function 3: AI-Powered Search (Zod + zodResponseFormat)**
```typescript
export async function searchProductsWithAI(
  query: string,
  products: Product[]
): Promise<Product[]> {
  // Using GPT-5.1 Responses API with Zod structured output
  const response = await openai.responses.parse({
    model: "gpt-5.1",
    input: [
      {
        role: "system",
        content: `You are a search engine for Hoodtopia hoodie store.

Available products: ${products.map(p => p.name).join(", ")}

Given a search query, return the names of relevant products.
If the query is not related to hoodies or our products, return an empty array.
Return ONLY exact product names from the list.`,
      },
      { role: "user", content: query },
    ],
    text: {
      format: zodResponseFormat(SearchResultsSchema, "search_results"),
    },
  });

  const result = response.output_parsed;

  if (!result || !result.isRelevant) {
    return [];
  }

  // Type-safe filtering with exact product matches
  return products.filter(p =>
    result.productNames.some(name =>
      name.toLowerCase() === p.name.toLowerCase()
    )
  );
}
```

#### 4.3 Error Handling & Fallbacks

```typescript
import { z } from "zod";

// Wrapper for safe AI calls with fallback
export async function safeAICall<T>(
  aiFunction: () => Promise<T>,
  fallback: T,
  errorMessage: string
): Promise<T> {
  try {
    return await aiFunction();
  } catch (error) {
    console.error(errorMessage, error);

    // Check for specific error types
    if (error instanceof z.ZodError) {
      console.error("Zod validation failed:", error.errors);
    }

    return fallback;
  }
}

// Usage example
const recommendations = await safeAICall(
  () => getProductRecommendations(preferences, products),
  { recommendations: [], followUpQuestions: [] },
  "Failed to get AI recommendations"
);
```

#### 4.4 Why GPT-5.1 Responses API + Zod?

| Feature | Benefit |
|---------|---------|
| **Responses API** | Simpler interface than Chat Completions for agentic use |
| **`responses.parse()`** | Built-in structured output parsing |
| **`zodResponseFormat()`** | Type-safe schema definition with Zod |
| **Automatic validation** | Zod validates the response at runtime |
| **TypeScript inference** | Full type safety from schema to response |
| **Refusal handling** | Built-in `.refusal` property for safety |

---

### Phase 5: Frontend Components (60 min)

#### 5.1 Layout Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `RootLayout` | `src/app/layout.tsx` | App shell, providers |
| `Header` | `src/components/layout/header.tsx` | Navigation, cart icon |
| `Footer` | `src/components/layout/footer.tsx` | Links, branding |

#### 5.2 Homepage Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `HeroSection` | `src/components/home/hero.tsx` | Main CTA with AI badge |
| `FeaturedProducts` | `src/components/home/featured.tsx` | Product grid |
| `AIBadge` | `src/components/ui/ai-badge.tsx` | "AI-Powered" indicator |

#### 5.3 Product Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `ProductCard` | `product, variant?` | Standard product display |
| `GenerativeProductCard` | `product, reason?, confidence?, layout?` | AI-enhanced card |
| `ProductGrid` | `products, layout?` | Responsive grid |
| `VariantSelector` | `variants, selected, onChange` | Color/size picker |
| `ConfidenceIndicator` | `confidence` | Visual score (0-100%) |

**GenerativeProductCard Implementation:**
```typescript
interface GenerativeProductCardProps {
  product: Product;
  reason?: string;           // AI-generated explanation
  confidence?: number;       // 0-1 score
  highlightedFeatures?: string[];
  layout?: "compact" | "detailed" | "minimal";
}

function GenerativeProductCard({
  product,
  reason,
  confidence,
  highlightedFeatures,
  layout = "detailed",
}: GenerativeProductCardProps) {
  return (
    <Card className={cn(
      "group relative overflow-hidden",
      layout === "compact" && "flex-row h-32",
      layout === "minimal" && "border-0 shadow-none",
    )}>
      {confidence !== undefined && (
        <ConfidenceIndicator confidence={confidence} />
      )}

      <ProductImage product={product} />

      <CardContent>
        <h3>{product.name}</h3>
        <p className="text-muted-foreground">${product.basePrice / 100}</p>

        {reason && (
          <div className="mt-2 p-2 bg-purple-500/10 rounded-md">
            <p className="text-sm text-purple-300">
              <Sparkles className="w-4 h-4 inline mr-1" />
              {reason}
            </p>
          </div>
        )}

        {highlightedFeatures && (
          <div className="flex flex-wrap gap-1 mt-2">
            {highlightedFeatures.map(feature => (
              <Badge key={feature} variant="secondary">{feature}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### 5.4 Cart Components

| Component | Purpose |
|-----------|---------|
| `CartSheet` | Slide-out cart panel |
| `CartItem` | Individual item with quantity controls |
| `CartSummary` | Total, checkout button |
| `QuantitySelector` | +/- buttons |

#### 5.5 AI Components

| Component | Purpose |
|-----------|---------|
| `AIChatDialog` | Modal chat interface |
| `ChatMessage` | Single message bubble |
| `ChatInput` | Message input with send button |
| `AIRecommendationPanel` | Preference input + results |
| `LoadingSpinner` | AI thinking indicator |

---

### Phase 6: Pages Implementation (30 min)

#### 6.1 Page Routes

```
src/app/
├── page.tsx                    # Homepage
├── products/
│   └── page.tsx               # Products browse + AI recs
├── products/[id]/
│   └── page.tsx               # Product detail
├── cart/
│   └── page.tsx               # Full cart page
└── api/
    └── trpc/[trpc]/route.ts   # tRPC handler
```

#### 6.2 Homepage (`/`)

```tsx
export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <FeaturedProducts />
      <AIChatButton /> {/* Floating button */}
    </main>
  );
}
```

**Hero Section Content:**
- Headline: "Find Your Perfect Hoodie"
- Subheadline: "AI-powered recommendations tailored to your style"
- CTA 1: "Browse Collection" → /products
- CTA 2: "Get AI Recommendations" → Opens chat
- Badge: "✨ AI-Powered Personalization"

#### 6.3 Products Page (`/products`)

```tsx
export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"browse" | "ai">("browse");

  return (
    <main>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse All</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="w-4 h-4 mr-1" />
            AI Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          <SearchInput />
          <ProductGrid products={products} />
        </TabsContent>

        <TabsContent value="ai">
          <AIRecommendationPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}
```

#### 6.4 Product Detail (`/products/[id]`)

```tsx
export default function ProductDetailPage({ params }) {
  return (
    <main>
      <div className="grid md:grid-cols-2 gap-8">
        <ProductImageGallery product={product} />

        <div>
          <h1>{product.name}</h1>
          <p className="text-2xl">${product.basePrice / 100}</p>
          <p>{product.description}</p>

          <VariantSelector
            variants={product.variants}
            selected={selectedVariant}
            onSelect={setSelectedVariant}
          />

          <QuantitySelector
            value={quantity}
            onChange={setQuantity}
          />

          <Button onClick={handleAddToCart}>
            Add to Cart
          </Button>
        </div>
      </div>
    </main>
  );
}
```

---

### Phase 7: Testing (30 min)

#### 7.1 AI Service Tests

**File: `src/services/__tests__/ai.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { chatWithAssistant, getProductRecommendations, searchProductsWithAI } from "../ai";

const mockProducts = [
  { id: "1", name: "Classic Comfort Hoodie", ... },
  { id: "2", name: "Tech Fleece Pro", ... },
];

describe("AI Assistant", () => {
  it("should respond to simple greetings", async () => {
    const response = await chatWithAssistant(
      [{ role: "user", content: "Hello!" }],
      mockProducts
    );
    expect(response).toBeTruthy();
    expect(typeof response).toBe("string");
  });

  it("should recommend products from catalog only", async () => {
    const response = await chatWithAssistant(
      [{ role: "user", content: "I need a warm winter hoodie" }],
      mockProducts
    );
    expect(response.toLowerCase()).toContain("hoodie");
  });

  it("should not hallucinate products", async () => {
    const response = await chatWithAssistant(
      [{ role: "user", content: "Do you have any t-shirts?" }],
      mockProducts
    );
    expect(response.toLowerCase()).not.toContain("yes we have");
  });
});

describe("AI Recommendations", () => {
  it("should return structured recommendations", async () => {
    const recs = await getProductRecommendations(
      "casual everyday wear",
      mockProducts
    );

    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it("should include valid product references", async () => {
    const recs = await getProductRecommendations(
      "athletic performance hoodie",
      mockProducts
    );

    recs.forEach(rec => {
      expect(rec.product).toBeTruthy();
      expect(rec.reason).toBeTruthy();
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    });
  });

  it("should match products to database entries", async () => {
    const recs = await getProductRecommendations(
      "warm outdoor hoodie",
      mockProducts
    );

    recs.forEach(rec => {
      const matchedProduct = mockProducts.find(p => p.id === rec.product.id);
      expect(matchedProduct).toBeTruthy();
    });
  });
});

describe("AI Search", () => {
  it("should return relevant products for valid queries", async () => {
    const results = await searchProductsWithAI("warm", mockProducts);
    expect(results.length).toBeGreaterThan(0);
  });

  it("should return empty for irrelevant queries", async () => {
    const results = await searchProductsWithAI("pizza recipes", mockProducts);
    expect(results.length).toBe(0);
  });
});
```

#### 7.2 Component Tests (Optional)

```typescript
describe("GenerativeProductCard", () => {
  it("renders product name and price", () => {
    render(<GenerativeProductCard product={mockProduct} />);
    expect(screen.getByText("Classic Comfort Hoodie")).toBeInTheDocument();
  });

  it("shows AI reasoning when provided", () => {
    render(
      <GenerativeProductCard
        product={mockProduct}
        reason="Perfect for everyday casual wear"
      />
    );
    expect(screen.getByText(/Perfect for everyday/)).toBeInTheDocument();
  });

  it("displays confidence indicator", () => {
    render(
      <GenerativeProductCard
        product={mockProduct}
        confidence={0.85}
      />
    );
    expect(screen.getByText("85%")).toBeInTheDocument();
  });
});
```

---

### Phase 8: Documentation (30 min)

#### 8.1 Files to Create

1. **README.md** (Update existing)
   - Project overview
   - Quick start guide
   - Architecture diagram
   - Tech stack

2. **docs/PRESENTATION_GUIDE.md**
   - Demo script with timing
   - Talking points
   - Example queries
   - Q&A preparation

3. **docs/DEMO_SCRIPT.md**
   - Step-by-step walkthrough
   - What to show on screen
   - Backup plans

---

## Database Schema

### ERD Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│      products       │       │   productVariants   │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │──┐    │ id (PK)             │
│ name                │  │    │ productId (FK)      │──┐
│ description         │  │    │ color               │  │
│ basePrice           │  │    │ colorHex            │  │
│ imageUrl            │  │    │ size                │  │
│ category            │  │    │ stock               │  │
│ featured            │  │    │ imageUrl            │  │
│ material            │  │    │ sku                 │  │
│ features            │  │    └─────────────────────┘  │
│ createdAt           │  │                             │
└─────────────────────┘  │                             │
                         │                             │
                         │    ┌─────────────────────┐  │
                         │    │       carts         │  │
                         │    ├─────────────────────┤  │
                         │    │ id (PK)             │  │
                         │    │ userId              │  │
                         │    │ sessionId           │  │
                         │    │ createdAt           │  │
                         │    │ updatedAt           │  │
                         │    └─────────────────────┘  │
                         │             │               │
                         │             ▼               │
                         │    ┌─────────────────────┐  │
                         │    │     cartItems       │  │
                         │    ├─────────────────────┤  │
                         └───▶│ productId (FK)      │  │
                              │ variantId (FK)      │◀─┘
                              │ cartId (FK)         │
                              │ id (PK)             │
                              │ quantity            │
                              │ priceAtAdd          │
                              └─────────────────────┘
```

### Seed Data Details

**Hoodie Products (6 items):**

| Name | Price | Category | Material | Key Features |
|------|-------|----------|----------|--------------|
| Classic Comfort Hoodie | $59.99 | casual | 80% cotton, 20% polyester | Soft inner lining, Ribbed cuffs, Kangaroo pocket |
| Tech Fleece Pro | $89.99 | performance | Technical fleece blend | Moisture-wicking, Temperature regulation, Thumbholes |
| Athletic Performance Hoodie | $79.99 | athletic | Lightweight polyester | Breathable mesh panels, Reflective details, Quick-dry |
| Oversized Street Hoodie | $69.99 | streetwear | 100% cotton | Dropped shoulders, Extended length, Bold graphics |
| Premium Zip-Up | $99.99 | premium | Premium cotton blend | YKK zipper, Two side pockets, Minimalist design |
| Heavyweight Winter Hoodie | $109.99 | outdoor | Double-layered fleece | Wind-resistant, Extra thick, Adjustable hood |

**Accessory Products (13 items):**

| Name | Price | Category | Material | Key Features |
|------|-------|----------|----------|--------------|
| Hoodtopia Logo Sticker Pack | $9.99 | stickers | Premium waterproof vinyl | 5 unique designs, Waterproof, UV resistant |
| Holographic Hoodie Stickers | $12.99 | stickers | Holographic vinyl | 3 holographic designs, Rainbow shimmer |
| Enamel Pin Set | $19.99 | pins | Hard enamel, gold plating | 3 unique pins, Butterfly clutch backs |
| Hoodie Love Pin | $8.99 | pins | Soft enamel, silver plating | Heart-hoodie design, Rubber clutch |
| Iron-On Patch Collection | $14.99 | patches | Embroidered twill | 4 patches, Iron-on or sew-on |
| Chenille Letter Patch | $12.99 | patches | Chenille with felt backing | Varsity 'H' design, Sew-on |
| Mini Hoodie Keychain | $14.99 | accessories | Soft plush, metal clasp | 3-inch mini hoodie, Squeezable |
| Cozy Club Socks | $16.99 | apparel | 80% cotton blend | Hoodie pattern, Cushioned footbed |
| Rainbow Drawstring Set | $11.99 | accessories | Braided cotton, metal aglets | 4 colors included, Universal length |
| Hoodtopia Canvas Tote | $24.99 | bags | 12oz organic cotton canvas | 15x16 inch, Screen-printed design |
| Hoodie Care Kit | $19.99 | care | Various | Spray, lint roller, cloth, pouch |
| Glow-in-Dark Pin | $10.99 | pins | Hard enamel, glow pigment | Glows in the dark, Hoodie silhouette |
| Hoodie Shaped Mug | $21.99 | home | Ceramic, food-safe glaze | 14oz, Sleeve handle, Pocket detail |

**Colors (8 options for hoodies):**
- Black (#000000)
- Navy (#1e3a5f)
- Heather Gray (#9ca3af)
- Forest Green (#166534)
- Burgundy (#7f1d1d)
- Royal Blue (#1d4ed8)
- Charcoal (#374151)
- Cream (#fef3c7)

**Sizes:**
- Hoodies: XS, S, M, L, XL, XXL
- Accessories: One Size

**Total Products: 19** (6 hoodies + 13 accessories)
**Total Variants: 301** (288 hoodie variants + 13 accessory variants)

---

## AI Integration Design

### GPT-5.1 Responses API Overview

The demo uses OpenAI's GPT-5.1 Responses API with Zod for type-safe structured outputs:

```typescript
// Key imports
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Initialize client
const openai = new OpenAI();
```

### Zod Schemas (Type-Safe Structured Outputs)

**Recommendation Schema:**
```typescript
const RecommendationSchema = z.object({
  recommendations: z.array(z.object({
    productName: z.string().describe("Exact product name from catalog"),
    reason: z.string().describe("Why this product matches the user's needs"),
    confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
    highlightedFeatures: z.array(z.string()).describe("Key features that match"),
  })).min(1).max(3),
  followUpQuestions: z.array(z.string()).optional(),
});

// Automatic TypeScript type inference
type Recommendation = z.infer<typeof RecommendationSchema>;
```

**Search Results Schema:**
```typescript
const SearchResultsSchema = z.object({
  productNames: z.array(z.string()),
  isRelevant: z.boolean(),
  searchIntent: z.string().optional(),
});
```

### Using zodResponseFormat with Responses API

```typescript
// Structured output with automatic parsing
const response = await openai.responses.parse({
  model: "gpt-5.1",
  input: messages,
  text: {
    format: zodResponseFormat(RecommendationSchema, "product_recommendations"),
  },
});

// Type-safe access to parsed result
const result = response.output_parsed; // Typed as Recommendation
```

### System Prompt Template

```typescript
const SYSTEM_PROMPT = `You are a helpful AI shopping assistant for Hoodtopia, a premium online hoodie store.

## Your Personality
- Friendly, knowledgeable, and genuinely helpful
- Passionate about helping customers find their perfect hoodie
- You explain your reasoning - don't just list products
- Ask clarifying questions when needed

## Available Products
{{PRODUCT_CATALOG}}

## Rules
1. ONLY recommend products from the catalog above - never make up products
2. When recommending, explain WHY each product fits the customer's needs
3. If asked about products we don't carry (t-shirts, pants, etc.), politely redirect
4. For sizing questions, ask about fit preference (relaxed, fitted, true-to-size)
5. Highlight specific features that match their requirements
6. Be honest about limitations - if nothing fits perfectly, say so
7. Price is in USD

## Response Guidelines
- Keep responses concise but helpful (2-4 sentences for simple queries)
- Use bullet points for comparing multiple products
- Mention price when recommending products
- End with a question to continue the conversation if appropriate`;
```

### Gemini Image Generation (2.5 Flash / 3 Pro)

Product images are generated using Google's Gemini with native image generation:

```typescript
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

// Use gemini-2.5-flash-preview-05-20 or gemini-3-pro when available
const IMAGE_MODEL = "gemini-2.5-flash-preview-05-20";

// Generate product image with native image output
const response = await ai.models.generateContent({
  model: IMAGE_MODEL,
  contents: `Professional e-commerce product photo of a ${style} hoodie.
             Color: ${color}. Background: minimal studio.
             No people, product shot only.`,
  config: {
    responseModalities: [Modality.TEXT, Modality.IMAGE],
  },
});

// Extract base64 image from response
const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
const imageBase64 = imagePart?.inlineData?.data;
```

### Example Responses

**Recommendation Response (parsed via Zod):**
```typescript
{
  recommendations: [
    {
      productName: "Classic Comfort Hoodie",
      reason: "Perfect for your casual everyday needs with its soft cotton blend and relaxed fit",
      confidence: 0.92,
      highlightedFeatures: ["Soft inner lining", "Kangaroo pocket", "Relaxed fit"]
    }
  ],
  followUpQuestions: [
    "Do you have a color preference?",
    "What size do you typically wear?"
  ]
}
```

**Search Response (parsed via Zod):**
```typescript
{
  productNames: ["Heavyweight Winter Hoodie", "Tech Fleece Pro"],
  isRelevant: true,
  searchIntent: "warm winter hoodies"
}
```

---

## Component Architecture

### Component Tree

```
App
├── Header
│   ├── Logo
│   ├── Navigation
│   └── CartButton (with item count badge)
│
├── Main Content (varies by page)
│   ├── Homepage
│   │   ├── HeroSection
│   │   │   ├── AIBadge
│   │   │   └── CTAButtons
│   │   └── FeaturedProducts
│   │       └── ProductCard[]
│   │
│   ├── ProductsPage
│   │   ├── Tabs
│   │   │   ├── BrowseTab
│   │   │   │   ├── SearchInput
│   │   │   │   └── ProductGrid
│   │   │   │       └── ProductCard[]
│   │   │   └── AIRecsTab
│   │   │       ├── PreferenceInput
│   │   │       ├── FindMatchesButton
│   │   │       └── GenerativeProductCard[]
│   │   └── CategoryFilter
│   │
│   ├── ProductDetailPage
│   │   ├── ProductImageGallery
│   │   ├── ProductInfo
│   │   ├── VariantSelector
│   │   │   ├── ColorPicker
│   │   │   └── SizeSelector
│   │   ├── QuantitySelector
│   │   └── AddToCartButton
│   │
│   └── CartPage
│       ├── CartItemList
│       │   └── CartItem[]
│       │       ├── ProductThumbnail
│       │       ├── QuantityControls
│       │       └── RemoveButton
│       └── CartSummary
│           ├── Subtotal
│           └── CheckoutButton
│
├── AIChatDialog (Modal)
│   ├── ChatHeader
│   ├── MessageList
│   │   └── ChatMessage[]
│   ├── LoadingIndicator
│   └── ChatInput
│
├── CartSheet (Slide-out)
│   └── (Same as CartPage, compact)
│
└── Footer
```

### State Management

**Client State (React Context/Zustand):**
- Cart state (items, totals)
- UI state (chat open, active tab)
- Selected variant on product page

**Server State (tRPC + React Query):**
- Products list
- Individual product details
- AI responses (with caching disabled)

---

## API Routes

### tRPC Endpoints

| Router | Procedure | Type | Input | Output |
|--------|-----------|------|-------|--------|
| `products` | `list` | query | `{ category?, featured? }` | `Product[]` |
| `products` | `byId` | query | `string` | `Product` |
| `products` | `search` | query | `string` | `Product[]` |
| `products` | `featured` | query | - | `Product[]` |
| `cart` | `get` | query | - | `Cart` |
| `cart` | `addItem` | mutation | `{ productId, variantId, quantity }` | `Cart` |
| `cart` | `updateQuantity` | mutation | `{ itemId, quantity }` | `Cart` |
| `cart` | `removeItem` | mutation | `string` | `Cart` |
| `cart` | `clear` | mutation | - | `Cart` |
| `ai` | `chat` | mutation | `{ messages: Message[] }` | `string` |
| `ai` | `recommend` | mutation | `string` | `Recommendation[]` |
| `ai` | `search` | mutation | `string` | `Product[]` |

---

## Testing Strategy

### Test Categories

1. **Unit Tests** (Required)
   - AI service functions
   - Utility functions
   - Schema validation

2. **Integration Tests** (Optional)
   - tRPC procedures
   - Database operations

3. **E2E Tests** (Optional)
   - Critical user flows
   - AI interactions

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/services/__tests__/ai.test.ts
```

---

## File Structure

```
hoodtopia/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── icon.svg             # Favicon
│   │   ├── apple-icon.tsx       # Apple touch icon
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── cart/
│   │   │   └── page.tsx
│   │   ├── our-story/
│   │   │   └── page.tsx
│   │   ├── sustainability/
│   │   │   └── page.tsx
│   │   ├── careers/
│   │   │   └── page.tsx
│   │   ├── contact/
│   │   │   └── page.tsx
│   │   ├── privacy/
│   │   │   └── page.tsx         # Privacy Policy
│   │   ├── terms/
│   │   │   └── page.tsx         # Terms of Service
│   │   ├── shipping/
│   │   │   └── page.tsx         # Shipping & Returns
│   │   ├── faq/
│   │   │   └── page.tsx         # FAQ with accordion
│   │   └── api/
│   │       └── trpc/
│   │           └── [trpc]/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── currency-picker.tsx  # Country/currency selector
│   │   │   ├── logo.tsx         # Custom Hoodtopia logo
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── header.tsx       # With nav, currency picker, cart
│   │   │   └── footer.tsx       # 4-column e-commerce footer
│   │   ├── home/
│   │   │   ├── hero.tsx
│   │   │   ├── featured-products.tsx
│   │   │   ├── featured-accessories.tsx
│   │   │   └── best-sellers.tsx
│   │   ├── products/
│   │   │   ├── product-card.tsx     # With random color display
│   │   │   ├── generative-product-card.tsx
│   │   │   └── product-grid.tsx
│   │   ├── providers/
│   │   │   └── trpc-provider.tsx
│   │   └── ai/
│   │       ├── chat-button.tsx
│   │       ├── chat-dialog.tsx
│   │       └── recommendation-panel.tsx
│   │
│   ├── server/
│   │   ├── trpc.ts              # tRPC setup
│   │   ├── root.ts              # Root router
│   │   └── routers/
│   │       ├── products.ts      # featured, featuredAccessories, list, bySlug, etc.
│   │       ├── cart.ts
│   │       └── ai.ts
│   │
│   ├── services/
│   │   ├── ai.ts                # OpenAI AI functions (chat, recommend)
│   │   └── __tests__/
│   │       └── ai.test.ts
│   │
│   ├── db/
│   │   ├── index.ts             # DB connection
│   │   ├── schema.ts            # Drizzle schema
│   │   └── seed.ts              # Seed script (hoodies + accessories)
│   │
│   ├── scripts/
│   │   ├── generate-images.ts           # Gemini hoodie image generation
│   │   └── generate-accessory-images.ts # Gemini accessory image generation
│   │
│   ├── lib/
│   │   ├── utils.ts             # Utility functions
│   │   ├── trpc.ts              # tRPC client
│   │   └── currency.tsx         # Currency context & formatting
│   │
│   └── types/
│       └── index.ts             # Shared types
│
├── docs/
│   ├── IMPLEMENTATION_PLAN.md   # This file
│   ├── PRESENTATION_GUIDE.md
│   └── DEMO_SCRIPT.md
│
├── public/
│   └── images/
│       ├── products/            # Hoodie images
│       └── accessories/         # Accessory images
│
├── db/
│   └── hoodtopia.db             # SQLite database
│
├── .env.example
├── .env.local
├── .nvmrc                       # Node 20
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Implementation Checklist

### Phase 1: Setup ✅
- [x] Initialize Next.js project with TypeScript and Tailwind
- [x] Install all dependencies
- [x] Configure shadcn/ui
- [x] Create environment file structure
- [x] Setup Drizzle configuration
- [x] Create `.nvmrc` for Node 20

### Phase 2: Database & Image Generation ✅
- [x] Define schema in `src/db/schema.ts`
- [x] Create DB connection in `src/db/index.ts`
- [x] Write seed script with 6 hoodie products
- [x] Add 13 accessory products (stickers, pins, patches, keychain, socks, tote, mug, care kit, drawstrings)
- [x] Generate 288 hoodie variants (6 products × 8 colors × 6 sizes)
- [x] Generate 13 accessory variants (One Size each)
- [x] Create Gemini 3 Pro image generation script for hoodies
- [x] Create Gemini 3 Pro image generation script for accessories (13 prompts)
- [x] Generate 48 hoodie images (6 products × 8 colors)
- [x] Run migrations and seed

### Phase 3: tRPC Layer ✅
- [x] Setup tRPC context and router
- [x] Implement products router (list, byId, bySlug, search, featured, featuredAccessories, categories)
- [x] Implement cart router (get, addItem, updateQuantity, removeItem, clear)
- [x] Implement AI router (chat, recommend)
- [x] Create tRPC API handler

### Phase 4: AI Service (GPT-5.1 + Zod) ✅
- [x] Create system prompt builder with product catalog
- [x] Implement `chatWithAssistant` using OpenAI
- [x] Implement `getProductRecommendations` with structured output
- [x] Add error handling and fallbacks

### Phase 5: Components ✅
- [x] Layout: Header (with navigation, currency picker, cart), Footer (4-column e-commerce style)
- [x] Home: HeroSection, FeaturedProducts, FeaturedAccessories, BestSellers
- [x] Products: ProductCard (with random color display), ProductGrid, VariantSelector
- [x] Cart: CartPage with items, quantity controls, summary
- [x] AI: AIChatButton, AIChatDialog, AIRecommendationPanel
- [x] UI: CurrencyPicker, CurrencyPickerCompact, HoodtopiaLogo

### Phase 6: Pages ✅
- [x] Homepage with hero, featured hoodies, featured accessories, best sellers
- [x] Products page with tabs (Browse All, AI Recommendations)
- [x] Product detail page with variant selection (color changes image)
- [x] Cart page with full functionality
- [x] Our Story page
- [x] Sustainability page
- [x] Careers page
- [x] Contact page
- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Shipping & Returns page
- [x] FAQ page with accordion component

### Phase 7: Testing ⬜
- [x] Setup Vitest configuration
- [ ] Write AI service unit tests
- [ ] Test structured output parsing
- [ ] Test product matching logic

### Phase 8: Documentation ⬜
- [ ] Update README.md
- [ ] Create PRESENTATION_GUIDE.md
- [ ] Create DEMO_SCRIPT.md

### Phase 9: Additional Features ✅
- [x] Custom Hoodtopia logo SVG component
- [x] Custom favicon and Apple touch icon
- [x] Country/currency picker (US, Sweden, Japan, UK, Germany)
- [x] Multi-currency price display (USD, SEK, JPY, GBP, EUR)
- [x] Product cards show varied colors (hash-based pseudo-random)
- [x] Product detail images change with color selection
- [x] Featured Accessories section on homepage
- [x] Best Sellers section with anchor link
- [x] Professional e-commerce footer with newsletter signup
- [x] Privacy Policy, Terms of Service, Shipping & FAQ pages
- [x] Expanded accessory catalog (13 items: keychain, socks, tote, mug, care kit, glow pin, drawstrings)

### Final Polish ⬜
- [x] Mobile responsiveness (responsive header, mobile menu)
- [x] Dark theme consistency
- [x] Loading states for AI operations
- [ ] Error boundaries and fallbacks
- [x] TypeScript compilation (zero errors)
- [ ] All tests passing

---

## Example Queries for Demo

### Chat Assistant Queries

| Query | Expected Behavior |
|-------|-------------------|
| "Hi! I need a warm hoodie for winter running" | Recommend Athletic Performance or Heavyweight Winter, ask about temperature |
| "Which one is best for below freezing?" | Recommend Heavyweight Winter with confidence |
| "What's the difference between Tech Fleece and Athletic Performance?" | Compare features, use cases, prices |
| "Do you have any in blue?" | List products available in Royal Blue or Navy |
| "I'm size medium, will the Oversized fit me?" | Explain oversized fit, suggest sizing down |

### AI Recommendations Queries

| Preferences Input | Expected Output |
|-------------------|-----------------|
| "casual everyday hoodie, earth tones" | Classic Comfort (high confidence), maybe Oversized Street |
| "bold colors, athletic performance" | Athletic Performance, Tech Fleece Pro |
| "minimalist, work from home comfort" | Premium Zip-Up, Classic Comfort |
| "warm outdoor winter activities" | Heavyweight Winter (very high confidence) |
| "streetwear, oversized fit, statement piece" | Oversized Street (high confidence) |

---

## Design Tokens

### Colors (Tailwind Classes)

```css
/* Primary - Purple gradient */
--primary: #7c3aed;           /* purple-600 */
--primary-dark: #6d28d9;      /* purple-700 */
--primary-light: #a78bfa;     /* purple-400 */

/* Background - Dark theme */
--background: #0a0a0a;        /* Near black */
--card: #171717;              /* neutral-900 */
--muted: #262626;             /* neutral-800 */

/* Text */
--foreground: #fafafa;        /* neutral-50 */
--muted-foreground: #a3a3a3;  /* neutral-400 */

/* Accents */
--success: #22c55e;           /* green-500 */
--warning: #eab308;           /* yellow-500 */
--error: #ef4444;             /* red-500 */
```

### Typography

```css
/* Headings */
font-family: 'Inter', sans-serif;
h1: text-4xl font-bold tracking-tight
h2: text-3xl font-semibold
h3: text-xl font-medium

/* Body */
body: text-base
small: text-sm text-muted-foreground
```

---

## Next Steps After Demo

1. **MCP-UI Integration** - Connect to Model Context Protocol for enhanced agent capabilities
2. **Analytics Dashboard** - Track AI recommendation accuracy and user engagement
3. **A/B Testing** - Compare traditional vs AI-powered shopping experiences
4. **Multi-model Support** - Add fallback to Claude or Gemini for text (currently using Gemini for images)
5. **Voice Interface** - Add speech-to-text for hands-free shopping
6. **Streaming Responses** - Implement streaming for real-time AI chat
7. **Image Variants on Demand** - Generate color variants dynamically with Gemini

---

*This implementation plan was created for the LangChain Stockholm Meetup demo on AI in E-commerce, Agentic Commerce, and Generative UX.*
