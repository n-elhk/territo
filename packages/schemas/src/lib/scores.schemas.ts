import { z } from 'zod';
import { periodSchema, scoreTypeSchema, scoredZoneSchema, subScoresSchema, trendLabelSchema } from './common.schemas.js';

// POST /scores/local
export const localScoreAreaSchema = scoredZoneSchema.extend({
  distance_km: z.number(),
  explanation: z.array(z.string()),
});

export const localScoreResponseSchema = z.object({
  trade: z.string(),
  radius_km: z.number(),
  areas: z.array(localScoreAreaSchema),
});

// GET /territory-benchmark
export const benchmarkZoneSchema = scoredZoneSchema.extend({
  zone_type: z.string(),
});

export const territoryBenchmarkResponseSchema = z.object({
  territory_code: z.string(),
  score_type: scoreTypeSchema,
  period: periodSchema,
  zone_level: z.string(),
  zones: z.array(benchmarkZoneSchema),
});

// GET /zones/:id/scores
export const zoneScoreDetailSchema = z.object({
  zone: z.object({
    id: z.string().uuid(),
    name: z.string(),
    zone_type: z.string(),
    commune_code: z.string(),
  }),
  score_type: scoreTypeSchema,
  trade: z.string().nullable(),
  period: periodSchema,
  global_score: z.number(),
  confidence_score: z.number(),
  score_visibility: z.string(),
  trend: z.object({
    label: trendLabelSchema.nullable(),
    delta_previous_period: z.number().nullable(),
    delta_year: z.number().nullable(),
  }),
  sub_scores: subScoresSchema,
  quality_warnings: z.array(z.string()),
  explanation: z.array(z.string()),
});

// GET /zones/:id/score-history
export const scoreHistoryPointSchema = z.object({
  date: z.coerce.date(),
  global_score: z.number(),
  sub_scores: subScoresSchema,
});

export const scoreHistoryResponseSchema = z.object({
  zone: z.object({ id: z.string().uuid(), name: z.string() }),
  score_type: scoreTypeSchema,
  trade: z.string().nullable(),
  period: periodSchema,
  series: z.array(scoreHistoryPointSchema),
});

// GET /zones/rising
export const risingZoneSchema = z.object({
  zone_id: z.string().uuid(),
  name: z.string(),
  commune_code: z.string(),
  global_score: z.number(),
  delta: z.number(),
  trend_label: trendLabelSchema.nullable(),
  confidence_score: z.number(),
  score_visibility: z.string(),
  trade: z.string().nullable(),
});

export const risingZonesResponseSchema = z.object({
  territory_code: z.string(),
  score_type: scoreTypeSchema,
  period: periodSchema,
  zones: z.array(risingZoneSchema),
});

export type LocalScoreArea = z.infer<typeof localScoreAreaSchema>;
export type LocalScoreResponse = z.infer<typeof localScoreResponseSchema>;
export type BenchmarkZone = z.infer<typeof benchmarkZoneSchema>;
export type TerritoryBenchmarkResponse = z.infer<typeof territoryBenchmarkResponseSchema>;
export type ZoneScoreDetail = z.infer<typeof zoneScoreDetailSchema>;
export type ScoreHistoryPoint = z.infer<typeof scoreHistoryPointSchema>;
export type ScoreHistoryResponse = z.infer<typeof scoreHistoryResponseSchema>;
export type RisingZone = z.infer<typeof risingZoneSchema>;
export type RisingZonesResponse = z.infer<typeof risingZonesResponseSchema>;
