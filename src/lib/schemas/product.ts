import { z } from "zod";

export const compatSchema = z.object({
  bikeModelId: z.string().uuid(),
  year: z.number().int().min(1980).max(2100),
});

export const productSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  brandId: z.string().uuid().optional(),
  brandName: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  categoryName: z.string().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  compatibilities: z.array(compatSchema).optional(),
});

export const updateProductSchema = productSchema.partial().extend({
  isActive: z.boolean().optional(),
});
