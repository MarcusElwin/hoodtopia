"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface Props {
  orderId: string;
}

export function CopyOrderId({ orderId }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <button
      onClick={onCopy}
      title="Copy order ID"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
    >
      <span className="truncate max-w-[200px] sm:max-w-none">{orderId}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500 shrink-0" />
      ) : (
        <Copy className="h-3 w-3 shrink-0" />
      )}
    </button>
  );
}
