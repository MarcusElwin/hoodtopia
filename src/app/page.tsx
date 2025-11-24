import { Hero } from "@/components/home/hero";
import { FeaturedProducts } from "@/components/home/featured-products";
import { AIChatButton } from "@/components/ai/chat-button";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <AIChatButton />
    </>
  );
}
