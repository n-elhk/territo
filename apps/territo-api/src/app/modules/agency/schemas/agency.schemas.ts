import { z } from 'zod';
import { Period } from '../../../common/enums/period.enum';
import { ZoneType } from '../../../common/enums/zone-type.enum';
import { PropertyType } from '../../data/entities/dvf-transaction.entity';

export const agencyMarketScoresQuerySchema = z.object({
  territory_code: z.string().min(1),
  period: z.nativeEnum(Period).default(Period.TwentyFourMonths),
  zone_level: z.nativeEnum(ZoneType).default(ZoneType.Commune),
  property_type: z.nativeEnum(PropertyType).optional(),
});

export const estimationContextSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  property_type: z.nativeEnum(PropertyType),
  surface_m2: z.number().positive(),
  rooms: z.number().int().positive().optional(),
  period: z.nativeEnum(Period).default(Period.TwentyFourMonths),
  radius_km: z.number().int().min(1).max(5).default(1),
});

export type AgencyMarketScoresQueryDto = z.infer<typeof agencyMarketScoresQuerySchema>;
export type EstimationContextDto = z.infer<typeof estimationContextSchema>;
