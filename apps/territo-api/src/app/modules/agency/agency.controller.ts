import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  agencyMarketScoresQuerySchema,
  estimationContextSchema,
  type AgencyMarketScoresQueryDto,
  type EstimationContextDto,
} from './schemas/agency.schemas';
import { AgencyService } from './agency.service';

@ApiTags('agency')
@Controller('agency')
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  @Get('market-scores')
  @ApiOperation({ summary: 'Scores agence immobilière sur un territoire' })
  getMarketScores(
    @Query(new ZodValidationPipe(agencyMarketScoresQuerySchema)) query: AgencyMarketScoresQueryDto,
  ) {
    return this.agencyService.getMarketScores(query);
  }

  @Post('estimation-context')
  @ApiOperation({ summary: 'Contexte de marché local pour préparer une estimation' })
  getEstimationContext(
    @Body(new ZodValidationPipe(estimationContextSchema)) dto: EstimationContextDto,
  ) {
    return this.agencyService.getEstimationContext(dto);
  }
}
