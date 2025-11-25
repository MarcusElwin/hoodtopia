import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/db";
import {
  chatWithAssistant,
  getProductRecommendations,
  searchProductsWithAI,
} from "@/services/ai";
import { PersonalizationContextSchema } from "@/services/schemas";

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
      })
    )
    .mutation(async ({ input }) => {
      // Get all products for context
      const allProducts = await db.query.products.findMany({
        with: { variants: true },
      });

      const response = await chatWithAssistant(input.messages, allProducts);

      return { message: response };
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
      // Get all products for context
      const allProducts = await db.query.products.findMany({
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
    // Get all products for context
    const allProducts = await db.query.products.findMany({
      with: { variants: true },
    });

    const results = await searchProductsWithAI(input, allProducts);

    return results;
  }),
});
