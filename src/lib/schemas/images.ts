import { z } from 'zod';

/** Edits from the image editor; see `ImageEdits` in `src/lib/server/images.ts`. */
export const imageEditsSchema = z.object({
	id: z.string().min(1),
	edits: z.object({
		rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
		flipHorizontal: z.boolean().optional(),
		flipVertical: z.boolean().optional(),
		crop: z
			.object({
				x: z.number().min(0),
				y: z.number().min(0),
				width: z.number().positive(),
				height: z.number().positive()
			})
			.optional(),
		resize: z
			.object({
				width: z.number().int().min(1).max(8000),
				height: z.number().int().min(1).max(8000)
			})
			.optional(),
		adjustments: z
			.object({
				brightness: z.number().min(-100).max(100),
				contrast: z.number().min(-100).max(100),
				saturation: z.number().min(-100).max(100),
				hue: z.number().min(-180).max(180),
				grayscale: z.number().min(0).max(100),
				sepia: z.number().min(0).max(100)
			})
			.partial()
			.optional(),
		output: z
			.object({
				format: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
				quality: z.number().int().min(1).max(100).optional()
			})
			.optional()
	})
});
