/**
 * Evolution API (WhatsApp) client. One instance per tenant, one shared
 * webhook endpoint that routes by instance name (Architecture Standard §5).
 * Credentials default to env (single-tenant dev), but every function accepts
 * an override so production call sites can pass the tenant's own
 * `integrations.credentials` (apiUrl/apiKey) instead.
 */
export interface EvolutionConfig {
  apiUrl?: string;
  apiKey?: string;
}

function resolveConfig(cfg?: EvolutionConfig) {
  return {
    baseUrl: cfg?.apiUrl ?? process.env.EVOLUTION_API_URL,
    apiKey: cfg?.apiKey ?? process.env.EVOLUTION_API_KEY,
  };
}

function headers(cfg?: EvolutionConfig) {
  const { apiKey } = resolveConfig(cfg);
  return { "Content-Type": "application/json", apikey: apiKey ?? "" };
}

export async function createInstance(instanceName: string, cfg?: EvolutionConfig) {
  const { baseUrl } = resolveConfig(cfg);
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  });
  if (!res.ok) throw new Error(`Evolution createInstance failed: ${res.status}`);
  return res.json();
}

export async function sendText(instanceName: string, to: string, text: string, cfg?: EvolutionConfig) {
  const { baseUrl } = resolveConfig(cfg);
  const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({ number: to, text }),
  });
  if (!res.ok) throw new Error(`Evolution sendText failed: ${res.status}`);
  return res.json();
}

export async function setWebhook(instanceName: string, webhookUrl: string, cfg?: EvolutionConfig) {
  const { baseUrl } = resolveConfig(cfg);
  const res = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({
      webhook: { url: webhookUrl, events: ["MESSAGES_UPSERT"], webhook_by_events: false },
    }),
  });
  if (!res.ok) throw new Error(`Evolution setWebhook failed: ${res.status}`);
  return res.json();
}

/** Normalizes an inbound Evolution webhook payload into an internal shape. */
export function normalizeInboundMessage(payload: any): {
  instanceName: string;
  from: string;
  text: string | null;
  mediaType: "text" | "image" | "audio" | "document" | null;
  isFromBot: boolean;
} | null {
  const data = payload?.data;
  if (!data) return null;
  const isFromBot = Boolean(data.key?.fromMe);
  const text = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? null;
  const mediaType = data.message?.imageMessage
    ? "image"
    : data.message?.audioMessage
    ? "audio"
    : data.message?.documentMessage
    ? "document"
    : text
    ? "text"
    : null;

  return {
    instanceName: payload.instance,
    from: data.key?.remoteJid?.split("@")[0] ?? "",
    text,
    mediaType,
    isFromBot,
  };
}
