/**
 * Tool registry (Architecture Standard §3.4, PRD §9).
 * Every tool is Zod-typed, permission-checked per tenant, and audited via
 * the event bus. This is the ONLY path by which the AI touches application
 * data — grounded-by-construction: the model composes language, never facts.
 *
 * Business rules live in the module services these tools call, never here.
 */
import { tool } from "ai";
import { z } from "zod";
import type { TenantContext } from "@/lib/db/tenant-scope";
import * as productsService from "@/modules/products/service";
import * as ordersService from "@/modules/orders/service";
import * as chatService from "@/modules/chat/service";
import * as workflowsService from "@/modules/workflows/service";

export function buildToolRegistry(ctx: TenantContext) {
  return {
    searchProducts: tool({
      description: "Hybrid full-text + semantic search over the tenant's live catalog.",
      parameters: z.object({
        query: z.string().describe("Natural-language product query, e.g. 'low sugar cereal'"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ query, limit }) => productsService.searchProducts(ctx, query, limit),
    }),

    getPrice: tool({
      description: "Get the current live price for a specific product by ID or SKU.",
      parameters: z.object({ productId: z.string() }),
      execute: async ({ productId }) => productsService.getPrice(ctx, productId),
    }),

    checkStock: tool({
      description: "Check live stock availability for a product, optionally at a specific store.",
      parameters: z.object({ productId: z.string(), storeId: z.string().optional() }),
      execute: async ({ productId, storeId }) => productsService.checkStock(ctx, productId, storeId),
    }),

    getPromotions: tool({
      description: "Get currently active promotions, optionally scoped to a product or category.",
      parameters: z.object({ productId: z.string().optional(), category: z.string().optional() }),
      execute: async ({ productId, category }) => productsService.getActivePromotions(ctx, { productId, category }),
    }),

    buildCart: tool({
      description: "Construct or update the customer's active cart with the given line items.",
      parameters: z.object({
        conversationId: z.string(),
        items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1) })),
      }),
      execute: async ({ conversationId, items }) => ordersService.buildCart(ctx, conversationId, items),
    }),

    applyLoyalty: tool({
      description: "Look up and apply the customer's loyalty balance to their active cart.",
      parameters: z.object({ customerId: z.string(), cartId: z.string() }),
      execute: async ({ customerId, cartId }) => ordersService.applyLoyalty(ctx, customerId, cartId),
    }),

    createCheckout: tool({
      description: "Create a payment checkout link for the customer's cart via the tenant's configured provider.",
      parameters: z.object({ cartId: z.string() }),
      execute: async ({ cartId }) => ordersService.createCheckout(ctx, cartId),
    }),

    getOrderStatus: tool({
      description: "Get the status of a previously placed order.",
      parameters: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => ordersService.getOrderStatus(ctx, orderId),
    }),

    escalateToHuman: tool({
      description: "Hand the conversation off to a human agent. Use when the customer asks for a person, or the AI cannot ground an answer confidently.",
      parameters: z.object({ conversationId: z.string(), reason: z.string() }),
      execute: async ({ conversationId, reason }) => chatService.escalateToHuman(ctx, conversationId, reason),
    }),

    saveList: tool({
      description: "Save the current set of items as a named list for the customer to reorder later.",
      parameters: z.object({ customerId: z.string(), name: z.string(), items: z.array(z.string()) }),
      execute: async ({ customerId, name, items }) => chatService.saveList(ctx, customerId, name, items),
    }),

    planMeals: tool({
      description: "Generate a catalog-grounded meal plan constrained by budget, people count, and dietary needs.",
      parameters: z.object({
        people: z.number().int().min(1),
        days: z.number().int().min(1).max(14),
        budget: z.number().positive().optional(),
        dietary: z.array(z.string()).optional(),
      }),
      execute: async (args) => workflowsService.planMeals(ctx, args),
    }),
  };
}
