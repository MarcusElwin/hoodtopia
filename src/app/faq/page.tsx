"use client";

import { useState } from "react";
import { Metadata } from "next";
import { ChevronDown, Sparkles, Truck, CreditCard, Shirt, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    category: "AI Features",
    icon: Sparkles,
    questions: [
      {
        q: "How does the AI shopping assistant work?",
        a: "Our AI shopping assistant uses advanced language models to understand your preferences and recommend the perfect hoodie for you. Simply describe what you're looking for - whether it's a style, occasion, or specific features - and our AI will analyze our catalog to find the best matches.",
      },
      {
        q: "Is the AI recommendation accurate?",
        a: "Our AI is trained to understand hoodie preferences and matches products based on features, materials, and use cases. While recommendations are highly accurate, we encourage you to review product details and use our 30-day return policy if a product doesn't meet your expectations.",
      },
      {
        q: "Is my conversation with the AI private?",
        a: "Yes, your conversations are private and secure. We use your chat history only during your session to provide better recommendations. Data may be used anonymously to improve our AI models.",
      },
    ],
  },
  {
    category: "Products",
    icon: Shirt,
    questions: [
      {
        q: "What sizes do you offer?",
        a: "We offer sizes from XS to XXL across all our hoodie styles. Each product page includes a detailed size guide with measurements. If you're between sizes, check the product description - some styles run true to size while others have a relaxed fit.",
      },
      {
        q: "What materials are your hoodies made from?",
        a: "Our hoodies are made from premium materials including cotton blends, technical fleece, and performance fabrics. Each product listing includes detailed material information. Our Classic Comfort Hoodie uses 80% cotton/20% polyester, while our Tech Fleece Pro uses advanced moisture-wicking materials.",
      },
      {
        q: "How do I care for my hoodie?",
        a: "For best results, machine wash cold with like colors and tumble dry low. Avoid bleach and fabric softeners. Some technical fabrics may have specific care instructions listed on the product page.",
      },
      {
        q: "Do you sell accessories?",
        a: "Yes! We offer a range of accessories including enamel pins, iron-on patches, and sticker packs featuring our Hoodtopia designs. These are perfect for customizing your hoodies or adding to your collection.",
      },
    ],
  },
  {
    category: "Shipping",
    icon: Truck,
    questions: [
      {
        q: "Do you offer free shipping?",
        a: "Yes! We offer free standard shipping on all orders worldwide. Express shipping is available for $12.99 if you need your order faster.",
      },
      {
        q: "How long does shipping take?",
        a: "Standard shipping takes 5-7 business days within the US, 7-14 days internationally. Express shipping delivers in 2-3 business days. All orders include tracking.",
      },
      {
        q: "Do you ship internationally?",
        a: "Yes, we ship to over 100 countries worldwide with free standard shipping. Delivery times vary by region - typically 7-14 business days for most international destinations.",
      },
      {
        q: "Can I track my order?",
        a: "Absolutely! Once your order ships, you'll receive an email with tracking information. You can track your package at any time using the link provided.",
      },
    ],
  },
  {
    category: "Orders & Payment",
    icon: CreditCard,
    questions: [
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay. All transactions are securely processed.",
      },
      {
        q: "Can I modify or cancel my order?",
        a: "Orders can be modified or cancelled within 1 hour of placement. After that, orders enter processing and cannot be changed. Contact us immediately if you need to make changes.",
      },
      {
        q: "What is your return policy?",
        a: "We offer a 30-day return policy for all unworn items with tags attached. Returns are free for US customers - we'll provide a prepaid shipping label. International returns are the customer's responsibility.",
      },
      {
        q: "How do exchanges work?",
        a: "Need a different size? Request an exchange through your account and we'll ship the new size for free once we receive your return. We can also exchange for a different color or style if in stock.",
      },
    ],
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-4 text-left hover:text-primary transition-colors"
      >
        <span className="font-medium pr-4">{question}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all",
          isOpen ? "max-h-96 pb-4" : "max-h-0"
        )}
      >
        <p className="text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Find answers to common questions about our products, AI features, shipping, and more.
          </p>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto space-y-12">
          {faqs.map((section) => (
            <div key={section.category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">{section.category}</h2>
              </div>
              <div className="rounded-lg border bg-card">
                {section.questions.map((faq, index) => (
                  <FAQItem key={index} question={faq.q} answer={faq.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Still Have Questions */}
        <div className="mt-16 max-w-3xl mx-auto">
          <div className="p-8 rounded-lg border bg-card text-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Still Have Questions?</h3>
            <p className="text-muted-foreground mb-6">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Contact Support
              </a>
              <a
                href="/products?tab=ai"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border font-medium hover:bg-secondary transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Ask Our AI
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-secondary/30 rounded-lg text-sm text-muted-foreground max-w-3xl mx-auto">
          <strong>Note:</strong> This is a demo application for the LangChain Stockholm Meetup.
        </div>
      </div>
    </div>
  );
}
