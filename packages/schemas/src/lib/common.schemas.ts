import { z } from 'zod';

export const scoreVisibilitySchema = z.enum([
  'visible',
  'caution',
  'greyed',
  'hidden',
  'fallback_zone',
]);

export const trendLabelSchema = z.enum([
  'hausse',
  'baisse',
  'stable',
  'acceleration',
  'ralentissement',
]);

export const periodSchema = z.enum(['3m', '6m', '12m', '24m']);

export const scoreTypeSchema = z.enum([
  'prospection_locale',
  'transformation_immo',
  'potentiel_marche',
  'prospection_vendeurs',
  'liquidite_marche',
  'valorisation_prix',
  'quartier_mutation',
  'opportunite_acquereur',
  'risque_commercial',
  'estimation_locale',
  'demande_btp',
  'mutation_urbaine',
]);

export const subScoresSchema = z.record(z.string(), z.number());

export const trendSchema = z.object({
  label: trendLabelSchema.nullable(),
  delta: z.number().nullable(),
  delta_year: z.number().nullable(),
});

export const zoneRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  commune_code: z.string(),
  zone_type: z.string().optional(),
});

export const scoredZoneSchema = z.object({
  zone_id: z.string().uuid(),
  name: z.string(),
  commune_code: z.string(),
  global_score: z.number(),
  confidence_score: z.number(),
  score_visibility: scoreVisibilitySchema,
  trend: trendSchema,
  sub_scores: subScoresSchema,
  quality_warnings: z.array(z.string()),
});

export type ScoreVisibility = z.infer<typeof scoreVisibilitySchema>;
export type TrendLabel = z.infer<typeof trendLabelSchema>;
export type Period = z.infer<typeof periodSchema>;
export type ScoreType = z.infer<typeof scoreTypeSchema>;
export type SubScores = z.infer<typeof subScoresSchema>;
export type Trend = z.infer<typeof trendSchema>;
export type ZoneRef = z.infer<typeof zoneRefSchema>;
export type ScoredZone = z.infer<typeof scoredZoneSchema>;
