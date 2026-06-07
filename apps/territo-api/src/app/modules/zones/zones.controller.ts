import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  risingZonesQuerySchema,
  zoneGeoJsonQuerySchema,
  zoneScoreHistoryQuerySchema,
  zoneScoresQuerySchema,
  type RisingZonesQueryDto,
  type ZoneGeoJsonQueryDto,
  type ZoneScoreHistoryQueryDto,
  type ZoneScoresQueryDto,
} from './schemas/zones.schemas';
import { ZonesService } from './zones.service';

@ApiTags('zones')
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get('geojson')
  @ApiOperation({ summary: 'GeoJSON des zones avec scores — source MapLibre' })
  getGeoJson(
    @Query(new ZodValidationPipe(zoneGeoJsonQuerySchema)) query: ZoneGeoJsonQueryDto,
  ) {
    return this.zonesService.getZonesGeoJson(query);
  }

  @Get('rising')
  @ApiOperation({ summary: 'Zones dont le score progresse le plus sur la période' })
  getRising(
    @Query(new ZodValidationPipe(risingZonesQuerySchema)) query: RisingZonesQueryDto,
  ) {
    return this.zonesService.getRisingZones(query);
  }

  @Get(':id/scores')
  @ApiOperation({ summary: "Score detaille d'une zone" })
  async getScores(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(zoneScoresQuerySchema)) query: ZoneScoresQueryDto,
  ) {
    const result = await this.zonesService.getZoneScores(id, query);
    if (!result) throw new NotFoundException('Zone introuvable');
    return result;
  }

  @Get(':id/score-history')
  @ApiOperation({ summary: "Historique des scores d'une zone pour les courbes" })
  async getScoreHistory(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(zoneScoreHistoryQuerySchema)) query: ZoneScoreHistoryQueryDto,
  ) {
    const result = await this.zonesService.getZoneScoreHistory(id, query);
    if (!result) throw new NotFoundException('Zone introuvable');
    return result;
  }
}
