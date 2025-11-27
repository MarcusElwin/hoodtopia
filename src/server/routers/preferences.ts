import { z } from "zod";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { router, publicProcedure } from "../trpc";
import { db, userPreferences } from "@/db";

// For demo purposes, we use a fixed session ID
// In production, you'd get this from cookies/auth
const DEMO_SESSION_ID = "demo-session";

export const preferencesRouter = router({
  // Get saved preferences for current session
  get: publicProcedure.query(async () => {
    const preference = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.sessionId, DEMO_SESSION_ID),
    });

    if (!preference) {
      return null;
    }

    return {
      ...preference,
      preferences: JSON.parse(preference.preferences),
    };
  }),

  // Save or update preferences
  save: publicProcedure
    .input(
      z.object({
        preferences: z.string(), // Natural language description of preferences
        categories: z.array(z.string()).optional(),
        priceRange: z
          .object({
            min: z.number(),
            max: z.number(),
          })
          .optional(),
        styles: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if preferences already exist
      const existing = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.sessionId, DEMO_SESSION_ID),
      });

      const preferencesData = {
        description: input.preferences,
        categories: input.categories || [],
        priceRange: input.priceRange,
        styles: input.styles || [],
        savedAt: new Date().toISOString(),
      };

      if (existing) {
        // Update existing
        await db
          .update(userPreferences)
          .set({
            preferences: JSON.stringify(preferencesData),
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.id, existing.id));

        return { success: true, id: existing.id };
      } else {
        // Create new
        const id = uuidv4();
        await db.insert(userPreferences).values({
          id,
          sessionId: DEMO_SESSION_ID,
          preferences: JSON.stringify(preferencesData),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return { success: true, id };
      }
    }),

  // Delete preferences
  clear: publicProcedure.mutation(async () => {
    await db
      .delete(userPreferences)
      .where(eq(userPreferences.sessionId, DEMO_SESSION_ID));

    return { success: true };
  }),
});
