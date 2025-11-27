import { z } from "zod";
import { ne } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { db, products } from "@/db";
import {
  chatWithAssistant,
  getProductRecommendations,
  searchProductsWithAI,
} from "@/services/ai";
import { PersonalizationContextSchema, ShopperProfileTypeSchema } from "@/services/schemas";
import { PROFILES, type ProfileType } from "@/lib/shopper-profiles";

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
      // Get all products for context (exclude custom designs)
      const allProducts = await db.query.products.findMany({
        where: ne(products.category, "custom"),
        with: { variants: true },
      });

      // Get profile config if profile type provided
      const profile = input.profileType ? PROFILES[input.profileType as ProfileType] : null;

      const response = await chatWithAssistant(input.messages, allProducts, profile);

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
    // Get all products for context (exclude custom designs)
    const allProducts = await db.query.products.findMany({
      where: ne(products.category, "custom"),
      with: { variants: true },
    });

    const results = await searchProductsWithAI(input, allProducts);

    return results;
  }),
});
