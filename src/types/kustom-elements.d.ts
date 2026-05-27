import type { DetailedHTMLProps, HTMLAttributes } from "react";

// Type augmentation for Kustom On-site Elements custom HTML tags.
// See https://docs.kustom.co/contents/checkout/kustom-elements
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "kustom-payment-method-display": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          amount?: string | number;
          currency?: string;
          locale?: string;
          "purchase-country"?: string;
          "merchant-id"?: string;
          theme?: "default" | "dark";
        },
        HTMLElement
      >;
      "kustom-express-buttons": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          amount?: string | number;
          currency?: string;
          locale?: string;
          "purchase-country"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
