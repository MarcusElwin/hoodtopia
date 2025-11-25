import { Briefcase, MapPin, Clock, Sparkles, Code, Palette, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIChatButton } from "@/components/ai/chat-button";

const openings = [
  {
    title: "Senior AI Engineer",
    department: "Engineering",
    location: "Stockholm / Remote",
    type: "Full-time",
    icon: Code,
    description: "Help us build the future of AI-powered shopping experiences. Work with LLMs, structured outputs, and agentic commerce.",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Stockholm",
    type: "Full-time",
    icon: Palette,
    description: "Design intuitive, beautiful interfaces that make AI feel natural. Shape how people discover and buy products.",
  },
  {
    title: "Growth Marketing Manager",
    department: "Marketing",
    location: "Remote",
    type: "Full-time",
    icon: TrendingUp,
    description: "Drive customer acquisition and retention. Experiment with AI-powered personalization and marketing automation.",
  },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-background to-background" />

        <div className="relative container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10">
              <Briefcase className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Careers</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Build the Future of
              <span className="block text-blue-500">Commerce</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Join a team that&apos;s reimagining how people shop. We&apos;re combining
              AI, great design, and quality products to create something special.
            </p>
          </div>
        </div>
      </section>

      {/* Why Join */}
      <section className="py-16 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">Why Hoodtopia?</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">100%</div>
                <p className="text-sm text-muted-foreground">Remote-friendly culture</p>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">4-day</div>
                <p className="text-sm text-muted-foreground">Work week (Fridays off)</p>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">Equity</div>
                <p className="text-sm text-muted-foreground">Stock options for all</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-bold">Open Positions</h2>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {openings.length} openings
              </Badge>
            </div>

            <div className="space-y-4">
              {openings.map((job) => (
                <div
                  key={job.title}
                  className="p-6 rounded-2xl bg-secondary/30 border hover:border-primary/50 transition-colors group"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <job.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        <Badge variant="outline" className="w-fit">{job.department}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{job.description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {job.type}
                        </span>
                      </div>
                    </div>
                    <Button className="md:self-center shrink-0">
                      Apply Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Demo Note */}
            <div className="mt-12 p-6 rounded-2xl bg-secondary/50 border text-center">
              <p className="text-sm text-muted-foreground">
                This is a demo page. These job listings are fictional and created for the
                LangChain Stockholm Meetup demonstration.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AIChatButton />
    </div>
  );
}
