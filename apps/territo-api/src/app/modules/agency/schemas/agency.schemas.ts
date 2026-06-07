import { z } from 'zod';
import { Period } from '../../../common/enums/period.enum';
import { ZoneType } from '../../../common/enums/zone-type.enum';
import { PropertyType } from '../../data/entities/dvf-transaction.entity';

const periodEnum = z.enum(Object.values(Period) as [Period, ...Period[]]);
const zoneTypeEnum = z.enum(Object.values(ZoneType) as [ZoneType, ...ZoneType[]]);
const propertyTypeEnum = z.enum(Object.values(PropertyType) as [PropertyType, ...PropertyType[]]);

export const agencyMarketScoresQuerySchema = z.object({
  territory_code: z.string().min(1),
  period: periodEnum.default(Period.TwentyFourMonths),
  zone_level: zoneTypeEnum.default(ZoneType.Commune),
  property_type: propertyTypeEnum.optional(),
});

export const estimationContextSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  property_type: propertyTypeEnum,
  surface_m2: z.number().positive(),
  rooms: z.number().int().positive().optional(),
  period: periodEnum.default(Period.TwentyFourMonths),
  radius_km: z.number().int().min(1).max(5).default(1),
});

export type AgencyMarketScoresQueryDto = z.infer<typeof agencyMarketScoresQuerySchema>;
export type EstimationContextDto = z.infer<typeof estimationContextSchema>;
