import { z } from 'zod';
import { periodSchema, subScoresSchema, trendLabelSchema } from './common.schemas.js';

// GET /agency/market-scores — une zone avec les 6 sous-scores agence
const agencyZoneTrendSchema = z.record(
  z.string(),
  z.object({
    label: trendLabelSchema.nullable(),
    delta: z.number().nullable(),
  }),
);

export const agencyZoneSchema = z.object({
  zone_id: z.string().uuid(),
  name: z.string(),
  commune_code: z.string(),
  sub_scores: subScoresSchema,
  trends: agencyZoneTrendSchema,
  confidence_score: z.number(),
  score_visibility: z.string(),
});

export const agencyMarketScoresResponseSchema = z.object({
  profile: z.literal('agence_immo'),
  territory_code: z.string(),
  period: periodSchema,
  zones: z.array(agencyZoneSchema),
});

// POST /agency/estimation-context
export const priceRangeSchema = z.object({
  low: z.number(),
  high: z.number(),
});

export const estimationContextResponseSchema = z.object({
  comparable_sales_count: z.number().int(),
  median_price_m2: z.number().nullable(),
  price_range_m2: priceRangeSchema.nullable(),
  trend_period: periodSchema,
  estimation_reliability_score: z.number().min(0).max(100),
  warnings: z.array(z.string()),
});

export type AgencyZone = z.infer<typeof agencyZoneSchema>;
export type AgencyMarketScoresResponse = z.infer<typeof agencyMarketScoresResponseSchema>;
export type PriceRange = z.infer<typeof priceRangeSchema>;
export type EstimationContextResponse = z.infer<typeof estimationContextResponseSchema>;
