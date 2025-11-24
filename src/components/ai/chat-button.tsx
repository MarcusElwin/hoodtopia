"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatDialog } from "./chat-dialog";

export function AIChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg shadow-primary/25 z-50"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="sr-only">Open AI Assistant</span>
      </Button>

      {/* Chat Dialog */}
      <AIChatDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
