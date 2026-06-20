import { z } from "zod";

export const storeCheckoutSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        unitPrice: z.number().positive().optional(),
      })
    )
    .min(1),
  payAtPickup: z.boolean().default(false),
  notes: z.string().max(500).optional(),
  paymentReference: z.string().max(120).optional(),
});

export const customerSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
});
