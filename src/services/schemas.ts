import { z } from "zod";

// ============================================
// ZOD SCHEMAS FOR STRUCTURED AI OUTPUTS
// ============================================

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
  category: string;
  material: string | null;
  features: string | null;
}

// Recommendation with matched product
export interface RecommendationWithProduct extends RecommendationItem {
  product?: ProductForAI;
}

// Personalization context schema
export const PersonalizationContextSchema = z.object({
  viewedProducts: z.array(z.string()).describe("Names of recently viewed products"),
  viewedCategories: z.array(z.string()).describe("Categories user has browsed"),
  timeSpent: z.number().describe("Total time spent browsing in seconds"),
  mostViewedProduct: z.string().nullable().default(null).describe("Most frequently viewed product"),
  preferredCategory: z.string().nullable().default(null).describe("Most viewed category"),
});

export type PersonalizationContext = z.infer<typeof PersonalizationContextSchema>;
