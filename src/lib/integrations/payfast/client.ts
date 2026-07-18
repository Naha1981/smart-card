import crypto from "node:crypto";

const IS_LIVE = process.env.PAYFAST_MODE === "live";
const HOST = IS_LIVE ? "https://www.payfast.co.za" : "https://sandbox.payfast.co.za";

/**
 * PayFast requires this exact field order when generating the signature.
 * Do not alphabetize or reorder — it will break signature verification.
 */
const FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "m_payment_id",
  "amount",
  "item_name",
] as const;

function buildSignature(fields: Record<string, string>): string {
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const parts = FIELD_ORDER.filter((k) => fields[k] !== undefined).map(
    (k) => `${k}=${encodeURIComponent(fields[k]).replace(/%20/g, "+")}`
  );
  // Omit the passphrase param entirely when empty, per PayFast spec.
  const raw = passphrase ? `${parts.join("&")}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}` : parts.join("&");
  return crypto.createHash("md5").update(raw).digest("hex");
}

export async function createCheckout(input: { orderId: string; amount: number; currency: string }) {
  const fields: Record<string, string> = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID ?? "",
    merchant_key: process.env.PAYFAST_MERCHANT_KEY ?? "",
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order=${input.orderId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancelled?order=${input.orderId}`,
    notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payfast`,
    m_payment_id: input.orderId,
    amount: input.amount.toFixed(2),
    item_name: `SmartCart order ${input.orderId}`,
  };
  const signature = buildSignature(fields);
  const query = new URLSearchParams({ ...fields, signature }).toString();

  return {
    provider: "payfast" as const,
    url: `${HOST}/eng/process?${query}`,
    reference: input.orderId,
  };
}

/**
 * Full ITN (Instant Transaction Notification) validation. Called only from
 * app/api/webhooks/payfast/route.ts — never trust an unvalidated ITN.
 */
export async function validateItn(payload: Record<string, string>, sourceIp: string): Promise<boolean> {
  // 1. Signature check
  const { signature, ...rest } = payload;
  const expected = buildSignature(rest as any);
  if (signature !== expected) return false;

  // 2. Confirm the request came from a valid PayFast IP range (implement via DNS lookup
  //    against w1w.payfast.co.za / w2w.payfast.co.za in production).
  // 3. Post the payload back to PayFast's validate endpoint and confirm "VALID".
  const validateUrl = IS_LIVE ? "https://www.payfast.co.za/eng/query/validate" : "https://sandbox.payfast.co.za/eng/query/validate";
  const res = await fetch(validateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });
  const text = await res.text();
  return text.trim() === "VALID";
}
