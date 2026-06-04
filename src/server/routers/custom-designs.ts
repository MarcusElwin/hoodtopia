import { z } from "zod";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { router, publicProcedure, rateLimit } from "../trpc";
import { db, customDesigns } from "@/db";
import {
  generateCustomHoodie,
  refineCustomDesign,
} from "@/services/image-generation";
import {
  CustomDesignInputSchema,
  CustomDesignRefinementSchema,
} from "@/services/schemas";
import {
  createCustomDesignProduct,
  findCustomDesignVariant,
} from "@/lib/commerce/custom-design";
import { addLineItem } from "@/lib/commerce/medusa-cart";
import { getOrCreateCartId, DEMO_SESSION_ID } from "@/lib/commerce/cart-session";

// Fixed price for custom designs: $100. Medusa prices are in major units.
const CUSTOM_DESIGN_PRICE = 10000; // cents (kept for the response)
const CUSTOM_DESIGN_PRICE_MAJOR = 100;

// Image generation (Gemini) is the most expensive call in the app — throttle
// it harder than the text endpoints, per IP.
const imageGenProcedure = publicProcedure.use(
  rateLimit({ name: "customDesigns", limit: 10, windowMs: 60_000 })
);

export const customDesignsRouter = router({
  // Generate a new custom design
  generate: imageGenProcedure
    .input(CustomDesignInputSchema)
    .mutation(async ({ input }) => {
      // Validate input
      if (input.type === "text" && !input.description) {
        throw new Error("Description is required for text-based designs");
      }
      if (input.type === "image" && !input.imageData) {
        throw new Error("Image data is required for image-based designs");
      }

      try {
        // Generate the design using Gemini
        const generatedDesign = await generateCustomHoodie({
          type: input.type,
          imageData: input.imageData,
          description: input.description,
          baseColor: input.baseColor,
          hoodieType: input.hoodieType,
        });

        // Save to database. On Vercel the imageUrl is a base64 data: URL
        // (~2.5MB per generation) — persisting that would bloat Turso rows
        // and every tRPC response that reads back the design. Strip the
        // payload for storage and keep only the URL prefix as a marker;
        // the client gets the full image in the response below.
        // TODO: when we add Vercel Blob, switch to storing the blob URL.
        const isDataUrl = generatedDesign.imageUrl.startsWith("data:");
        const persistedUrl = isDataUrl
          ? "data:placeholder/ephemeral" // marker that the original lived in the response
          : generatedDesign.imageUrl;

        const designId = uuidv4();
        await db.insert(customDesigns).values({
          id: designId,
          sessionId: DEMO_SESSION_ID,
          type: input.type,
          originalInput: input.description || input.imageData || "",
          generatedImageUrl: persistedUrl,
          prompt: generatedDesign.prompt,
          baseColor: input.baseColor,
          refinementHistory: JSON.stringify([]),
          status: "ready",
          createdAt: new Date(),
        });

        return {
          success: true,
          design: {
            id: designId,
            imageUrl: generatedDesign.imageUrl,
            prompt: generatedDesign.prompt,
            baseColor: input.baseColor,
          },
        };
      } catch (error) {
        console.error("Error generating custom design:", error);
        throw new Error("Failed to generate custom design");
      }
    }),

  // Refine an existing design
  refine: imageGenProcedure
    .input(CustomDesignRefinementSchema)
    .mutation(async ({ input }) => {
      // Get the existing design
      const existingDesign = await db.query.customDesigns.findFirst({
        where: eq(customDesigns.id, input.generationId),
      });

      if (!existingDesign) {
        throw new Error("Design not found");
      }

      try {
        // Refine the design
        const refinedDesign = await refineCustomDesign(
          existingDesign.prompt,
          existingDesign.generatedImageUrl,
          input.feedback
        );

        // Update refinement history
        const history = JSON.parse(existingDesign.refinementHistory || "[]");
        history.push({
          feedback: input.feedback,
          timestamp: new Date().toISOString(),
          newPrompt: refinedDesign.prompt,
        });

        // Update the design in database
        await db
          .update(customDesigns)
          .set({
            generatedImageUrl: refinedDesign.imageUrl,
            prompt: refinedDesign.prompt,
            refinementHistory: JSON.stringify(history),
          })
          .where(eq(customDesigns.id, input.generationId));

        return {
          success: true,
          design: {
            id: input.generationId,
            imageUrl: refinedDesign.imageUrl,
            prompt: refinedDesign.prompt,
          },
        };
      } catch (error) {
        console.error("Error refining design:", error);
        throw new Error("Failed to refine design");
      }
    }),

  // Get a design by ID
  getById: publicProcedure.input(z.string()).query(async ({ input }) => {
    const design = await db.query.customDesigns.findFirst({
      where: eq(customDesigns.id, input),
    });

    if (!design) {
      throw new Error("Design not found");
    }

    return design;
  }),

  // Get all designs for current session
  getAll: publicProcedure.query(async () => {
    const designs = await db.query.customDesigns.findMany({
      where: eq(customDesigns.sessionId, DEMO_SESSION_ID),
      orderBy: (customDesigns, { desc }) => [desc(customDesigns.createdAt)],
    });

    return designs;
  }),

  // Add custom design to cart
  addToCart: publicProcedure
    .input(
      z.object({
        designId: z.string(),
        size: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const design = await db.query.customDesigns.findFirst({
        where: eq(customDesigns.id, input.designId),
      });

      if (!design) {
        throw new Error("Design not found");
      }

      // Reuse the Medusa product if this design was already added (avoids
      // duplicate one-off products on a second add-to-cart); otherwise create
      // it via the admin API.
      let variantId = await findCustomDesignVariant(design.id, input.size);
      let productId: string | undefined;
      if (!variantId) {
        const created = await createCustomDesignProduct({
          designId: design.id,
          title: `Custom Design - ${design.type === "text" ? "Text Based" : "Image Based"}`,
          description: `Custom AI-generated hoodie design. ${design.originalInput.substring(0, 100)}`,
          imageUrl: design.generatedImageUrl,
          color: design.baseColor || "Black",
          size: input.size,
          priceMajor: CUSTOM_DESIGN_PRICE_MAJOR,
        });
        variantId = created.variantId;
        productId = created.productId;
      }

      // Add the custom variant to the Medusa cart.
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID);
      await addLineItem(cartId, variantId, 1);

      // Mark the design as in-cart (design records stay in the storefront DB).
      await db
        .update(customDesigns)
        .set({ status: "in_cart" })
        .where(eq(customDesigns.id, input.designId));

      return {
        success: true,
        price: CUSTOM_DESIGN_PRICE,
        productId,
        variantId,
      };
    }),
});
