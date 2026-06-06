import { z } from 'zod';

export const geocodingResultSchema = z.object({
  label: z.string(),
  score: z.number(),
  commune_code: z.string(),
  commune: z.string(),
  postcode: z.string(),
  type: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const geocodingSearchResponseSchema = z.object({
  results: z.array(geocodingResultSchema),
});

export const geocodingReverseResponseSchema = z.object({
  result: geocodingResultSchema.nullable(),
});

export type GeocodingResult = z.infer<typeof geocodingResultSchema>;
export type GeocodingSearchResponse = z.infer<typeof geocodingSearchResponseSchema>;
export type GeocodingReverseResponse = z.infer<typeof geocodingReverseResponseSchema>;
