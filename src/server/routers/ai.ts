import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { ne, eq, desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { db, products, chatMessages } from "@/db";
import {
  chatWithAssistant,
  getProductRecommendations,
  searchProductsWithAI,
} from "@/services/ai";
import { PersonalizationContextSchema, ShopperProfileTypeSchema } from "@/services/schemas";
import { PROFILES, type ProfileType } from "@/lib/shopper-profiles";
import {
  runInputGuardrails,
  detectPromptLeak,
  logSafetyEvent,
} from "@/lib/ai/guardrails";

// Demo session ID (in production, use real user sessions)
const DEMO_SESSION_ID = "demo-chat-session";

// Message schema for chat
const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const aiRouter = router({
  // Chat with AI assistant
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(MessageSchema),
        profileType: ShopperProfileTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      // Guardrails — gate the latest user message before hitting the LLM.
      // If the user has somehow sent a message list ending on assistant,
      // we still apply rate-limit but skip pattern/moderation (nothing
      // new to check).
      const latestUser = [...input.messages].reverse().find((m) => m.role === "user");
      if (latestUser) {
        const guard = await runInputGuardrails({
          sessionId: DEMO_SESSION_ID,
          userMessage: latestUser.content,
        });
        if (!guard.allowed) {
          return {
            message: guard.reply,
            showProducts: false,
            products: [],
          };
        }
      }

      // Get all products for context (exclude custom designs)
      const allProducts = await db.query.products.findMany({
        where: ne(products.category, "custom"),
        with: { variants: true },
      });

      // Get profile config if profile type provided
      const profile = input.profileType ? PROFILES[input.profileType as ProfileType] : null;

      const { response, matchedProducts } = await chatWithAssistant(input.messages, allProducts, profile);

      // Output guardrail: if the model echoed the system prompt or our
      // catalog formatting, swap in a generic safe message and log.
      if (detectPromptLeak(response.message)) {
        await logSafetyEvent({
          sessionId: DEMO_SESSION_ID,
          kind: "leak",
          reasons: ["system-prompt-leak"],
          excerpt: response.message,
          blocked: true,
        });
        return {
          message:
            "Sorry, something went wrong with my response. Could you rephrase " +
            "what you're looking for in a hoodie?",
          showProducts: false,
          products: [],
        };
      }

      // Get variants for each product (for add-to-cart with color matching)
      const productsFromDb = await db.query.products.findMany({
        where: (products, { inArray }) =>
          inArray(products.id, matchedProducts.map(mp => mp.product.id)),
        with: { variants: true },
      });

      return {
        message: response.message,
        showProducts: response.showProducts,
        products: matchedProducts.map((mp) => {
          const dbProduct = productsFromDb.find(db => db.id === mp.product.id);
          const variants = dbProduct?.variants ?? [];

          // Find variant matching preferred color, or fall back to first variant
          let selectedVariant = variants[0];
          if (mp.preferredColor) {
            const colorMatch = variants.find(
              v => v.color.toLowerCase() === mp.preferredColor!.toLowerCase()
            );
            if (colorMatch) {
              selectedVariant = colorMatch;
            }
          }

          return {
            id: mp.product.id,
            name: mp.product.name,
            slug: mp.product.slug,
            basePrice: mp.product.basePrice,
            imageUrl: selectedVariant?.imageUrl || mp.product.imageUrl,
            category: mp.product.category,
            variantId: selectedVariant?.id,
            variantColor: selectedVariant?.color,
            variantSize: selectedVariant?.size,
          };
        }),
      };
    }),

  // Get AI-powered product recommendations
  recommend: publicProcedure
    .input(
      z.object({
        preferences: z.string(),
        personalizationContext: PersonalizationContextSchema.optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Same guardrails as chat — preferences string is free-form user
      // input that hits the LLM, so the same risks apply.
      const guard = await runInputGuardrails({
        sessionId: DEMO_SESSION_ID,
        userMessage: input.preferences,
      });
      if (!guard.allowed) {
        return { recommendations: [], followUpQuestion: guard.reply };
      }

      // Get all products for context (exclude custom designs)
      const allProducts = await db.query.products.findMany({
        where: ne(products.category, "custom"),
        with: { variants: true },
      });

      const recommendations = await getProductRecommendations(
        input.preferences,
        allProducts,
        input.personalizationContext
      );

      return recommendations;
    }),

  // AI-powered semantic search
  search: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    // Guardrails on the search query too — semantic search uses the LLM
    // and was the original entry point for jailbreak attempts.
    const guard = await runInputGuardrails({
      sessionId: DEMO_SESSION_ID,
      userMessage: input,
    });
    if (!guard.allowed) {
      return [];
    }

    // Get all products for context (exclude custom designs)
    const allProducts = await db.query.products.findMany({
      where: ne(products.category, "custom"),
      with: { variants: true },
    });

    const results = await searchProductsWithAI(input, allProducts);

    return results;
  }),

  // Get chat history
  getHistory: publicProcedure.query(async () => {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, DEMO_SESSION_ID))
      .orderBy(chatMessages.createdAt);

    return messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      products: m.products ? JSON.parse(m.products) : undefined,
    }));
  }),

  // Save a message to history
  saveMessage: publicProcedure
    .input(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        products: z.array(z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.insert(chatMessages).values({
        id: uuidv4(),
        sessionId: DEMO_SESSION_ID,
        role: input.role,
        content: input.content,
        products: input.products ? JSON.stringify(input.products) : null,
      });

      return { success: true };
    }),

  // Clear chat history
  clearHistory: publicProcedure.mutation(async () => {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, DEMO_SESSION_ID));
    return { success: true };
  }),
});
