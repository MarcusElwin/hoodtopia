import { Metadata } from "next";
import { Truck, Globe, Clock, Package, RefreshCw, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Shipping & Returns | Hoodtopia",
  description: "Information about our shipping options, delivery times, and return policy.",
};

export default function ShippingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Shipping & Returns
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Free worldwide shipping on all orders. Easy returns within 30 days.
          </p>
        </div>
      </div>

      {/* Shipping Options */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl font-semibold mb-8">Shipping Options</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-lg border bg-card">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Standard Shipping</h3>
            <p className="text-2xl font-bold text-primary mb-2">FREE</p>
            <p className="text-sm text-muted-foreground">
              5-7 business days. Available on all orders.
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Express Shipping</h3>
            <p className="text-2xl font-bold mb-2">$12.99</p>
            <p className="text-sm text-muted-foreground">
              2-3 business days. Order by 2pm for same-day dispatch.
            </p>
          </div>

          <div className="p-6 rounded-lg border bg-card">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">International</h3>
            <p className="text-2xl font-bold text-primary mb-2">FREE</p>
            <p className="text-sm text-muted-foreground">
              7-14 business days. We ship to over 100 countries.
            </p>
          </div>
        </div>

        {/* Delivery Information */}
        <div className="max-w-3xl mb-16">
          <h2 className="text-2xl font-semibold mb-6">Delivery Information</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              All orders are processed within 1-2 business days. Orders placed on weekends or
              holidays will be processed on the next business day.
            </p>
            <p>
              Once your order ships, you&apos;ll receive a confirmation email with tracking information.
              You can track your package at any time through the link provided.
            </p>
            <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Delivery Times by Region</h3>
            <ul className="space-y-2">
              <li><strong>United States:</strong> 3-7 business days</li>
              <li><strong>Canada:</strong> 5-10 business days</li>
              <li><strong>Europe:</strong> 5-12 business days</li>
              <li><strong>Asia Pacific:</strong> 7-14 business days</li>
              <li><strong>Rest of World:</strong> 10-21 business days</li>
            </ul>
          </div>
        </div>

        {/* Returns Section */}
        <div className="border-t pt-16">
          <h2 className="text-2xl font-semibold mb-8">Returns & Exchanges</h2>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-lg border bg-card">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">30-Day Returns</h3>
              <p className="text-sm text-muted-foreground">
                Not happy? Return any unworn item within 30 days for a full refund.
              </p>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Free Return Shipping</h3>
              <p className="text-sm text-muted-foreground">
                We provide a prepaid return label for all domestic returns.
              </p>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Easy Exchanges</h3>
              <p className="text-sm text-muted-foreground">
                Wrong size? Exchange for free - we&apos;ll ship the new size right away.
              </p>
            </div>
          </div>

          <div className="max-w-3xl">
            <h3 className="text-lg font-medium mb-4">Return Policy Details</h3>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Items must be returned in their original condition with tags attached. We cannot
                accept returns on worn, washed, or damaged items.
              </p>
              <h4 className="font-medium text-foreground mt-6">How to Return:</h4>
              <ol className="list-decimal list-inside space-y-2">
                <li>Log into your account and request a return</li>
                <li>Print the prepaid return label</li>
                <li>Pack items securely in original packaging</li>
                <li>Drop off at any authorized shipping location</li>
                <li>Refund processed within 5-7 business days of receipt</li>
              </ol>
              <h4 className="font-medium text-foreground mt-6">Non-Returnable Items:</h4>
              <ul className="list-disc list-inside space-y-2">
                <li>Items marked as &quot;Final Sale&quot;</li>
                <li>Gift cards</li>
                <li>Personalized or custom items</li>
                <li>Items without original tags</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="mt-16 p-6 bg-secondary/50 rounded-lg max-w-3xl">
          <h3 className="font-semibold mb-2">Need Help?</h3>
          <p className="text-muted-foreground">
            Questions about shipping or returns? Contact our support team at{" "}
            <a href="mailto:support@hoodtopia.demo" className="text-primary hover:underline">
              support@hoodtopia.demo
            </a>{" "}
            or visit our{" "}
            <a href="/faq" className="text-primary hover:underline">FAQ page</a>.
          </p>
        </div>

        <div className="mt-8 p-4 bg-secondary/30 rounded-lg text-sm text-muted-foreground max-w-3xl">
          <strong>Note:</strong> This is a demo application for the LangChain Stockholm Meetup.
          No real shipping or returns are processed.
        </div>
      </div>
    </div>
  );
}
