"use client";

import { useEffect, useRef } from "react";

interface KustomSnippetProps {
  html: string;
  className?: string;
}

// Injects Kustom HTML snippets (checkout iframe, confirmation iframe) and re-creates
// <script> tags so they actually execute. innerHTML alone does not execute script tags.
// Recipe from https://docs.kustom.co/contents/checkout/integrate-kco-in-your-ecommerce/render-confirmation-snippet
export function KustomSnippet({ html, className }: KustomSnippetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    container.innerHTML = html;

    const scripts = Array.from(container.getElementsByTagName("script"));
    for (const oldScript of scripts) {
      const newScript = document.createElement("script");
      if (oldScript.src) {
        newScript.src = oldScript.src;
        if (oldScript.async) newScript.async = true;
        if (oldScript.defer) newScript.defer = true;
      } else {
        newScript.text = oldScript.text;
      }
      newScript.type = oldScript.type || "text/javascript";
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    }
  }, [html]);

  return <div ref={containerRef} className={className} />;
}
