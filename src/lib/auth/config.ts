import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/client";

/**
 * Staff authentication (retailer dashboard users). Customer identity on
 * WhatsApp/web chat is channel-native (phone number / session), never
 * routed through this — see modules/chat + lib/integrations/evolution.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // flip on once Resend/SES is wired for MVP go-live
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
