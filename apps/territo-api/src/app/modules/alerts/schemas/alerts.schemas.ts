import { z } from 'zod';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { AlertFrequency, AlertType } from '../entities/alert.entity';

const scoreTypeEnum = z.enum(Object.values(ScoreType) as [ScoreType, ...ScoreType[]]);
const periodEnum = z.enum(Object.values(Period) as [Period, ...Period[]]);
const alertFrequencyEnum = z.enum(Object.values(AlertFrequency) as [AlertFrequency, ...AlertFrequency[]]);

export const createAlertSchema = z
  .discriminatedUnion('alert_type', [
    z.object({
      alert_type: z.literal(AlertType.LocalRadius),
      base_location: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
      radius_km: z.number().int().min(1).max(100).default(20),
      score_type: scoreTypeEnum,
      trade: z.string().optional(),
      min_score: z.number().min(0).max(100).optional(),
      min_trend_delta: z.number().optional(),
      period: periodEnum.default(Period.TwelveMonths),
      frequency: alertFrequencyEnum.default(AlertFrequency.Weekly),
    }),
    z.object({
      alert_type: z.literal(AlertType.Territory),
      territory_code: z.string().min(1),
      score_type: scoreTypeEnum,
      category: z.string().optional(),
      min_score: z.number().min(0).max(100).optional(),
      min_trend_delta: z.number().optional(),
      period: periodEnum.default(Period.TwelveMonths),
      frequency: alertFrequencyEnum.default(AlertFrequency.Weekly),
    }),
  ])
  .refine(
    (v) => v.alert_type === AlertType.Territory || v.radius_km > 0,
    'radius_km requis pour une alerte locale',
  );

export type CreateAlertDto = z.infer<typeof createAlertSchema>;
