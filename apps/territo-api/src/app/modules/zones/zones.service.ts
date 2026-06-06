import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  risingZonesResponseSchema,
  scoreHistoryResponseSchema,
  zoneScoreDetailSchema,
} from '@territo/schemas';
import { Repository } from 'typeorm';
import { parseResponse } from '../../common/utils/parse-response';
import { PostgisRepository } from '../../database/postgis.repository';
import { ScoreHistorySnapshot } from '../scores/entities/score-history-snapshot.entity';
import { ZoneScore } from '../scores/entities/zone-score.entity';
import { AnalysisZone } from './entities/analysis-zone.entity';
import type {
  RisingZonesQueryDto,
  ZoneScoreHistoryQueryDto,
  ZoneScoresQueryDto,
} from './schemas/zones.schemas';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(AnalysisZone)
    private readonly zoneRepo: Repository<AnalysisZone>,
    @InjectRepository(ZoneScore)
    private readonly zoneScoreRepo: Repository<ZoneScore>,
    @InjectRepository(ScoreHistorySnapshot)
    private readonly historyRepo: Repository<ScoreHistorySnapshot>,
    private readonly postgis: PostgisRepository,
  ) {}

  async getZoneScores(zoneId: string, query: ZoneScoresQueryDto) {
    const zone = await this.zoneRepo.findOneBy({ id: zoneId });
    if (!zone) return null;

    const score = await this.zoneScoreRepo.findOne({
      where: {
        zoneId,
        scoreType: query.score_type,
        period: query.period,
        ...(query.trade ? { tradeOrCategory: query.trade } : {}),
      },
      order: { generatedAt: 'DESC' },
    });

    if (!score) return null;

    return parseResponse(zoneScoreDetailSchema, {
      zone: {
        id: zone.id,
        name: zone.name,
        zone_type: zone.zoneType,
        commune_code: zone.communeCode,
      },
      score_type: score.scoreType,
      trade: score.tradeOrCategory,
      period: score.period,
      global_score: score.globalScore,
      confidence_score: score.confidenceScore,
      score_visibility: score.scoreVisibility,
      trend: {
        label: score.trendLabel,
        delta_previous_period: score.globalScoreDeltaPrevious,
        delta_year: score.globalScoreDeltaYear,
      },
      sub_scores: score.subScores,
      quality_warnings: score.qualityWarnings,
      explanation: score.explanation,
    });
  }

  async getZoneScoreHistory(zoneId: string, query: ZoneScoreHistoryQueryDto) {
    const zone = await this.zoneRepo.findOneBy({ id: zoneId });
    if (!zone) return null;

    const qb = this.historyRepo
      .createQueryBuilder('h')
      .where('h.zone_id = :zoneId', { zoneId })
      .andWhere('h.score_type = :scoreType', { scoreType: query.score_type })
      .andWhere('h.period = :period', { period: query.period });

    if (query.trade) {
      qb.andWhere('h.trade_or_category = :trade', { trade: query.trade });
    }
    if (query.from) {
      qb.andWhere('h.generated_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('h.generated_at <= :to', { to: query.to });
    }

    const snapshots = await qb.orderBy('h.generated_at', 'ASC').getMany();

    return parseResponse(scoreHistoryResponseSchema, {
      zone: { id: zone.id, name: zone.name },
      score_type: query.score_type,
      trade: query.trade ?? null,
      period: query.period,
      series: snapshots.map((s) => ({
        date: s.generatedAt,
        global_score: s.globalScore,
        sub_scores: s.subScores,
      })),
    });
  }

  async getRisingZones(query: RisingZonesQueryDto) {
    const rows = await this.postgis.runQuery<{
      zone_id: string;
      zone_name: string;
      commune_code: string;
      global_score: string;
      global_score_delta_previous: string;
      trend_label: string | null;
      confidence_score: string;
      score_visibility: string;
      trade_or_category: string | null;
    }>(
      `
      SELECT
        az.id            AS zone_id,
        az.name          AS zone_name,
        az.commune_code,
        zs.global_score,
        zs.global_score_delta_previous,
        zs.trend_label,
        zs.confidence_score,
        zs.score_visibility,
        zs.trade_or_category
      FROM zone_scores zs
      JOIN analysis_zones az ON az.id = zs.zone_id
      WHERE az.commune_code = $1
        AND zs.score_type = $2
        AND zs.period = $3
        AND zs.global_score_delta_previous >= $4
        ${query.category ? 'AND zs.trade_or_category = $6' : ''}
      ORDER BY zs.global_score_delta_previous DESC
      LIMIT $5
      `,
      [
        query.territory_code,
        query.score_type,
        query.period,
        query.min_delta,
        query.limit,
        ...(query.category ? [query.category] : []),
      ],
    );

    return parseResponse(risingZonesResponseSchema, {
      territory_code: query.territory_code,
      score_type: query.score_type,
      period: query.period,
      zones: rows.map((r) => ({
        zone_id: r.zone_id,
        name: r.zone_name,
        commune_code: r.commune_code,
        global_score: Number(r.global_score),
        delta: Number(r.global_score_delta_previous),
        trend_label: r.trend_label ?? null,
        confidence_score: Number(r.confidence_score),
        score_visibility: r.score_visibility,
        trade: r.trade_or_category,
      })),
    });
  }
}
