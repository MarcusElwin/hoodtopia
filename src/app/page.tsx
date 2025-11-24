import { Hero } from "@/components/home/hero";
import { FeaturedProducts } from "@/components/home/featured-products";
import { FeaturedAccessories } from "@/components/home/featured-accessories";
import { BestSellers } from "@/components/home/best-sellers";
import { AIChatButton } from "@/components/ai/chat-button";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <FeaturedAccessories />
      <BestSellers />
      <AIChatButton />
    </>
  );
}
