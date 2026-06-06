import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  localScoreSchema,
  territoryBenchmarkQuerySchema,
  type LocalScoreDto,
  type TerritoryBenchmarkQueryDto,
} from './schemas/scores.schemas';
import { ScoresService } from './scores.service';

@ApiTags('scores')
@Controller()
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Post('scores/local')
  @ApiOperation({ summary: 'Zones dans un rayon — score artisan prospection locale' })
  getLocalScores(
    @Body(new ZodValidationPipe(localScoreSchema)) dto: LocalScoreDto,
  ) {
    return this.scoresService.getLocalScores(dto);
  }

  @Get('territory-benchmark')
  @ApiOperation({ summary: "Classement des zones d'un territoire par score" })
  getTerritoryBenchmark(
    @Query(new ZodValidationPipe(territoryBenchmarkQuerySchema)) query: TerritoryBenchmarkQueryDto,
  ) {
    return this.scoresService.getTerritoryBenchmark(query);
  }
}
