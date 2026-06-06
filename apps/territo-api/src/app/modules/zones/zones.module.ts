import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbModule } from '../../database/db.module';
import { ScoreHistorySnapshot } from '../scores/entities/score-history-snapshot.entity';
import { ZoneScore } from '../scores/entities/zone-score.entity';
import { AnalysisZone } from './entities/analysis-zone.entity';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisZone, ZoneScore, ScoreHistorySnapshot]),
    DbModule,
  ],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
