import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  risingZonesResponseSchema,
  scoreHistoryResponseSchema,
  zoneScoreDetailSchema,
  type ZoneFeatureCollection,
} from '@territo/schemas';
import { Repository } from 'typeorm';
import { parseResponse } from '../../common/utils/parse-response';
import { PostgisRepository } from '../../database/postgis.repository';
import { ScoreHistorySnapshot } from '../scores/entities/score-history-snapshot.entity';
import { ZoneScore } from '../scores/entities/zone-score.entity';
import { AnalysisZone } from './entities/analysis-zone.entity';
import type {
  RisingZonesQueryDto,
  ZoneGeoJsonQueryDto,
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

  async getZonesGeoJson(query: ZoneGeoJsonQueryDto): Promise<ZoneFeatureCollection> {
    const rows = await this.postgis.runQuery<{
      zone_id: string;
      zone_name: string;
      global_score: string;
      trend_label: string | null;
      score_visibility: string;
      confidence_score: string;
      geometry: object;
    }>(
      `
      SELECT
        az.id                                                      AS zone_id,
        az.name                                                    AS zone_name,
        zs."globalScore"                                           AS global_score,
        zs."trendLabel"                                            AS trend_label,
        zs."scoreVisibility"                                       AS score_visibility,
        zs."confidenceScore"                                       AS confidence_score,
        ST_AsGeoJSON(ST_Simplify(az.geom::geometry, 0.0005))::json AS geometry
      FROM analysis_zones az
      JOIN zone_scores zs ON zs."zoneId"::uuid = az.id
      WHERE az."communeCode" = $1
        AND zs."scoreType" = $2
        AND zs.period = $3
        AND az.geom IS NOT NULL
        ${query.trade ? 'AND zs."tradeOrCategory" = $4' : ''}
      ORDER BY zs."globalScore" DESC
      `,
      [query.territory_code, query.score_type, query.period, ...(query.trade ? [query.trade] : [])],
    );

    return {
      type: 'FeatureCollection' as const,
      features: rows.map((r) => ({
        type: 'Feature' as const,
        geometry: r.geometry,
        properties: {
          zone_id: r.zone_id,
          name: r.zone_name,
          global_score: Number(r.global_score),
          trend_label: r.trend_label ?? null,
          score_visibility: r.score_visibility,
          confidence_score: Number(r.confidence_score),
        },
      })),
    };
  }

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
      global_score: Number(score.globalScore),
      confidence_score: Number(score.confidenceScore),
      score_visibility: score.scoreVisibility,
      trend: {
        label: score.trendLabel,
        delta_previous_period: score.globalScoreDeltaPrevious != null ? Number(score.globalScoreDeltaPrevious) : null,
        delta_year: score.globalScoreDeltaYear != null ? Number(score.globalScoreDeltaYear) : null,
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
      .where('h.zoneId = :zoneId', { zoneId })
      .andWhere('h.scoreType = :scoreType', { scoreType: query.score_type })
      .andWhere('h.period = :period', { period: query.period });

    if (query.trade) {
      qb.andWhere('h.tradeOrCategory = :trade', { trade: query.trade });
    }
    if (query.from) {
      qb.andWhere('h.generatedAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('h.generatedAt <= :to', { to: query.to });
    }

    const snapshots = await qb.orderBy('h.generatedAt', 'ASC').getMany();

    return parseResponse(scoreHistoryResponseSchema, {
      zone: { id: zone.id, name: zone.name },
      score_type: query.score_type,
      trade: query.trade ?? null,
      period: query.period,
      series: snapshots.map((s) => ({
        date: s.generatedAt,
        global_score: Number(s.globalScore),
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
        az.id                             AS zone_id,
        az.name                           AS zone_name,
        az."communeCode"                  AS commune_code,
        zs."globalScore"                  AS global_score,
        zs."globalScoreDeltaPrevious"     AS global_score_delta_previous,
        zs."trendLabel"                   AS trend_label,
        zs."confidenceScore"              AS confidence_score,
        zs."scoreVisibility"              AS score_visibility,
        zs."tradeOrCategory"              AS trade_or_category
      FROM zone_scores zs
      JOIN analysis_zones az ON az.id = zs."zoneId"::uuid
      WHERE az."communeCode" = $1
        AND zs."scoreType" = $2
        AND zs.period = $3
        AND zs."globalScoreDeltaPrevious" >= $4
        ${query.category ? 'AND zs."tradeOrCategory" = $6' : ''}
      ORDER BY zs."globalScoreDeltaPrevious" DESC
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
