import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  geocodingReverseResponseSchema,
  geocodingSearchResponseSchema,
} from '@territo/schemas';
import { parseResponse } from '../../common/utils/parse-response';
import { Auth } from '../iam/authentication/decorators/auth.decorator';
import { AuthType } from '../iam/authentication/enums/auth-type.enum';
import { GeocodingService } from './geocoding.service';

@ApiTags('geocoding')
@Auth(AuthType.None)
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  @ApiOperation({ summary: "Recherche d'adresse via l'API Adresse BAN (data.gouv.fr)" })
  @ApiQuery({ name: 'q', description: 'Texte à rechercher' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre de résultats (défaut: 5)' })
  @ApiQuery({ name: 'type', required: false, description: 'Type : housenumber, street, municipality' })
  async search(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const features = await this.geocodingService.search(q, limit ? parseInt(limit, 10) : 5, type);
    return parseResponse(geocodingSearchResponseSchema, {
      results: features.map((f) => this.geocodingService.formatFeature(f)),
    });
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Geocodage inverse : coordonnees -> adresse' })
  async reverse(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const feature = await this.geocodingService.reverse(parseFloat(lat), parseFloat(lng));
    return parseResponse(geocodingReverseResponseSchema, {
      result: feature ? this.geocodingService.formatFeature(feature) : null,
    });
  }
}
