/**
 * Payment abstraction (Architecture Standard §5). Route Handlers and module
 * services call ONLY this file, never a provider SDK directly. Browser
 * redirects are never payment confirmation — only the webhook handlers in
 * app/api/webhooks/{payfast,yoco}/route.ts may call orders.confirmPayment().
 */
import * as payfast from "./payfast/client";
import * as yoco from "./yoco/client";

export type CheckoutProvider = "payfast" | "yoco" | "stripe";

export interface CheckoutLink {
  provider: CheckoutProvider;
  url: string;
  reference: string;
}

const DEFAULT_PROVIDER = (process.env.DEFAULT_PAYMENT_PROVIDER as CheckoutProvider) || "payfast";

export async function createCheckoutLink(input: {
  orderId: string;
  amount: number;
  currency: string;
  provider?: CheckoutProvider;
}): Promise<CheckoutLink> {
  const provider = input.provider ?? DEFAULT_PROVIDER;
  switch (provider) {
    case "yoco":
      return yoco.createCheckout(input);
    case "payfast":
    default:
      return payfast.createCheckout(input);
  }
}
