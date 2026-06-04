"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatProductGrid } from "./chat-product-card";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/lib/shopper-profiles";
import { useCurrency } from "@/lib/currency";

interface ChatProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  imageUrl: string;
  category: string;
  variantId?: string;
  variantColor?: string;
  variantSize?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  products?: ChatProduct[];
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Good to have you here. Tell me about your wardrobe or the occasion — I'll point you toward something worthy. Style, weight, colour preferences, all useful.",
};

interface AIChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIChatDialog({ open, onOpenChange }: AIChatDialogProps) {
  const { currentProfile } = useProfile();
  const { currency } = useCurrency();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Fetch chat history
  const { data: history } = trpc.ai.getHistory.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Save message mutation
  const saveMessageMutation = trpc.ai.saveMessage.useMutation();

  // Clear history mutation
  const clearHistoryMutation = trpc.ai.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([INITIAL_MESSAGE]);
      utils.ai.getHistory.invalidate();
    },
  });

  // Load history on mount. Syncing local state from a server query is a valid
  // effect use; the lint rule flags the setState.
  useEffect(() => {
    if (history && history.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([INITIAL_MESSAGE, ...history]);
    }
  }, [history]);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        products: data.showProducts ? data.products : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to DB
      saveMessageMutation.mutate({
        role: "assistant",
        content: data.message,
        products: data.showProducts ? data.products : undefined,
      });
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Apologies — something went amiss. Try once more.",
        },
      ]);
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);

    // Save user message to DB
    saveMessageMutation.mutate({
      role: "user",
      content: userMessage,
    });

    // Send to AI
    chatMutation.mutate({
      messages: newMessages.slice(1), // Remove initial greeting
      profileType: currentProfile,
      currency: currency.code,
    });
  };

  const handleClearHistory = () => {
    clearHistoryMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center ai-glow">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-semibold">The Stylist</span>
            </div>
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleClearHistory}
                disabled={clearHistoryMutation.isPending}
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 overflow-hidden" viewportRef={scrollRef}>
          <div className="px-4 py-4 space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    message.role === "user"
                      ? "bg-muted"
                      : "bg-primary/20"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border/50"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2 [&>ul>li]:my-1 [&>ol>li]:my-1 [&_strong]:text-foreground [&_strong]:font-semibold">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      {message.products && message.products.length > 0 && (
                        <ChatProductGrid products={message.products} />
                      )}
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {chatMutation.isPending && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-card border border-border/50">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="px-4 py-4 border-t border-border/50 bg-card/30 backdrop-blur-sm shrink-0"
        >
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about the occasion, or the colour you've been after…"
              className="min-h-[44px] max-h-[120px] resize-none bg-background/50 border-border/50"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || chatMutation.isPending}
              className="shrink-0 h-[44px] w-[44px] ai-glow"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            The Stylist — guidance informed by your preferences. GPT-5.4-mini.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
