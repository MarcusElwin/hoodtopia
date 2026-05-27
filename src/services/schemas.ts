import { z } from "zod";

// ============================================
// ZOD SCHEMAS FOR STRUCTURED AI OUTPUTS
// ============================================

// Shopper Profile Type Schema
export const ShopperProfileTypeSchema = z.enum([
  "minimalist",
  "researcher",
  "trendsetter",
  "budget_hunter",
  "explorer"
]).nullable().optional();

export type ShopperProfileType = z.infer<typeof ShopperProfileTypeSchema>;

// Single recommendation item
export const RecommendationItemSchema = z.object({
  productName: z.string().describe("Exact product name from catalog"),
  reason: z.string().describe("Why this product matches the user's needs"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  highlightedFeatures: z
    .array(z.string())
    .describe("Key features that match the request"),
});

// Full recommendations response
export const RecommendationsResponseSchema = z.object({
  recommendations: z
    .array(RecommendationItemSchema)
    .min(1)
    .max(3)
    .describe("1-3 product recommendations"),
  followUpQuestion: z
    .string()
    .nullable()
    .default(null)
    .describe("Optional follow-up question to refine recommendations"),
});

// Search results schema
export const SearchResultsSchema = z.object({
  productNames: z
    .array(z.string())
    .describe("Matching product names from catalog"),
  isRelevant: z
    .boolean()
    .describe("Whether the query is relevant to hoodies/our products"),
  searchIntent: z
    .string()
    .nullable()
    .default(null)
    .describe("Interpreted user intent from search query"),
});

// Type exports from Zod schemas
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;
export type RecommendationsResponse = z.infer<
  typeof RecommendationsResponseSchema
>;
export type SearchResults = z.infer<typeof SearchResultsSchema>;

// Message type for chat
export interface Message {
  role: "user" | "assistant";
  content: string;
}

// Product type for AI context (simplified)
export interface ProductForAI {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  category: string;
  material: string | null;
  features: string | null;
  variants?: Array<{
    id: string;
    color: string;
    size: string;
    stock: number;
  }>;
}

// Recommendation with matched product
export interface RecommendationWithProduct extends RecommendationItem {
  product?: ProductForAI;
}

// Personalization context schema
export const PersonalizationContextSchema = z.object({
  viewedProducts: z.array(z.string().max(200)).max(100).describe("Names of recently viewed products"),
  viewedCategories: z.array(z.string().max(100)).max(50).describe("Categories user has browsed"),
  timeSpent: z.number().describe("Total time spent browsing in seconds"),
  mostViewedProduct: z.string().max(200).nullable().default(null).describe("Most frequently viewed product"),
  preferredCategory: z.string().max(100).nullable().default(null).describe("Most viewed category"),
});

export type PersonalizationContext = z.infer<typeof PersonalizationContextSchema>;

// Cart recommendation item
export const CartRecommendationItemSchema = z.object({
  productName: z.string().describe("Exact product name from catalog"),
  reason: z.string().describe("Why this complements items in cart"),
  complementType: z.enum(["accessory", "matching", "complete-look"]).describe("Type of complement"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
});

// Cart recommendations response
export const CartRecommendationsResponseSchema = z.object({
  recommendations: z
    .array(CartRecommendationItemSchema)
    .min(3)
    .max(5)
    .describe("3-5 complementary product recommendations"),
  cartAnalysis: z
    .string()
    .describe("Brief analysis of cart contents and recommendation strategy"),
});

export type CartRecommendationItem = z.infer<typeof CartRecommendationItemSchema>;
export type CartRecommendationsResponse = z.infer<typeof CartRecommendationsResponseSchema>;

// Cart recommendation with matched product
export interface CartRecommendationWithProduct extends CartRecommendationItem {
  product?: ProductForAI;
}

// Chat response schema with inline product recommendations
export const ChatProductRecommendationSchema = z.object({
  productName: z.string().describe("Exact product name from catalog"),
  reason: z.string().describe("Brief reason why this product is recommended"),
  preferredColor: z.string().nullable().default(null).describe("Preferred color based on user request (e.g., 'Burgundy', 'Navy', 'Black'). Use null if no specific color mentioned."),
});

export const ChatResponseSchema = z.object({
  message: z.string().describe("The conversational response to the user"),
  recommendedProducts: z
    .array(ChatProductRecommendationSchema)
    .default([])
    .describe("Products to display as cards (0-3 products). Only include when actively recommending products."),
  showProducts: z
    .boolean()
    .default(false)
    .describe("Whether to display product cards. Set to true only when recommending specific products."),
});

export type ChatProductRecommendation = z.infer<typeof ChatProductRecommendationSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// Custom design input schema. Length caps bound the payload handed to the
// (paid) image model and the row we persist; imageData is base64 so its cap is
// generous (~20MB encoded) but still finite.
export const CustomDesignInputSchema = z.object({
  type: z.enum(["image", "text"]),
  imageData: z.string().max(20_000_000).optional(),
  description: z.string().max(2000).optional(),
  baseColor: z.string().max(64).default("Black"),
  hoodieType: z.string().max(64).default("pullover"),
});

export type CustomDesignInput = z.infer<typeof CustomDesignInputSchema>;

// Custom design refinement schema
export const CustomDesignRefinementSchema = z.object({
  generationId: z.string().max(128),
  feedback: z.string().min(1, "Feedback is required").max(2000),
});

export type CustomDesignRefinement = z.infer<typeof CustomDesignRefinementSchema>;
