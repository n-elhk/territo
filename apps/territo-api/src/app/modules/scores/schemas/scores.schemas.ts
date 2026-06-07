import { z } from 'zod';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { ZoneType } from '../../../common/enums/zone-type.enum';

const scoreTypeEnum = z.enum(Object.values(ScoreType) as [ScoreType, ...ScoreType[]]);
const periodEnum = z.enum(Object.values(Period) as [Period, ...Period[]]);
const zoneTypeEnum = z.enum(Object.values(ZoneType) as [ZoneType, ...ZoneType[]]);

export const localScoreSchema = z.object({
  trade: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_km: z.number().int().min(1).max(100).default(20),
  period: periodEnum.default(Period.TwelveMonths),
  score_type: scoreTypeEnum.default(ScoreType.ProspectionLocale),
});

export const territoryBenchmarkQuerySchema = z.object({
  territory_code: z.string().min(1),
  score_type: scoreTypeEnum.default(ScoreType.TransformationImmo),
  period: periodEnum.default(Period.TwelveMonths),
  zone_level: zoneTypeEnum.default(ZoneType.Commune),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LocalScoreDto = z.infer<typeof localScoreSchema>;
export type TerritoryBenchmarkQueryDto = z.infer<typeof territoryBenchmarkQuerySchema>;
