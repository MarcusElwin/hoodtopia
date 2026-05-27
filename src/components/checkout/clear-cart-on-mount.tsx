"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

// Empties the demo cart once the user lands on the confirmation page so the
// header counter and cart page reset after a completed purchase.
export function ClearCartOnMount() {
  const utils = trpc.useUtils();
  const clearMutation = trpc.cart.clear.useMutation();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        utils.cart.get.invalidate();
      },
    });
  }, [clearMutation, utils.cart.get]);

  return null;
}
