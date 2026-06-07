import { z } from 'zod';

export const zonePropertiesSchema = z.object({
  zone_id: z.string(),
  name: z.string(),
  global_score: z.number(),
  trend_label: z.string().nullable(),
  score_visibility: z.string(),
  confidence_score: z.number(),
});

export const zoneFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.unknown(),
  properties: zonePropertiesSchema,
});

export const zoneFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(zoneFeatureSchema),
});

export type ZoneProperties = z.infer<typeof zonePropertiesSchema>;
export type ZoneFeature = z.infer<typeof zoneFeatureSchema>;
export type ZoneFeatureCollection = z.infer<typeof zoneFeatureCollectionSchema>;
