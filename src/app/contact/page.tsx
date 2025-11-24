"use client";

import { Mail, MapPin, Phone, Clock, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIChatButton } from "@/components/ai/chat-button";

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />

        <div className="relative container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Contact Us</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Let&apos;s
              <span className="block text-primary">Talk</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Have a question about our products, need help with an order, or just want to say hi?
              We&apos;d love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Content */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-12">
              {/* Contact Info */}
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <h2 className="text-xl font-semibold mb-6">Get in Touch</h2>
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">hello@hoodtopia.demo</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">+46 8 123 456 78</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Address</p>
                        <p className="text-sm text-muted-foreground">
                          Hoodtopia HQ<br />
                          Drottninggatan 89<br />
                          111 60 Stockholm, Sweden
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Hours</p>
                        <p className="text-sm text-muted-foreground">
                          Mon - Fri: 9:00 - 18:00<br />
                          Sat - Sun: Closed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-3">
                <div className="p-6 md:p-8 rounded-2xl bg-secondary/30 border">
                  <h2 className="text-xl font-semibold mb-6">Send a Message</h2>
                  <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">First Name</label>
                        <Input placeholder="John" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Last Name</label>
                        <Input placeholder="Doe" className="bg-background" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input type="email" placeholder="john@example.com" className="bg-background" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input placeholder="How can we help?" className="bg-background" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Message</label>
                      <Textarea
                        placeholder="Tell us more about your inquiry..."
                        className="bg-background min-h-[120px]"
                      />
                    </div>
                    <Button type="submit" className="w-full" size="lg">
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    This is a demo. No messages will be sent.
                  </p>
                </div>
              </div>
            </div>

            {/* Demo Note */}
            <div className="mt-12 p-6 rounded-2xl bg-secondary/50 border text-center">
              <p className="text-sm text-muted-foreground">
                This is a demo page. Hoodtopia is a fictional brand created for the LangChain Stockholm Meetup.
                All contact information is fictional.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AIChatButton />
    </div>
  );
}
