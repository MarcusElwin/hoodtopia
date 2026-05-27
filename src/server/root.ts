import { router } from "./trpc";
import { productsRouter } from "./routers/products";
import { cartRouter } from "./routers/cart";
import { aiRouter } from "./routers/ai";
import { preferencesRouter } from "./routers/preferences";
import { customDesignsRouter } from "./routers/custom-designs";
import { checkoutRouter } from "./routers/checkout";

export const appRouter = router({
  products: productsRouter,
  cart: cartRouter,
  ai: aiRouter,
  preferences: preferencesRouter,
  customDesigns: customDesignsRouter,
  checkout: checkoutRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
