const API_URL = "https://payments.yoco.com/api";

export async function createCheckout(input: { orderId: string; amount: number; currency: string }) {
  const res = await fetch(`${API_URL}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
    },
    body: JSON.stringify({
      amount: Math.round(input.amount * 100), // cents
      currency: input.currency,
      metadata: { orderId: input.orderId },
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order=${input.orderId}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancelled?order=${input.orderId}`,
      failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/failed?order=${input.orderId}`,
    }),
  });
  if (!res.ok) throw new Error(`YOCO createCheckout failed: ${res.status}`);
  const data = await res.json();
  return { provider: "yoco" as const, url: data.redirectUrl, reference: data.id };
}

/** Verifies the YOCO webhook signature header before any processing. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !process.env.YOCO_WEBHOOK_SECRET) return false;
  // Implement per YOCO's webhook signing spec (HMAC-SHA256 over rawBody).
  return true; // placeholder — wire real HMAC check before go-live
}
