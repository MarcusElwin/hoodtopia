import { ChatOpenAI } from "@langchain/openai";
import {
  RecommendationsResponseSchema,
  SearchResultsSchema,
  type Message,
  type ProductForAI,
  type RecommendationWithProduct,
} from "./schemas";

// Model to use - GPT-5.1 for best structured outputs support
const MODEL = "gpt-5.1";

// Initialize LangChain ChatOpenAI client
const chatModel = new ChatOpenAI({
  model: MODEL,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
});


// ============================================
// SYSTEM PROMPT BUILDER
// ============================================

function buildSystemPrompt(products: ProductForAI[]): string {
  const productCatalog = products
    .map((p) => {
      const features = p.features ? JSON.parse(p.features).join(", ") : "N/A";
      return `**${p.name}** ($${(p.basePrice / 100).toFixed(2)})
  - Category: ${p.category}
  - Description: ${p.description}
  - Material: ${p.material || "N/A"}
  - Features: ${features}`;
    })
    .join("\n\n");

  return `You are a helpful AI shopping assistant for Hoodtopia, a premium online hoodie store.

## Your Personality
- Friendly, knowledgeable, and genuinely helpful
- Passionate about helping customers find their perfect hoodie
- You explain your reasoning - don't just list products
- Ask clarifying questions when helpful

## Available Products
${productCatalog}

## Rules
1. ONLY recommend products from the catalog above - never make up products
2. When recommending, explain WHY each product fits the customer's needs
3. If asked about products we don't carry (t-shirts, pants, etc.), politely say we specialize in hoodies
4. For sizing questions, ask about fit preference (relaxed, fitted, true-to-size)
5. Highlight specific features that match their requirements
6. Be honest about limitations - if nothing fits perfectly, say so
7. Prices are in USD

## Response Guidelines
- Keep responses concise but helpful (2-4 sentences for simple queries)
- Use bullet points when comparing multiple products
- Always mention price when recommending products
- End with a question to continue the conversation when appropriate`;
}

// ============================================
// CORE AI FUNCTIONS
// ============================================

/**
 * Chat with AI assistant - conversational interface
 */
export async function chatWithAssistant(
  messages: Message[],
  products: ProductForAI[]
): Promise<string> {
  try {
    const formattedMessages = [
      { role: "system" as const, content: buildSystemPrompt(products) },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const response = await chatModel.invoke(formattedMessages);

    return response.content as string || "I apologize, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Chat error:", error);
    throw new Error("Failed to get AI response");
  }
}

/**
 * Get structured product recommendations using Zod schema
 */
export async function getProductRecommendations(
  preferences: string,
  products: ProductForAI[]
): Promise<{
  recommendations: RecommendationWithProduct[];
  followUpQuestion?: string;
}> {
  const productContext = products
    .map((p) => ({
      name: p.name,
      price: `$${(p.basePrice / 100).toFixed(2)}`,
      category: p.category,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
    }));

  try {
    // Use LangChain's with_structured_output for structured responses
    const structuredModel = chatModel.withStructuredOutput(RecommendationsResponseSchema);

    const systemPrompt = `You are a product recommendation engine for Hoodtopia hoodie store.

Available products:
${JSON.stringify(productContext, null, 2)}

Analyze the user's preferences and return 1-3 product recommendations.
- Only recommend products from the available list
- Match product names EXACTLY as they appear in the list
- Provide a confidence score (0-1) based on how well the product matches
- Highlight specific features that match the request
- Optionally suggest a follow-up question to refine recommendations`;

    const result = await structuredModel.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: preferences },
    ]);

    if (!result || !result.recommendations) {
      throw new Error("Failed to parse AI response");
    }

    // Match AI product names to actual database products
    const recommendationsWithProducts: RecommendationWithProduct[] =
      result.recommendations
        .map((rec: { productName: string; reason: string; confidence: number; highlightedFeatures: string[] }) => {
          const matchedProduct = products.find(
            (p) => p.name.toLowerCase() === rec.productName.toLowerCase()
          );
          return {
            ...rec,
            product: matchedProduct,
          };
        })
        .filter((rec: { product?: ProductForAI }) => rec.product); // Filter out any hallucinated products

    return {
      recommendations: recommendationsWithProducts,
      followUpQuestion: result.followUpQuestion,
    };
  } catch (error) {
    console.error("Recommendation error:", error);
    throw new Error("Failed to get AI recommendations");
  }
}

/**
 * AI-powered semantic search using Zod schema
 */
export async function searchProductsWithAI(
  query: string,
  products: ProductForAI[]
): Promise<ProductForAI[]> {
  const productNames = products.map((p) => p.name);

  try {
    // Use LangChain's with_structured_output for structured responses
    const structuredModel = chatModel.withStructuredOutput(SearchResultsSchema);

    const systemPrompt = `You are a search engine for Hoodtopia hoodie store.

Available products: ${productNames.join(", ")}

Given a search query:
1. Determine if the query is relevant to hoodies or our products
2. If relevant, return the names of matching products (exact names from the list)
3. If not relevant (e.g., "pizza recipes"), return empty array and isRelevant: false

Consider semantic meaning, not just keyword matching.
For example:
- "warm" → products with thermal/winter features
- "gym" → athletic/performance products
- "casual" → everyday comfort products`;

    const result = await structuredModel.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ]);

    if (!result || !result.isRelevant) {
      return [];
    }

    // Match to actual products
    return products.filter((p) =>
      result.productNames.some(
        (name: string) => name.toLowerCase() === p.name.toLowerCase()
      )
    );
  } catch (error) {
    console.error("Search error:", error);
    throw new Error("Failed to perform AI search");
  }
}
