import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Hoodtopia",
  description: "Our commitment to protecting your privacy and personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Last updated: November 2024
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="prose prose-invert max-w-3xl mx-auto">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              At Hoodtopia, we take your privacy seriously. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you visit our website and use our
              AI-powered shopping services.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Please read this privacy policy carefully. By using our services, you consent to the
              practices described in this policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
            <h3 className="text-lg font-medium mb-2 mt-6">Personal Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may collect personal information that you voluntarily provide when you:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Create an account or make a purchase</li>
              <li>Subscribe to our newsletter</li>
              <li>Contact our customer support</li>
              <li>Interact with our AI shopping assistant</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-6">AI Interaction Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you use our AI-powered features, we collect your queries and preferences to provide
              personalized recommendations. This data helps improve our AI models and your shopping experience.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Process and fulfill your orders</li>
              <li>Provide personalized AI-powered recommendations</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Improve our website and services</li>
              <li>Respond to customer inquiries</li>
              <li>Prevent fraudulent transactions</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your
              personal information. However, no method of transmission over the Internet is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to data processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to enhance your browsing experience,
              analyze site traffic, and personalize content. You can control cookie settings through
              your browser preferences.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:privacy@hoodtopia.demo" className="text-primary hover:underline">
                privacy@hoodtopia.demo
              </a>
            </p>
          </section>

          <div className="p-4 bg-secondary/50 rounded-lg text-sm text-muted-foreground">
            <strong>Note:</strong> This is a demo application for the LangChain Stockholm Meetup.
            No real personal data is collected or stored.
          </div>
        </div>
      </div>
    </div>
  );
}
