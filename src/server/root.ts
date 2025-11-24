import { router } from "./trpc";
import { productsRouter } from "./routers/products";
import { cartRouter } from "./routers/cart";
import { aiRouter } from "./routers/ai";

export const appRouter = router({
  products: productsRouter,
  cart: cartRouter,
  ai: aiRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
