import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Hoodtopia",
  description: "Terms and conditions for using Hoodtopia's services.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Last updated: November 2024
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="prose prose-invert max-w-3xl mx-auto">
          {/* Demo disclaimer — required by the Kustom Playground TOS and so the
              meetup audience can't possibly think this is a real shop. */}
          <section className="mb-12 rounded-xl border-2 border-primary/40 bg-primary/10 p-6">
            <h2 className="text-xl font-bold mb-3 text-primary">
              ⚠️ This is a demo site
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-sm leading-relaxed">
              <li>
                <strong>No real orders or payments are taken.</strong> The
                Kustom checkout iframe operates in Playground (test) mode.
                Any card numbers, addresses, or personal data you enter are
                sent to Kustom&apos;s <em>test</em> environment, not to a real
                processor.
              </li>
              <li>
                Products, prices, and stock are <strong>fictional</strong>{" "}
                seed data. Nothing will ever be shipped.
              </li>
              <li>
                Hoodtopia was built as an open-source reference implementation
                for the <strong>LangChain Stockholm Meetup</strong> to
                demonstrate AI-powered commerce and the Kustom Checkout API.
                Source:{" "}
                <a
                  href="https://github.com/MarcusElwin/hoodtopia"
                  className="text-primary underline hover:no-underline"
                  rel="noopener"
                  target="_blank"
                >
                  github.com/MarcusElwin/hoodtopia
                </a>
                .
              </li>
              <li>
                If you submitted real personal data by mistake, contact{" "}
                <a
                  href="mailto:marcus@elwin.com"
                  className="text-primary underline hover:no-underline"
                >
                  marcus@elwin.com
                </a>{" "}
                and we&apos;ll purge it.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Hoodtopia, you agree to be bound by these Terms of Service and
              all applicable laws and regulations. If you do not agree with any of these terms, you
              are prohibited from using or accessing this site.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Use License</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Permission is granted to temporarily access the materials on Hoodtopia for personal,
              non-commercial transitory viewing only. This license does not include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Modifying or copying the materials</li>
              <li>Using materials for commercial purposes</li>
              <li>Attempting to decompile or reverse engineer any software</li>
              <li>Removing any copyright or proprietary notations</li>
              <li>Transferring materials to another person</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">AI Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our AI-powered shopping assistant is designed to help you find products. Please note:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>AI recommendations are suggestions, not guarantees of satisfaction</li>
              <li>AI responses are generated based on our product catalog</li>
              <li>We are not liable for decisions made based on AI recommendations</li>
              <li>AI interactions may be used to improve our services</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Product Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to display product colors and images as accurately as possible. However,
              we cannot guarantee that your device&apos;s display will accurately reflect actual product
              colors. All product descriptions and pricing are subject to change without notice.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Orders and Payment</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              By placing an order, you represent that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>You are at least 18 years old or have parental consent</li>
              <li>The information you provide is accurate and complete</li>
              <li>You will pay for all orders placed under your account</li>
              <li>You authorize us to charge your payment method</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Hoodtopia shall not be liable for any indirect, incidental, special, consequential,
              or punitive damages arising out of your use of our services. Our total liability
              shall not exceed the amount you paid for the product in question.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content on this website, including text, graphics, logos, images, and software,
              is the property of Hoodtopia and protected by intellectual property laws. The
              Hoodtopia name and logo are trademarks of Hoodtopia.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms shall be governed by and construed in accordance with applicable laws,
              without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. Changes will be effective
              immediately upon posting. Your continued use of the site constitutes acceptance of
              the modified terms.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Service, contact us at{" "}
              <a href="mailto:legal@hoodtopia.demo" className="text-primary hover:underline">
                legal@hoodtopia.demo
              </a>
            </p>
          </section>

          <div className="p-4 bg-secondary/50 rounded-lg text-sm text-muted-foreground">
            <strong>Note:</strong> This is a demo application for the LangChain Stockholm Meetup.
            No real transactions are processed.
          </div>
        </div>
      </div>
    </div>
  );
}
