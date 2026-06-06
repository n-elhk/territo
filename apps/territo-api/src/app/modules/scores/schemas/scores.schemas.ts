import { z } from 'zod';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { ZoneType } from '../../../common/enums/zone-type.enum';

export const localScoreSchema = z.object({
  trade: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_km: z.number().int().min(1).max(100).default(20),
  period: z.nativeEnum(Period).default(Period.TwelveMonths),
  score_type: z.nativeEnum(ScoreType).default(ScoreType.ProspectionLocale),
});

export const territoryBenchmarkQuerySchema = z.object({
  territory_code: z.string().min(1),
  score_type: z.nativeEnum(ScoreType).default(ScoreType.TransformationImmo),
  period: z.nativeEnum(Period).default(Period.TwelveMonths),
  zone_level: z.nativeEnum(ZoneType).default(ZoneType.Commune),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LocalScoreDto = z.infer<typeof localScoreSchema>;
export type TerritoryBenchmarkQueryDto = z.infer<typeof territoryBenchmarkQuerySchema>;
