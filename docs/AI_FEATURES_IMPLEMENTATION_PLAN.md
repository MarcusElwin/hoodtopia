ju# Hoodtopia AI Features Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for enhancing Hoodtopia's AI capabilities across 5 major feature areas, transforming it into a state-of-the-art AI-powered e-commerce platform demonstrating Agentic Commerce and Generative UX principles.

**Target Completion:** Phased rolloutno over 4-6 weeks
**Technology Stack:** Next.js 16, React 19, OpenAI GPT-5.1, Google Gemini 3 Pro, tRPC, SQLite
**Demo Focus:** LangChain Stockholm Meetup

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Feature 1: Enhanced AI Picks Tab](#2-feature-1-enhanced-ai-picks-tab)
3. [Feature 2: Post-Checkout Recommendations](#3-feature-2-post-checkout-recommendations)
4. [Feature 3: Custom Hoodie Designer with AI](#4-feature-3-custom-hoodie-designer-with-ai)
5. [Feature 4: Enhanced AI Assistant Chat](#5-feature-4-enhanced-ai-assistant-chat)
6. [Feature 5: Shopper Profiles with Generative UX](#6-feature-5-shopper-profiles-with-generative-ux)
7. [Technical Architecture](#7-technical-architecture)
8. [Implementation Phases](#8-implementation-phases)
9. [Database Schema Changes](#9-database-schema-changes)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Current State Analysis

### ✅ Already Implemented

| Feature | Status | Location |
|---------|--------|----------|
| AI Chat Dialog | ✅ Working | `src/components/ai/chat-dialog.tsx` |
| AI Picks Tab | ✅ Working | `src/app/products/page.tsx` |
| Product Recommendations | ✅ Working | `src/services/ai.ts:97-169` |
| Semantic Search | ✅ Working | `src/services/ai.ts:174-224` |
| tRPC AI Endpoints | ✅ Working | `src/server/routers/ai.ts` |
| Zod Schema Validation | ✅ Working | `src/services/schemas.ts` |

### 🔨 To Be Implemented

1. **Enhanced AI Picks** - Improve current implementation with better UX
2. **Post-Checkout Recommendations** - NEW feature
3. **Custom Hoodie Designer** - NEW feature (AI image generation)
4. **Enhanced Chat** - Upgrade existing chat with more capabilities
5. **Shopper Profiles** - NEW feature (Generative UX)

---

## 2. Feature 1: Enhanced AI Picks Tab

### Status: ENHANCEMENT (Currently Basic Implementation)

### Current Implementation
- Location: `src/components/products/ai-recommendations.tsx`
- Has example prompts and basic recommendations
- Returns 1-3 products with reasoning

### Proposed Enhancements

#### 2.1 Multi-Step Refinement Flow
```typescript
// User Journey:
1. Initial preferences input
2. AI shows 3 recommendations
3. User provides feedback ("too casual", "need warmer")
4. AI refines recommendations
5. Repeat until satisfied
```

**Implementation:**
- Add feedback buttons to each recommendation
- Track refinement history
- Pass conversation context to recommendation endpoint

**Files to Modify:**
- `src/components/products/ai-recommendations.tsx` (add feedback UI)
- `src/services/ai.ts` (add `refineRecommendations()` function)
- `src/server/routers/ai.ts` (add `ai.refine` endpoint)

#### 2.2 Personalization Based on Browse History
```typescript
// Track which products user views
// Feed to AI for better recommendations
```

**New Schema:**
```typescript
// src/services/schemas.ts
export const PersonalizationContextSchema = z.object({
  viewedProducts: z.array(z.string()),
  viewedCategories: z.array(z.string()),
  timeSpent: z.number(),
});
```

**Implementation:**
- Store browse history in localStorage or session
- Pass to AI recommendations as context
- Weight recommendations toward user preferences

**Files to Create:**
- `src/lib/analytics.ts` (track user behavior)
- `src/hooks/use-browse-history.ts` (React hook)

#### 2.3 Visual Comparison Mode
```typescript
// Side-by-side product comparison with AI explanation
```

**UI Features:**
- Select 2-3 products from recommendations
- Show comparison table (features, price, material)
- AI-generated "best for you" insight
- Highlight differences

**Files to Create:**
- `src/components/products/product-comparison.tsx`
- Add comparison state to AI recommendations component

#### 2.4 Save Preferences
```typescript
// Let users save their preference profile
```

**Implementation:**
- "Save my preferences" button
- Store in database with session/user ID
- Pre-fill preferences on return visits

**Database Changes:**
```sql
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  preferences TEXT NOT NULL, -- JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Feature 2: Pre-Checkout Recommendations (Cart Suggestions)

### Status: NEW FEATURE

### Why Pre-Checkout vs Post-Checkout?
**Pre-checkout is superior because:**
- Higher conversion rate (user is still shopping)
- Better user experience (all items in one order)
- Lower friction (no need to create new cart)
- Higher AOV (Average Order Value) impact
- More natural shopping flow

### User Journey
```
1. User adds items to cart
2. User navigates to /cart page
3. AI analyzes cart contents in real-time
4. Sidebar shows "Complete Your Look" section
5. AI suggests 3-5 complementary products
6. User can add directly to existing cart with one click
7. Proceed to checkout with all items together
```

### 3.1 Smart Complementary Logic

**AI Prompt Strategy:**
```typescript
// System prompt example:
"The customer currently has in their cart:
- Classic Comfort Hoodie (Black, M) - $59.99
- Performance Hoodie (Navy, L) - $79.99

Recommend 3-5 complementary products that:
1. Match their color preferences (Black, Navy, neutral tones)
2. Are accessories that pair well with hoodies (pins, patches, stickers, bags)
3. Are in different categories than cart items (avoid recommending more hoodies)
4. Fall within a reasonable price range (under $30 each to reduce friction)
5. Would enhance their purchase (care products, styling items)

Explain why each recommendation complements their cart."
```

**Business Rules:**
- If cart has hoodies → suggest accessories (pins, patches, stickers)
- If cart has multiple items → suggest bag or carrying solution
- If cart has athletic hoodies → suggest performance accessories
- Price range: Keep add-ons under $30 to reduce friction
- Color matching: Suggest items in complementary colors

### 3.2 Implementation Files

**New Component:**
```typescript
// src/components/cart/cart-recommendations.tsx
export function CartRecommendations({ cartItems }: Props) {
  const recommendMutation = trpc.ai.cartRecommendations.useMutation();
  const addToCartMutation = trpc.cart.addItem.useMutation();

  // Automatically trigger recommendations when cart loads
  useEffect(() => {
    if (cartItems.length > 0) {
      const productIds = cartItems.map(item => item.productId);
      recommendMutation.mutate({ cartProductIds: productIds });
    }
  }, [cartItems]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Complete Your Look</h3>
      </div>

      {recommendMutation.data?.recommendations.map((rec) => (
        <RecommendationCard
          key={rec.product.id}
          product={rec.product}
          reason={rec.reason}
          onAddToCart={() => addToCartMutation.mutate({
            productId: rec.product.id,
            variantId: rec.product.variants[0].id,
            quantity: 1
          })}
        />
      ))}
    </div>
  );
}
```

**New Service Function:**
```typescript
// src/services/ai.ts
export async function getCartRecommendations(
  cartProducts: ProductForAI[],
  allProducts: ProductForAI[]
): Promise<RecommendationsResponse> {
  const cartProductNames = cartProducts.map(p => p.name).join(', ');
  const cartCategories = [...new Set(cartProducts.map(p => p.category))];

  const systemPrompt = `You are a helpful shopping assistant for Hoodtopia.

The customer currently has these items in their cart:
${cartProductNames}

Based on their cart, recommend 3-5 complementary products that:
1. Are NOT the same type as items in cart (avoid categories: ${cartCategories.join(', ')})
2. Are accessories or add-ons (prefer: pins, patches, stickers, bags, care products)
3. Match the style and colors of their cart items
4. Are reasonably priced (prefer items under $30)
5. Would genuinely enhance their purchase

For each recommendation, explain why it complements their cart.`;

  // Call OpenAI with structured output
  // Return recommendations
}
```

**New Endpoint:**
```typescript
// src/server/routers/ai.ts
cartRecommendations: publicProcedure
  .input(z.object({
    cartProductIds: z.array(z.string()).min(1)
  }))
  .mutation(async ({ input }) => {
    // Fetch cart products with full details
    const cartProducts = await db.query.products.findMany({
      where: inArray(products.id, input.cartProductIds),
      with: { variants: true }
    });

    // Fetch all products for recommendations
    const allProducts = await db.query.products.findMany({
      with: { variants: true }
    });

    // Get AI recommendations
    const recommendations = await getCartRecommendations(
      cartProducts,
      allProducts
    );

    // Match and return
    return { recommendations };
  }),
```

### 3.3 UI/UX Design

**Location:** Cart page at `/cart` - sidebar component

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Cart Page                                          │
├─────────────────────────┬───────────────────────────┤
│                         │                           │
│  Cart Items             │  ✨ Complete Your Look   │
│                         │                           │
│  □ Classic Hoodie       │  Suggested for you:      │
│    Black, M - $59.99    │                           │
│                         │  ┌─────────────────────┐  │
│  □ Performance Hoodie   │  │ [Image]            │  │
│    Navy, L - $79.99     │  │ Enamel Pin Set     │  │
│                         │  │ $12.99             │  │
│  ─────────────────      │  │ "Matches your      │  │
│  Subtotal: $139.98      │  │  black hoodie"     │  │
│                         │  │ [Add to Cart]      │  │
│  [Checkout]             │  └─────────────────────┘  │
│                         │                           │
│                         │  ┌─────────────────────┐  │
│                         │  │ Hoodie Care Kit    │  │
│                         │  │ $19.99             │  │
│                         │  │ [Add to Cart]      │  │
│                         │  └─────────────────────┘  │
└─────────────────────────┴───────────────────────────┘
```

**Features:**
- Appears automatically when cart has items
- Compact card layout with images
- One-click "Add to Cart" buttons (adds to existing cart)
- Shows reasoning for each recommendation
- Sticky sidebar (follows scroll)
- Collapses on mobile to avoid clutter
- Loading state while AI generates recommendations

### 3.4 Analytics & Tracking

**Metrics to Track:**
- **View Rate:** % of cart pages that show recommendations (target: 95%+)
- **Acceptance Rate:** % of users who add at least 1 recommendation (target: 20-30%)
- **AOV Lift:** Average increase in order value (target: 15-25%)
- **Items per Order:** Increase in average items per cart (target: +0.5-1 item)
- **Most commonly recommended products:** Track which accessories sell best
- **Conversion by product category:** Which categories drive most adds

**Implementation:**
```typescript
// src/lib/analytics.ts
export function trackCartRecommendation(
  event: 'viewed' | 'added' | 'dismissed',
  data: {
    recommendationId: string;
    productId: string;
    cartValue: number;
    cartItemCount: number;
  }
) {
  console.log('[Analytics] Cart Recommendation:', event, data);
  // In production: send to analytics service
}
```

---

## 4. Feature 3: Custom Hoodie Designer with AI

### Status: NEW FEATURE (HIGH COMPLEXITY)

### Concept Overview
Users upload an image or describe their vision, and AI generates a custom hoodie design using Google Gemini 3 Pro. Fixed price of $100 USD.

### 4.1 User Journey

```
1. User clicks "Design Custom Hoodie" in nav or products page
2. Taken to `/custom-designer` page
3. Two input methods:
   a) Upload image (drag & drop or file picker)
   b) Text description ("Sunset over mountains with geometric patterns")
4. AI generates custom hoodie visualization
5. User can refine with feedback
6. Add to cart for $100 (fixed price)
7. Note: "Design will be professionally printed within 5-7 days"
```

### 4.2 Technical Implementation

#### Image Generation Service
```typescript
// src/services/image-generation.ts
import { GoogleGenerativeAI } from "@google/genai";

export async function generateCustomHoodie(
  input: { type: 'image'; imageData: string } | { type: 'text'; description: string },
  baseColor: string = 'Black'
): Promise<{ imageUrl: string; generationId: string }> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro" });

  let prompt = "";

  if (input.type === 'text') {
    prompt = `Create a photorealistic image of a ${baseColor} hoodie with the following design: ${input.description}.
    The hoodie should be displayed flat on a white background, front view, with the design clearly visible.
    Style: Professional product photography, high quality, e-commerce ready.`;
  } else {
    // Use image-to-image generation
    prompt = `Transform this image into a design for a ${baseColor} hoodie.
    Display the hoodie flat on white background, front view, professional product photo.`;
  }

  // Generate image
  const result = await model.generateContent(prompt);
  const imageUrl = result.response.text(); // Or handle base64

  // Save to public/images/custom/
  const generationId = generateUUID();
  await saveImage(imageUrl, generationId);

  return { imageUrl: `/images/custom/${generationId}.png`, generationId };
}
```

#### AI Design Refinement
```typescript
// src/services/ai.ts
export async function refineCustomDesign(
  originalDescription: string,
  currentImageUrl: string,
  userFeedback: string
): Promise<string> {
  // Use GPT-5.1 to understand feedback
  // Generate new prompt for Gemini
  // Return refined description

  const refinementPrompt = `
    Original design request: ${originalDescription}
    User feedback: ${userFeedback}

    Generate an improved design description that addresses the feedback.
  `;

  const response = await openai.responses.create({
    model: "gpt-5.1",
    messages: [{ role: "user", content: refinementPrompt }],
    max_tokens: 200,
  });

  return response.choices[0].message.content;
}
```

#### tRPC Endpoints
```typescript
// src/server/routers/ai.ts

// New endpoint 1: Generate custom design
generateCustomDesign: publicProcedure
  .input(z.object({
    type: z.enum(['image', 'text']),
    imageData: z.string().optional(),
    description: z.string().optional(),
    baseColor: z.string().default('Black'),
  }))
  .mutation(async ({ input }) => {
    // Validate input
    // Call generateCustomHoodie()
    // Save generation to database
    // Return image URL and generation ID
  }),

// New endpoint 2: Refine design
refineCustomDesign: publicProcedure
  .input(z.object({
    generationId: z.string(),
    feedback: z.string(),
  }))
  .mutation(async ({ input }) => {
    // Fetch original generation
    // Call refineCustomDesign()
    // Generate new image
    // Return updated image URL
  }),

// New endpoint 3: Add custom design to cart
addCustomToCart: publicProcedure
  .input(z.object({
    generationId: z.string(),
    size: z.string(),
  }))
  .mutation(async ({ input }) => {
    // Create special product entry
    // Fixed price: $100 (10000 cents)
    // Add to cart
  }),
```

### 4.3 Database Schema

```typescript
// src/db/schema.ts

// New table for custom designs
export const customDesigns = sqliteTable("custom_designs", {
  id: text("id").primaryKey().$defaultFn(() => generateUUID()),
  sessionId: text("session_id").notNull(),
  type: text("type", { enum: ["image", "text"] }).notNull(),
  originalInput: text("original_input").notNull(), // Image URL or text description
  generatedImageUrl: text("generated_image_url").notNull(),
  prompt: text("prompt").notNull(), // Gemini prompt used
  baseColor: text("base_color").default("Black"),
  refinementHistory: text("refinement_history"), // JSON array of refinements
  status: text("status", { enum: ["generating", "ready", "in_cart", "ordered"] }).default("generating"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Add relation to cartItems
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
  customDesign: one(customDesigns, {
    fields: [cartItems.customDesignId],
    references: [customDesigns.id],
  }),
}));
```

### 4.4 UI Components

#### Main Designer Page
```typescript
// src/app/custom-designer/page.tsx
"use client";

export default function CustomDesignerPage() {
  const [inputType, setInputType] = useState<'image' | 'text'>('text');
  const [description, setDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [baseColor, setBaseColor] = useState('Black');
  const [generatedDesign, setGeneratedDesign] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMutation = trpc.ai.generateCustomDesign.useMutation();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1>Design Your Custom Hoodie</h1>

      {/* Input Section */}
      <Tabs value={inputType} onValueChange={setInputType}>
        <TabsList>
          <TabsTrigger value="text">Describe Your Design</TabsTrigger>
          <TabsTrigger value="image">Upload Image</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Textarea
            placeholder="Describe your dream hoodie design..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </TabsContent>

        <TabsContent value="image">
          <ImageUploader onUpload={setUploadedImage} />
        </TabsContent>
      </Tabs>

      {/* Color Selection */}
      <ColorPicker value={baseColor} onChange={setBaseColor} />

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Generate Design
      </Button>

      {/* Generated Design Display */}
      {generatedDesign && (
        <CustomDesignPreview
          imageUrl={generatedDesign}
          onRefine={handleRefine}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
```

#### Design Preview Component
```typescript
// src/components/custom-designer/custom-design-preview.tsx
export function CustomDesignPreview({ imageUrl, onRefine, onAddToCart }: Props) {
  return (
    <div className="space-y-6">
      {/* Large Image Preview */}
      <div className="aspect-square relative">
        <Image src={imageUrl} alt="Custom Design" fill className="object-contain" />
      </div>

      {/* Refinement Input */}
      <div className="space-y-3">
        <Label>Not quite right? Tell us what to change:</Label>
        <Textarea
          placeholder="e.g., Make colors more vibrant, add geometric patterns..."
          value={refinementFeedback}
          onChange={(e) => setRefinementFeedback(e.target.value)}
        />
        <Button onClick={() => onRefine(refinementFeedback)}>
          Refine Design
        </Button>
      </div>

      {/* Add to Cart */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">$100.00</span>
          <Badge>Custom Design</Badge>
        </div>

        <SizePicker value={size} onChange={setSize} />

        <Button onClick={onAddToCart} size="lg" className="w-full">
          <ShoppingBag className="mr-2" />
          Add to Cart - $100
        </Button>

        <p className="text-sm text-muted-foreground">
          Your custom design will be professionally printed within 5-7 business days.
        </p>
      </div>
    </div>
  );
}
```

### 4.5 Image Storage Strategy

**Options:**
1. **Local Storage** (Demo):
   - Save to `public/images/custom/`
   - Works for demo, not scalable

2. **Cloud Storage** (Production):
   - Use Vercel Blob Storage
   - Or AWS S3 / Google Cloud Storage
   - Generate signed URLs

**Recommended for Demo:** Local storage

```typescript
// src/lib/image-storage.ts
import fs from 'fs/promises';
import path from 'path';

export async function saveCustomDesignImage(
  imageData: string, // base64 or URL
  generationId: string
): Promise<string> {
  const publicPath = path.join(process.cwd(), 'public', 'images', 'custom');
  await fs.mkdir(publicPath, { recursive: true });

  const filename = `${generationId}.png`;
  const filepath = path.join(publicPath, filename);

  // Save image data
  await fs.writeFile(filepath, Buffer.from(imageData, 'base64'));

  return `/images/custom/${filename}`;
}
```

### 4.6 Pricing & Business Logic

**Fixed Price:** $100 USD (10,000 cents in database)

**Why Fixed Price:**
- Simplifies checkout
- Covers printing costs
- Premium positioning
- Easy to explain to users

**Cost Considerations:**
- Gemini 3 Pro API costs: ~$0.10-0.50 per generation
- Printing costs: ~$15-25 per hoodie
- Margin: ~$70-85 per sale

---

## 5. Feature 4: Enhanced AI Assistant Chat

### Status: ENHANCEMENT (Currently Basic)

### Current Implementation
- Basic chat with message history
- GPT-5.1 integration
- Product context in system prompt
- Located in `src/components/ai/chat-dialog.tsx`

### 5.1 Proposed Enhancements

#### A. Rich Media Responses
```typescript
// Allow AI to return structured responses with:
- Product cards (clickable)
- Image carousels
- Comparison tables
- Quick action buttons
```

**New Schema:**
```typescript
// src/services/schemas.ts
export const RichMessageSchema = z.object({
  type: z.enum(['text', 'product_card', 'product_list', 'comparison']),
  content: z.string(),
  products: z.array(z.string()).optional(), // Product IDs
  metadata: z.record(z.any()).optional(),
});
```

**Implementation:**
```typescript
// src/services/ai.ts
export async function chatWithAssistantRich(
  messages: Message[],
  products: ProductForAI[]
): Promise<RichMessageSchema> {
  // Use structured output to determine response type
  // Return rich message object
  // Frontend renders based on type
}
```

#### B. Voice Input/Output
```typescript
// Add voice interaction capabilities
- Speech-to-text for input
- Text-to-speech for responses
```

**Implementation:**
```typescript
// src/components/ai/voice-input.tsx
export function VoiceInput({ onTranscript }: Props) {
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    // Use Web Speech API
    const recognition = new window.webkitSpeechRecognition();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };
    recognition.start();
  };

  return (
    <Button onClick={startRecording}>
      <Mic className={isRecording ? "animate-pulse" : ""} />
    </Button>
  );
}
```

#### C. Proactive Suggestions
```typescript
// AI proactively suggests help based on user behavior
- Viewing multiple products → "Can I help you compare?"
- Long time on page → "Looking for something specific?"
- Empty search → "Try asking me instead!"
```

**Implementation:**
```typescript
// src/components/ai/proactive-assistant.tsx
export function ProactiveAssistant() {
  const { viewedProducts, timeOnPage } = useBrowseHistory();
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (viewedProducts.length > 3) {
      setSuggestion("I noticed you're browsing several hoodies. Would you like help comparing them?");
    }
  }, [viewedProducts]);

  return suggestion ? (
    <div className="fixed bottom-24 right-6 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg">
      {suggestion}
      <Button onClick={openChat}>Yes, help me!</Button>
    </div>
  ) : null;
}
```

#### D. Context-Aware Responses
```typescript
// AI knows:
- Current page (products, cart, checkout)
- Items in cart
- Recently viewed products
- User's stated preferences
```

**Enhanced System Prompt:**
```typescript
// src/services/ai.ts
function buildSystemPrompt(context: ChatContext) {
  return `You are a helpful shopping assistant for Hoodtopia.

  Current context:
  - Page: ${context.currentPage}
  - Cart items: ${context.cartItems.length} (${context.cartTotal})
  - Recently viewed: ${context.recentlyViewed.join(', ')}
  - User preferences: ${context.preferences}

  Tailor your responses to the user's current context and needs.`;
}
```

#### E. Multi-Language Support
```typescript
// Detect user language and respond accordingly
// GPT-5.1 supports 50+ languages natively
```

**Implementation:**
```typescript
// src/lib/i18n.ts
export function detectLanguage(text: string): string {
  // Use browser language or text analysis
  return navigator.language || 'en';
}

// In AI service
const userLanguage = detectLanguage(messages[0].content);
systemPrompt += `\nRespond in ${userLanguage}.`;
```

---

## 6. Feature 5: Shopper Profiles with Generative UX

### Status: NEW FEATURE (INNOVATIVE)

### Concept Overview
5 pre-defined shopper personas that completely transform the UI/UX based on the selected profile. This demonstrates true Generative UX - where AI adapts the entire interface to user needs.

### 6.1 Technology Choice: AG-UI vs MCP-UI

**Research Summary:**

#### AG-UI (Agent-User Interaction Protocol)
- **Pros:**
  - Open standard by CopilotKit (2025)
  - Event-based, real-time streaming
  - Framework agnostic
  - Microsoft Agent Framework compatible
  - Sub-100ms latency
  - Better for agent-driven UX changes

- **Cons:**
  - Newer, smaller ecosystem
  - Less documentation
  - Requires more custom implementation

#### MCP-UI (Model Context Protocol UI Extension)
- **Pros:**
  - Backed by Anthropic + OpenAI (Nov 2025)
  - Standardized iframe-based components
  - Strong security model (sandboxed)
  - Official MCP extension (SEP-1865)
  - Better for embedded interactive components

- **Cons:**
  - Iframe-based (performance overhead)
  - Limited to text/html initially
  - Newer extension, evolving standard

**Recommendation: AG-UI**

**Why AG-UI for Shopper Profiles:**
1. Better fit for full-page UX transformations
2. Real-time event streaming for dynamic changes
3. Framework agnostic (works with Next.js)
4. Better performance (no iframe overhead)
5. More control over UI generation

### 6.2 Five Shopper Profiles

#### Profile 1: "The Minimalist" 🎯
**Persona:**
- Values: Simplicity, speed, no clutter
- Goals: Find perfect item quickly, checkout fast
- Style: Clean, monochrome, essential info only

**UX Adaptations:**
- Single-column product layout
- Hide non-essential info (reviews, full descriptions)
- Prominent "Quick Buy" buttons
- Minimal color palette (black, white, gray)
- Auto-hide navigation after selection
- One-click checkout

**AI Behavior:**
- Direct recommendations ("Based on your style, get the Classic Black Hoodie")
- No upselling
- Binary questions only ("Yes" or "No")

#### Profile 2: "The Researcher" 📊
**Persona:**
- Values: Data, comparisons, reviews
- Goals: Make informed decision with all facts
- Style: Detailed tables, specifications, metrics

**UX Adaptations:**
- Multi-column comparison tables
- Expanded product specs (material %, weight, dimensions)
- User reviews prominently displayed
- Sizing charts always visible
- Price history graphs
- Similar product comparisons side-by-side

**AI Behavior:**
- Detailed explanations with data
- Comparison insights ("Product A has 20% more cotton than B")
- Answer specific technical questions

#### Profile 3: "The Trendsetter" ✨
**Persona:**
- Values: Style, social proof, what's new
- Goals: Stay ahead of trends, unique items
- Style: Visual-first, Instagram-worthy, animated

**UX Adaptations:**
- Large hero images
- "Trending Now" and "New Arrivals" badges
- Social media integration (share buttons)
- Style matching ("Complete the Look")
- Influencer recommendations
- Animated transitions and micro-interactions

**AI Behavior:**
- Style-focused recommendations
- Trend insights ("Forest Green is trending this season")
- Outfit coordination suggestions

#### Profile 4: "The Budget Hunter" 💰
**Persona:**
- Values: Deals, value, smart spending
- Goals: Best price, bundle savings
- Style: Price-first, deals highlighted, cost breakdown

**UX Adaptations:**
- Price prominently displayed
- "Best Value" badges
- Bundle deals ("Buy 2 save 20%")
- Price comparison with competitors
- Cost per wear calculator
- Loyalty points visible

**AI Behavior:**
- Cost-conscious recommendations
- Bundle suggestions
- Price alerts ("This hoodie is $10 less than usual")

#### Profile 5: "The Explorer" 🚀
**Persona:**
- Values: Discovery, variety, serendipity
- Goals: Browse and be surprised
- Style: Dynamic feeds, random picks, discovery mode

**UX Adaptations:**
- Infinite scroll feed
- "Surprise Me" button
- Random product shuffles
- Discovery quiz
- Mix of categories
- Interactive product reveals

**AI Behavior:**
- Diverse recommendations
- Unexpected pairings
- Open-ended questions ("What vibe are you going for today?")

### 6.3 Implementation with AG-UI

#### Profile Context Provider
```typescript
// src/lib/shopper-profiles.tsx
"use client";

import { createContext, useContext, useState, useCallback } from 'react';

export type ProfileType = 'minimalist' | 'researcher' | 'trendsetter' | 'budget_hunter' | 'explorer';

export interface ProfileConfig {
  id: ProfileType;
  name: string;
  icon: string;
  description: string;
  theme: {
    layout: 'single' | 'grid' | 'list' | 'comparison' | 'feed';
    colors: string[];
    spacing: 'tight' | 'normal' | 'relaxed';
    animations: boolean;
  };
  aiPersonality: {
    tone: 'direct' | 'detailed' | 'friendly' | 'practical' | 'playful';
    verbosity: 'minimal' | 'moderate' | 'verbose';
    focusAreas: string[];
  };
  uiPreferences: {
    showPrices: 'prominent' | 'normal' | 'subtle';
    showReviews: boolean;
    showSpecs: 'full' | 'summary' | 'hidden';
    quickBuy: boolean;
  };
}

export const PROFILES: Record<ProfileType, ProfileConfig> = {
  minimalist: {
    id: 'minimalist',
    name: 'The Minimalist',
    icon: '🎯',
    description: 'Clean, fast, essential',
    theme: {
      layout: 'single',
      colors: ['#000000', '#FFFFFF', '#808080'],
      spacing: 'tight',
      animations: false,
    },
    aiPersonality: {
      tone: 'direct',
      verbosity: 'minimal',
      focusAreas: ['essentials', 'speed'],
    },
    uiPreferences: {
      showPrices: 'prominent',
      showReviews: false,
      showSpecs: 'hidden',
      quickBuy: true,
    },
  },
  // ... other profiles
};

interface ProfileContextType {
  currentProfile: ProfileType;
  config: ProfileConfig;
  setProfile: (profile: ProfileType) => void;
  isProfileActive: boolean;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<ProfileType>('minimalist');
  const [isProfileActive, setIsProfileActive] = useState(false);

  const config = PROFILES[currentProfile];

  const setProfile = useCallback((profile: ProfileType) => {
    setCurrentProfile(profile);
    setIsProfileActive(true);

    // Log analytics
    console.log(`Profile switched to: ${profile}`);
  }, []);

  return (
    <ProfileContext.Provider value={{ currentProfile, config, setProfile, isProfileActive }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}
```

#### Profile Selector Component
```typescript
// src/components/profiles/profile-selector.tsx
export function ProfileSelector() {
  const { currentProfile, setProfile } = useProfile();

  return (
    <Select value={currentProfile} onValueChange={setProfile}>
      <SelectTrigger className="w-[250px]">
        <SelectValue placeholder="Choose your shopping style" />
      </SelectTrigger>
      <SelectContent>
        {Object.values(PROFILES).map((profile) => (
          <SelectItem key={profile.id} value={profile.id}>
            <span className="flex items-center gap-2">
              <span>{profile.icon}</span>
              <span className="font-medium">{profile.name}</span>
            </span>
            <span className="text-sm text-muted-foreground">{profile.description}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

#### Adaptive Product Grid
```typescript
// src/components/products/adaptive-product-grid.tsx
export function AdaptiveProductGrid({ products }: Props) {
  const { config } = useProfile();

  // Dynamically change layout based on profile
  const layoutClass = {
    single: 'grid-cols-1',
    grid: 'grid-cols-1 md:grid-cols-3',
    list: 'grid-cols-1',
    comparison: 'grid-cols-1 lg:grid-cols-2',
    feed: 'grid-cols-1 md:grid-cols-2',
  }[config.theme.layout];

  const spacingClass = {
    tight: 'gap-2',
    normal: 'gap-4',
    relaxed: 'gap-8',
  }[config.theme.spacing];

  return (
    <div className={`grid ${layoutClass} ${spacingClass}`}>
      {products.map((product) => (
        <AdaptiveProductCard
          key={product.id}
          product={product}
          profile={config}
        />
      ))}
    </div>
  );
}
```

#### Adaptive Product Card
```typescript
// src/components/products/adaptive-product-card.tsx
export function AdaptiveProductCard({ product, profile }: Props) {
  const showQuickBuy = profile.uiPreferences.quickBuy;
  const showSpecs = profile.uiPreferences.showSpecs;
  const showReviews = profile.uiPreferences.showReviews;

  return (
    <Card className={profile.theme.animations ? 'hover:scale-105 transition' : ''}>
      <CardContent className="space-y-2">
        {/* Image */}
        <div className="aspect-square relative">
          <Image src={product.imageUrl} alt={product.name} fill />
        </div>

        {/* Title */}
        <h3 className="font-semibold">{product.name}</h3>

        {/* Price - Size based on profile */}
        <p className={`font-bold ${
          profile.uiPreferences.showPrices === 'prominent' ? 'text-2xl' : 'text-lg'
        }`}>
          {formatPrice(product.basePrice)}
        </p>

        {/* Conditional content based on profile */}
        {showSpecs !== 'hidden' && (
          <div className="text-sm text-muted-foreground">
            {showSpecs === 'full' ? product.description : product.material}
          </div>
        )}

        {showReviews && (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400" />
            <span>4.5 (123 reviews)</span>
          </div>
        )}

        {/* Quick Buy for Minimalist */}
        {showQuickBuy && (
          <Button className="w-full" size="sm">
            Quick Buy
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

#### AI Personality Adapter
```typescript
// src/services/ai.ts
export function buildProfiledSystemPrompt(
  profile: ProfileConfig,
  products: ProductForAI[]
): string {
  const basePrompt = buildSystemPrompt(products);

  const personalityAdditions = {
    minimalist: `
      Be extremely concise. Give 1-2 sentence responses maximum.
      Focus only on the most essential information.
      Recommend only 1 product at a time.
      No fluff or unnecessary details.
    `,
    researcher: `
      Provide detailed, data-driven responses.
      Include specifications, comparisons, and reasoning.
      Always cite specific features and materials.
      Be thorough and comprehensive in explanations.
    `,
    trendsetter: `
      Be enthusiastic and style-focused.
      Mention trends, aesthetics, and visual appeal.
      Use emojis and expressive language.
      Suggest outfit combinations and styling tips.
    `,
    budget_hunter: `
      Always mention prices and value propositions.
      Highlight deals, bundles, and savings.
      Compare prices across products.
      Be practical and cost-conscious.
    `,
    explorer: `
      Be playful and encouraging of discovery.
      Suggest unexpected combinations.
      Ask open-ended questions.
      Introduce variety and surprise elements.
    `,
  }[profile.id];

  return basePrompt + '\n\nPersonality:\n' + personalityAdditions;
}
```

### 6.4 AG-UI Integration Details

**Note:** AG-UI is still evolving. For the demo, we'll implement a **profile-based adaptive UX system** that mimics AG-UI principles without full protocol integration.

**Why not full AG-UI yet:**
- Library still in early stages
- Complex setup for short timeline
- Core concepts can be demonstrated with custom implementation

**AG-UI Principles Applied:**
1. **Event-based updates** - Profile changes trigger UI updates
2. **Real-time adaptation** - Instant theme switching
3. **Agent-driven UX** - AI personality changes with profile
4. **State streaming** - Profile state flows through components

**Future Migration Path:**
When AG-UI matures, the architecture is ready:
```typescript
// Future AG-UI integration
import { useAgentUI } from '@ag-ui/react';

export function ProfiledApp() {
  const { streamState, sendEvent } = useAgentUI({
    endpoint: '/api/ag-ui',
    profile: currentProfile,
  });

  return <AdaptiveUI state={streamState} />;
}
```

---

## 7. Technical Architecture

### 7.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 16)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Products   │  │     Cart     │  │   Custom     │        │
│  │     Page     │  │     Page     │  │   Designer   │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                  │                 │
│  ┌──────▼──────────────────▼──────────────────▼──────┐        │
│  │           Profile Context Provider                 │        │
│  │         (Adaptive UX Based on Shopper Type)        │        │
│  └────────────────────────┬───────────────────────────┘        │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────┐        │
│  │              tRPC Client Hooks                      │        │
│  │  - products.*  - cart.*  - ai.*                    │        │
│  └────────────────────────┬───────────────────────────┘        │
└─────────────────────────────┼─────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   tRPC HTTP/RPC    │
                    └─────────┬──────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                      Backend (tRPC + Node)                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Products   │  │     Cart     │  │      AI      │       │
│  │    Router    │  │    Router    │  │    Router    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │                │
│         │                  │         ┌────────▼────────┐      │
│         │                  │         │   AI Service    │      │
│         │                  │         │  (ai.ts)        │      │
│         │                  │         └────────┬────────┘      │
│         │                  │                  │                │
│  ┌──────▼──────────────────▼──────────────────▼──────┐       │
│  │              Drizzle ORM Layer                     │       │
│  └────────────────────────┬───────────────────────────┘       │
└─────────────────────────────┼─────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   SQLite Database  │
                    └────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      External APIs                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                    ┌──────────────┐         │
│  │   OpenAI     │                    │    Gemini    │         │
│  │   GPT-5.1    │                    │  3 Pro (API) │         │
│  │              │                    │              │         │
│  │ • Chat       │                    │ • Image Gen  │         │
│  │ • Recommend  │                    │ • Custom     │         │
│  │ • Search     │                    │   Designs    │         │
│  └──────────────┘                    └──────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Data Flow for Key Features

#### A. AI Picks Tab
```
User enters preferences
      ↓
Component calls trpc.ai.recommend.useMutation()
      ↓
Backend fetches all products from DB
      ↓
Calls getProductRecommendations(preferences, products)
      ↓
OpenAI GPT-5.1 with Zod schema validation
      ↓
Returns 1-3 recommendations with confidence scores
      ↓
Component matches product names to actual products
      ↓
Displays ProductCards with AI reasoning
```

#### B. Post-Checkout Recommendations
```
User completes checkout
      ↓
Order complete page loads with cart items
      ↓
Component calls trpc.ai.postCheckoutRecommend({ purchasedProductIds })
      ↓
Backend fetches purchased products + all products
      ↓
Calls getPostCheckoutRecommendations()
      ↓
AI analyzes purchase patterns (categories, colors, prices)
      ↓
Returns 3-5 complementary products
      ↓
Component displays with "Add to New Order" buttons
      ↓
User clicks → Creates new cart → Adds product
```

#### C. Custom Hoodie Designer
```
User uploads image or enters text description
      ↓
Component calls trpc.ai.generateCustomDesign()
      ↓
Backend validates input
      ↓
Calls generateCustomHoodie(input, baseColor)
      ↓
Google Gemini 3 Pro generates hoodie image
      ↓
Image saved to public/images/custom/
      ↓
Generation record saved to DB (customDesigns table)
      ↓
Component displays generated design
      ↓
User provides refinement feedback
      ↓
Call trpc.ai.refineCustomDesign({ generationId, feedback })
      ↓
AI generates improved description → New image
      ↓
User satisfied → Add to cart ($100 fixed price)
```

#### D. Shopper Profiles
```
User selects profile from dropdown
      ↓
ProfileContext updates currentProfile state
      ↓
All components consuming useProfile() re-render
      ↓
UI adapts:
  - Layout changes (grid/list/single)
  - Colors update (theme.colors)
  - Spacing adjusts (tight/normal/relaxed)
  - Conditional features show/hide
      ↓
AI chat uses profiled system prompt
      ↓
All interactions tailored to persona
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Set up infrastructure and database changes

**Tasks:**
- [ ] Add new database tables
  - `customDesigns` table
  - `user_preferences` table
  - `browse_history` table (optional)
- [ ] Run database migrations (`npm run db:push`)
- [ ] Update Zod schemas in `src/services/schemas.ts`
  - `PostCheckoutRecommendationSchema`
  - `CustomDesignInputSchema`
  - `RichMessageSchema`
- [ ] Set up image storage utilities (`src/lib/image-storage.ts`)
- [ ] Test Gemini 3 Pro API connection
- [ ] Create profile configuration file (`src/lib/shopper-profiles.tsx`)

**Deliverables:**
- Database schema updated
- All schemas defined and tested
- Image storage working locally
- Profile system architecture ready

---

### Phase 2: Enhanced AI Picks (Week 1-2)
**Goal:** Improve existing AI Picks tab

**Tasks:**
- [ ] Add refinement feedback UI to `ai-recommendations.tsx`
- [ ] Create new service function: `refineRecommendations()`
- [ ] Add tRPC endpoint: `ai.refine`
- [ ] Implement browse history tracking
  - Hook: `use-browse-history.ts`
  - LocalStorage persistence
- [ ] Add personalization context to recommendations
- [ ] Create product comparison component
- [ ] Add "Save Preferences" functionality
- [ ] Write tests for refinement logic

**Deliverables:**
- Multi-step refinement working
- Browse history tracked
- Comparison view functional
- Tests passing

---

### Phase 3: Post-Checkout Recommendations (Week 2)
**Goal:** Build post-purchase upsell feature

**Tasks:**
- [ ] Create service function: `getPostCheckoutRecommendations()`
- [ ] Add tRPC endpoint: `ai.postCheckoutRecommend`
- [ ] Build PostCheckoutRecommendations component
- [ ] Create order complete page or modal
- [ ] Implement "Add to New Order" flow
- [ ] Add analytics tracking for conversions
- [ ] Test complementary product logic
- [ ] Write component tests

**Deliverables:**
- Post-checkout recommendations working
- Analytics in place
- Conversion tracking functional

---

### Phase 4: Custom Hoodie Designer (Week 2-3)
**Goal:** Launch AI-powered custom design feature

**Tasks:**
- [ ] Create image generation service with Gemini
- [ ] Build custom designer page (`/custom-designer`)
- [ ] Create upload + text input components
- [ ] Implement color picker for base hoodie
- [ ] Add tRPC endpoints:
  - `ai.generateCustomDesign`
  - `ai.refineCustomDesign`
  - `ai.addCustomToCart`
- [ ] Create CustomDesignPreview component
- [ ] Implement refinement feedback loop
- [ ] Add size selection for custom designs
- [ ] Handle cart integration (special $100 product)
- [ ] Test image generation pipeline
- [ ] Write integration tests

**Deliverables:**
- Full custom designer flow working
- Image generation with Gemini
- Refinement iterations functional
- Cart integration complete

---

### Phase 5: Enhanced AI Chat (Week 3)
**Goal:** Add advanced chat capabilities

**Tasks:**
- [ ] Implement rich message responses
- [ ] Add product cards in chat
- [ ] Build context-aware system prompts
- [ ] (Optional) Add voice input with Web Speech API
- [ ] (Optional) Add text-to-speech responses
- [ ] Create proactive suggestion component
- [ ] Add multi-language detection
- [ ] Test rich message rendering
- [ ] Write chat enhancement tests

**Deliverables:**
- Rich responses working
- Context-aware chat functional
- Proactive suggestions implemented
- Voice features (if time permits)

---

### Phase 6: Shopper Profiles + Generative UX (Week 3-4)
**Goal:** Build profile-based adaptive UX system

**Tasks:**
- [ ] Implement ProfileContext provider
- [ ] Create profile selector dropdown
- [ ] Build 5 profile configurations
- [ ] Create AdaptiveProductGrid component
- [ ] Build AdaptiveProductCard component
- [ ] Implement profile-specific AI personalities
- [ ] Add theme switching logic
- [ ] Create layout adapters for each profile
- [ ] Test all 5 profiles thoroughly
- [ ] Add profile analytics tracking
- [ ] Write comprehensive tests

**Deliverables:**
- All 5 profiles functional
- UI adapts instantly to profile changes
- AI personality adjusts per profile
- Smooth transitions between profiles

---

### Phase 7: Testing & Polish (Week 4)
**Goal:** Ensure everything works flawlessly

**Tasks:**
- [ ] End-to-end testing of all features
- [ ] Performance optimization
  - Image lazy loading
  - Code splitting
  - API response caching
- [ ] Error handling improvements
- [ ] Loading state refinements
- [ ] Mobile responsiveness check
- [ ] Accessibility audit (ARIA labels, keyboard nav)
- [ ] Documentation updates
- [ ] Demo script preparation
- [ ] Bug fixes

**Deliverables:**
- All features tested and working
- No critical bugs
- Performance optimized
- Demo ready

---

## 9. Database Schema Changes

### New Tables

```typescript
// src/db/schema.ts

// 1. Custom Designs Table
export const customDesigns = sqliteTable("custom_designs", {
  id: text("id").primaryKey().$defaultFn(() => generateUUID()),
  sessionId: text("session_id").notNull(),
  type: text("type", { enum: ["image", "text"] }).notNull(),
  originalInput: text("original_input").notNull(),
  generatedImageUrl: text("generated_image_url").notNull(),
  prompt: text("prompt").notNull(),
  baseColor: text("base_color").default("Black"),
  refinementHistory: text("refinement_history"), // JSON
  status: text("status", {
    enum: ["generating", "ready", "in_cart", "ordered"]
  }).default("generating"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 2. User Preferences Table
export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey().$defaultFn(() => generateUUID()),
  sessionId: text("session_id").notNull().unique(),
  preferences: text("preferences").notNull(), // JSON
  shopperProfile: text("shopper_profile", {
    enum: ["minimalist", "researcher", "trendsetter", "budget_hunter", "explorer"]
  }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 3. Browse History Table (Optional)
export const browseHistory = sqliteTable("browse_history", {
  id: text("id").primaryKey().$defaultFn(() => generateUUID()),
  sessionId: text("session_id").notNull(),
  productId: text("product_id").notNull().references(() => products.id),
  viewedAt: integer("viewed_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  timeSpent: integer("time_spent"), // seconds
});

// 4. Analytics Events Table (Optional but recommended)
export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey().$defaultFn(() => generateUUID()),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(), // 'recommendation_accepted', 'custom_design_created', etc.
  eventData: text("event_data"), // JSON
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

### Modified Tables

```typescript
// Update cartItems to support custom designs
export const cartItems = sqliteTable("cart_items", {
  id: text("id").primaryKey().$defaultFn(() => generateUUID()),
  cartId: text("cart_id").notNull().references(() => carts.id),
  productId: text("product_id").references(() => products.id), // Now nullable for custom designs
  variantId: text("variant_id").references(() => productVariants.id),
  customDesignId: text("custom_design_id").references(() => customDesigns.id), // NEW
  quantity: integer("quantity").notNull(),
  priceAtAdd: integer("price_at_add").notNull(),
});

// Add relations
export const customDesignsRelations = relations(customDesigns, ({ many }) => ({
  cartItems: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
  customDesign: one(customDesigns, {
    fields: [cartItems.customDesignId],
    references: [customDesigns.id],
  }),
}));
```

### Migration Script

```bash
# Run migrations
npm run db:push

# Seed if needed
npm run db:seed
```

---

## 10. Testing Strategy

### Unit Tests

```typescript
// src/services/ai.test.ts
describe('AI Service Functions', () => {
  test('getProductRecommendations returns 1-3 products', async () => {
    const recommendations = await getProductRecommendations(
      'I need a warm hoodie for hiking',
      mockProducts
    );
    expect(recommendations.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(recommendations.recommendations.length).toBeLessThanOrEqual(3);
  });

  test('getPostCheckoutRecommendations excludes purchased products', async () => {
    const purchased = [mockProducts[0]];
    const recommendations = await getPostCheckoutRecommendations(
      purchased,
      mockProducts
    );
    const recommendedIds = recommendations.recommendations.map(r => r.productName);
    expect(recommendedIds).not.toContain(purchased[0].name);
  });

  test('generateCustomHoodie creates valid image URL', async () => {
    const result = await generateCustomHoodie(
      { type: 'text', description: 'Sunset design' },
      'Black'
    );
    expect(result.imageUrl).toMatch(/^\/images\/custom\/.+\.png$/);
  });
});

// src/lib/shopper-profiles.test.ts
describe('Shopper Profiles', () => {
  test('all profiles have required configuration', () => {
    Object.values(PROFILES).forEach(profile => {
      expect(profile.id).toBeDefined();
      expect(profile.theme).toBeDefined();
      expect(profile.aiPersonality).toBeDefined();
      expect(profile.uiPreferences).toBeDefined();
    });
  });

  test('buildProfiledSystemPrompt returns unique prompts per profile', () => {
    const minimalistPrompt = buildProfiledSystemPrompt(PROFILES.minimalist, mockProducts);
    const researcherPrompt = buildProfiledSystemPrompt(PROFILES.researcher, mockProducts);
    expect(minimalistPrompt).not.toEqual(researcherPrompt);
  });
});
```

### Integration Tests

```typescript
// src/app/custom-designer/page.test.tsx
describe('Custom Designer Page', () => {
  test('user can generate design from text', async () => {
    render(<CustomDesignerPage />);

    const textarea = screen.getByPlaceholderText(/describe your dream hoodie/i);
    fireEvent.change(textarea, { target: { value: 'Mountain sunset' } });

    const generateButton = screen.getByText(/generate design/i);
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByAltText(/custom design/i)).toBeInTheDocument();
    });
  });

  test('user can refine generated design', async () => {
    // Test refinement flow
  });
});
```

### E2E Tests (Optional)

```typescript
// Use Playwright or Cypress
describe('Complete User Journey', () => {
  test('user completes full checkout with post-purchase recommendations', async () => {
    // 1. Browse products
    // 2. Add to cart
    // 3. Checkout
    // 4. See recommendations
    // 5. Add recommended product to new cart
  });

  test('user creates custom hoodie and adds to cart', async () => {
    // 1. Navigate to custom designer
    // 2. Enter description
    // 3. Generate design
    // 4. Refine once
    // 5. Add to cart
    // 6. Verify $100 price
  });
});
```

---

## 11. API Cost Estimates

### OpenAI GPT-5.1 Costs

| Feature | Tokens/Request | Cost/Request | Est. Requests/Day | Daily Cost |
|---------|----------------|--------------|-------------------|------------|
| Chat | ~500 tokens | $0.01 | 1000 | $10 |
| Recommendations | ~800 tokens | $0.016 | 500 | $8 |
| Search | ~300 tokens | $0.006 | 300 | $1.80 |
| Post-checkout | ~600 tokens | $0.012 | 100 | $1.20 |
| Refinement | ~700 tokens | $0.014 | 200 | $2.80 |

**Total OpenAI Daily Cost:** ~$24

### Google Gemini 3 Pro Costs

| Feature | Cost/Generation | Est. Requests/Day | Daily Cost |
|---------|-----------------|-------------------|------------|
| Custom Design | $0.10-0.50 | 50 | $5-25 |
| Refinement | $0.10-0.50 | 30 | $3-15 |

**Total Gemini Daily Cost:** ~$8-40

**Total Daily API Cost:** ~$32-64 (for demo/testing)
**Monthly API Cost:** ~$960-1920

**Note:** For production, implement caching and rate limiting to reduce costs.

---

## 12. Success Metrics

### Key Performance Indicators (KPIs)

#### A. AI Picks Tab
- **Engagement:** % of visitors who use AI Picks
- **Success:** % who add recommended products to cart
- **Refinement:** Average # of refinement iterations
- **Target:** 30% of visitors engage, 15% add to cart

#### B. Post-Checkout Recommendations
- **Acceptance Rate:** % who add recommended products
- **Revenue Impact:** Additional revenue per order
- **Target:** 10% acceptance, +$15 average order value

#### C. Custom Hoodie Designer
- **Generation Rate:** # of custom designs created per day
- **Completion Rate:** % who complete and add to cart
- **Refinement Rate:** Average # of refinements per design
- **Target:** 5 designs/day during demo, 60% completion

#### D. Enhanced AI Chat
- **Usage:** % of visitors who open chat
- **Satisfaction:** Message quality (thumbs up/down)
- **Conversion:** % who purchase after using chat
- **Target:** 20% open chat, 70% satisfaction, 25% convert

#### E. Shopper Profiles
- **Adoption:** % of users who select a profile
- **Distribution:** Usage breakdown across 5 profiles
- **Engagement:** Time spent & actions per profile
- **Target:** 40% adopt profiles, even distribution

---

## 13. Demo Script for Meetup

### 5-Minute Demo Flow

**Minute 1: Introduction**
- "Welcome to Hoodtopia - an AI-first e-commerce platform"
- Show homepage briefly
- "We've implemented 5 major AI features"

**Minute 2: AI Picks + Refinement**
- Navigate to Products → AI Picks tab
- Enter: "I need a warm hoodie for hiking"
- Show 3 recommendations with reasoning
- Give feedback: "Something more casual"
- Show refined recommendations

**Minute 3: Custom Hoodie Designer**
- Click "Design Custom Hoodie"
- Enter: "Mountain sunset with geometric patterns"
- Show AI-generated design
- Demonstrate refinement: "Make colors more vibrant"
- Show updated design
- Add to cart ($100)

**Minute 4: Shopper Profiles**
- Show profile dropdown in header
- Switch to "The Minimalist" - UI transforms instantly
- Switch to "The Researcher" - show detailed view
- Switch to "The Trendsetter" - show visual-first layout
- Explain how AI personality adapts too

**Minute 5: Post-Checkout + Chat**
- Go to cart (with items)
- Complete checkout
- Show post-checkout recommendations
- Open AI chat
- Ask: "Which accessory matches my black hoodie?"
- Show inline product cards in chat response

**Closing:**
- "All powered by OpenAI GPT-5.1 and Google Gemini"
- "Demonstrates AI in E-commerce, Agentic Commerce, and Generative UX"
- Questions?

---

## 14. Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gemini API slow/fails | Medium | High | Add timeout, fallback to placeholder image |
| OpenAI rate limits | Low | Medium | Implement request queuing, caching |
| Image generation quality poor | Medium | Medium | Curate prompts, add manual review step |
| Profile switching lag | Low | Low | Optimize re-renders, use React.memo |
| Database migration issues | Low | High | Test migrations in staging first |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API costs exceed budget | Medium | Medium | Set API request limits, cache responses |
| Users don't understand profiles | Medium | Low | Add onboarding tooltip, examples |
| Custom designs don't sell | High | Low | It's a demo feature, track interest |
| Post-checkout feels pushy | Low | Low | Add "No thanks" option prominently |

---

## 15. Future Enhancements (Post-Demo)

### Phase 2 Features

1. **Social Shopping**
   - Share custom designs on social media
   - Collaborative cart (shop with friends)
   - AI-powered gift finder

2. **Advanced Personalization**
   - User accounts with saved preferences
   - Purchase history-based recommendations
   - Seasonal trend predictions

3. **AR Try-On**
   - Virtual hoodie try-on with camera
   - AI-powered fit recommendations

4. **Voice Commerce**
   - Full voice shopping experience
   - Voice-controlled custom design

5. **Multi-Modal AI**
   - Search by image (find similar hoodies)
   - Video content analysis (style matching)

---

## 16. Resources & References

### Documentation
- OpenAI API: https://platform.openai.com/docs
- Google Gemini: https://ai.google.dev/docs
- tRPC: https://trpc.io/docs
- AG-UI: https://docs.ag-ui.com
- MCP: https://docs.anthropic.com/en/docs/mcp

### Code Examples
- Existing implementation: All in `src/` directory
- Test examples: `src/**/*.test.ts`

### Design Assets
- Lucide Icons: https://lucide.dev
- shadcn/ui: https://ui.shadcn.com

---

## Conclusion

This comprehensive plan transforms Hoodtopia into a cutting-edge AI-powered e-commerce platform demonstrating the latest in Agentic Commerce and Generative UX. With 5 major feature areas, phased implementation over 4-6 weeks, and a clear demo strategy, this will be an impressive showcase for the LangChain Stockholm Meetup.

**Key Differentiators:**
1. **Multi-step AI refinement** - Not just one-shot recommendations
2. **Context-aware post-purchase** - Smart upselling
3. **AI-generated custom products** - True personalization at scale
4. **Adaptive UX with profiles** - Different experience for different shoppers
5. **Rich AI interactions** - Beyond text-only chat

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1: Foundation
4. Iterate weekly with demo checkpoints

Let's build something amazing! 🚀
