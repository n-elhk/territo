import { z } from 'zod';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';

export const zoneScoresQuerySchema = z.object({
  score_type: z.nativeEnum(ScoreType),
  period: z.nativeEnum(Period).default(Period.TwelveMonths),
  trade: z.string().optional(),
});

export const zoneScoreHistoryQuerySchema = z.object({
  score_type: z.nativeEnum(ScoreType),
  period: z.nativeEnum(Period).default(Period.TwelveMonths),
  trade: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const risingZonesQuerySchema = z.object({
  territory_code: z.string().min(1),
  score_type: z.nativeEnum(ScoreType),
  category: z.string().optional(),
  period: z.nativeEnum(Period).default(Period.TwelveMonths),
  min_delta: z.coerce.number().default(5),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ZoneScoresQueryDto = z.infer<typeof zoneScoresQuerySchema>;
export type ZoneScoreHistoryQueryDto = z.infer<typeof zoneScoreHistoryQuerySchema>;
export type RisingZonesQueryDto = z.infer<typeof risingZonesQuerySchema>;
