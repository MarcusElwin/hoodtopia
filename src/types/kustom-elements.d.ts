import type { DetailedHTMLProps, HTMLAttributes } from "react";

// Type augmentation for Kustom On-site Elements custom HTML tags.
// Spec: https://docs.kustom.co/contents/checkout/kustom-elements
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "kustom-payment-method-display": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          /** 5-char language-COUNTRY locale (e.g. sv-SE, en-GB). Required. */
          locale: string;
          /** Comma-separated payment method ids to hide. */
          exclude?: string;
        },
        HTMLElement
      >;
      "kustom-express-buttons": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          locale: string;
          amount?: string | number;
          currency?: string;
          "purchase-country"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
