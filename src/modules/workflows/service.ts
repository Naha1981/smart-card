import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";
import { searchProducts } from "@/modules/products/service";
import type { TenantContext } from "@/lib/db/tenant-scope";

const mealPlanSchema = z.object({
  meals: z.array(
    z.object({
      day: z.number(),
      name: z.string(),
      recipe: z.string(),
      ingredients: z.array(z.object({ name: z.string(), quantity: z.string() })),
    })
  ),
  estimatedTotal: z.number(),
});

/**
 * F9 — Recipe & meal engine. Generates a plan, then maps every ingredient to
 * an actual catalog SKU via searchProducts so the basket is fully grounded —
 * never an LLM-invented price.
 */
export async function planMeals(
  ctx: TenantContext,
  args: { people: number; days: number; budget?: number; dietary?: string[] }
) {
  const { object: plan } = await generateObject({
    model: getModel("planning"),
    schema: mealPlanSchema,
    prompt: `Plan ${args.days} day(s) of meals for ${args.people} people.${
      args.budget ? ` Total budget: R${args.budget}.` : ""
    }${args.dietary?.length ? ` Dietary needs: ${args.dietary.join(", ")}.` : ""} Keep recipes simple and use common grocery ingredients.`,
  });

  const groundedMeals = await Promise.all(
    plan.meals.map(async (meal) => ({
      ...meal,
      ingredients: await Promise.all(
        meal.ingredients.map(async (ing) => {
          const matches = await searchProducts(ctx, ing.name, 1);
          return { ...ing, matchedProduct: matches[0] ?? null };
        })
      ),
    }))
  );

  const estimatedTotal = groundedMeals.reduce(
    (sum, meal) =>
      sum +
      meal.ingredients.reduce((s, i) => s + (i.matchedProduct ? Number(i.matchedProduct.price) : 0), 0),
    0
  );

  return { meals: groundedMeals, estimatedTotal, budget: args.budget ?? null };
}
