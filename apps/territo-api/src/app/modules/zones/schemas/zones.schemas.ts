import { z } from 'zod';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';

const scoreTypeEnum = z.enum(Object.values(ScoreType) as [ScoreType, ...ScoreType[]]);
const periodEnum = z.enum(Object.values(Period) as [Period, ...Period[]]);

export const zoneGeoJsonQuerySchema = z.object({
  territory_code: z.string().min(1),
  score_type: scoreTypeEnum,
  period: periodEnum.default(Period.TwelveMonths),
  trade: z.string().optional(),
});

export type ZoneGeoJsonQueryDto = z.infer<typeof zoneGeoJsonQuerySchema>;

export const zoneScoresQuerySchema = z.object({
  score_type: scoreTypeEnum,
  period: periodEnum.default(Period.TwelveMonths),
  trade: z.string().optional(),
});

export const zoneScoreHistoryQuerySchema = z.object({
  score_type: scoreTypeEnum,
  period: periodEnum.default(Period.TwelveMonths),
  trade: z.string().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const risingZonesQuerySchema = z.object({
  territory_code: z.string().min(1),
  score_type: scoreTypeEnum,
  category: z.string().optional(),
  period: periodEnum.default(Period.TwelveMonths),
  min_delta: z.coerce.number().default(5),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ZoneScoresQueryDto = z.infer<typeof zoneScoresQuerySchema>;
export type ZoneScoreHistoryQueryDto = z.infer<typeof zoneScoreHistoryQuerySchema>;
export type RisingZonesQueryDto = z.infer<typeof risingZonesQuerySchema>;
