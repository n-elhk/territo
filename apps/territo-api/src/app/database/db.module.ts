import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgisRepository } from './postgis.repository';
import { DpeDiagnostic } from '../modules/data/entities/dpe-diagnostic.entity';
import { DvfTransaction } from '../modules/data/entities/dvf-transaction.entity';
import { UrbanismeProject } from '../modules/data/entities/urbanisme-project.entity';
import { ProductEvent } from '../modules/events/entities/product-event.entity';
import { ZoneFeedback } from '../modules/feedback/entities/zone-feedback.entity';
import { AreaMetric } from '../modules/scores/entities/area-metric.entity';
import { ScoreHistorySnapshot } from '../modules/scores/entities/score-history-snapshot.entity';
import { ScoringConfig } from '../modules/scores/entities/scoring-config.entity';
import { ScoringQualityRule } from '../modules/scores/entities/scoring-quality-rule.entity';
import { ZoneScore } from '../modules/scores/entities/zone-score.entity';
import { AnalysisZone } from '../modules/zones/entities/analysis-zone.entity';
import { Alert } from '../modules/alerts/entities/alert.entity';
import { User } from '../modules/iam/entities/user.entity';

const entities = [
  User,
  Alert,
  AnalysisZone,
  UrbanismeProject,
  DvfTransaction,
  DpeDiagnostic,
  AreaMetric,
  ZoneScore,
  ScoringConfig,
  ScoringQualityRule,
  ScoreHistorySnapshot,
  ProductEvent,
  ZoneFeedback,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'territo'),
        password: config.get<string>('DB_PASSWORD', 'territo'),
        database: config.get<string>('DB_NAME', 'territo'),
        entities,
        migrations: [],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
        retryAttempts: 1,
      }),
    }),
  ],
  providers: [PostgisRepository],
  exports: [TypeOrmModule, PostgisRepository],
})
export class DbModule {}
