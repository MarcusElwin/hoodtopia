import { router } from "./trpc";
import { productsRouter } from "./routers/products";
import { cartRouter } from "./routers/cart";
import { aiRouter } from "./routers/ai";
import { preferencesRouter } from "./routers/preferences";
import { customDesignsRouter } from "./routers/custom-designs";

export const appRouter = router({
  products: productsRouter,
  cart: cartRouter,
  ai: aiRouter,
  preferences: preferencesRouter,
  customDesigns: customDesignsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
