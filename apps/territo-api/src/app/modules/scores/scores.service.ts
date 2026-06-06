import { Injectable } from '@nestjs/common';
import {
  localScoreResponseSchema,
  territoryBenchmarkResponseSchema,
} from '@territo/schemas';
import { parseResponse } from '../../common/utils/parse-response';
import { PostgisRepository } from '../../database/postgis.repository';
import type { LocalScoreDto, TerritoryBenchmarkQueryDto } from './schemas/scores.schemas';

@Injectable()
export class ScoresService {
  constructor(private readonly postgis: PostgisRepository) {}

  async getLocalScores(dto: LocalScoreDto) {
    const radiusMeters = dto.radius_km * 1000;

    const rows = await this.postgis.runQuery<{
      zone_id: string;
      zone_name: string;
      commune_code: string;
      global_score: string;
      confidence_score: string;
      score_visibility: string;
      trend_label: string | null;
      global_score_delta_previous: string | null;
      global_score_delta_year: string | null;
      sub_scores: Record<string, number>;
      quality_warnings: string[];
      explanation: string[];
      distance_m: string;
    }>(
      `
      SELECT
        az.id                             AS zone_id,
        az.name                           AS zone_name,
        az."communeCode"                  AS commune_code,
        zs."globalScore"                  AS global_score,
        zs."confidenceScore"              AS confidence_score,
        zs."scoreVisibility"              AS score_visibility,
        zs."trendLabel"                   AS trend_label,
        zs."globalScoreDeltaPrevious"     AS global_score_delta_previous,
        zs."globalScoreDeltaYear"         AS global_score_delta_year,
        zs."subScores"                    AS sub_scores,
        zs."qualityWarnings"              AS quality_warnings,
        zs.explanation,
        ST_Distance(
          az.geom::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) AS distance_m
      FROM analysis_zones az
      JOIN zone_scores zs ON zs."zoneId"::uuid = az.id
      WHERE ST_DWithin(
          az.geom::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $3
        )
        AND zs."scoreType" = $4
        AND zs."tradeOrCategory" = $5
        AND zs.period = $6
      ORDER BY zs."globalScore" DESC
      `,
      [dto.lat, dto.lng, radiusMeters, dto.score_type, dto.trade, dto.period],
    );

    return parseResponse(localScoreResponseSchema, {
      trade: dto.trade,
      radius_km: dto.radius_km,
      areas: rows.map((r) => ({
        zone_id: r.zone_id,
        name: r.zone_name,
        commune_code: r.commune_code,
        distance_km: Math.round(Number(r.distance_m) / 100) / 10,
        global_score: Number(r.global_score),
        confidence_score: Number(r.confidence_score),
        score_visibility: r.score_visibility,
        trend: {
          label: r.trend_label ?? null,
          delta: r.global_score_delta_previous != null ? Number(r.global_score_delta_previous) : null,
          delta_year: r.global_score_delta_year != null ? Number(r.global_score_delta_year) : null,
        },
        sub_scores: r.sub_scores ?? {},
        quality_warnings: r.quality_warnings ?? [],
        explanation: r.explanation ?? [],
      })),
    });
  }

  async getTerritoryBenchmark(query: TerritoryBenchmarkQueryDto) {
    const rows = await this.postgis.runQuery<{
      zone_id: string;
      zone_name: string;
      commune_code: string;
      zone_type: string;
      global_score: string;
      confidence_score: string;
      score_visibility: string;
      trend_label: string | null;
      global_score_delta_previous: string | null;
      sub_scores: Record<string, number>;
      quality_warnings: string[];
    }>(
      `
      SELECT
        az.id                             AS zone_id,
        az.name                           AS zone_name,
        az."communeCode"                  AS commune_code,
        az."zoneType"                     AS zone_type,
        zs."globalScore"                  AS global_score,
        zs."confidenceScore"              AS confidence_score,
        zs."scoreVisibility"              AS score_visibility,
        zs."trendLabel"                   AS trend_label,
        zs."globalScoreDeltaPrevious"     AS global_score_delta_previous,
        zs."subScores"                    AS sub_scores,
        zs."qualityWarnings"              AS quality_warnings
      FROM analysis_zones az
      JOIN zone_scores zs ON zs."zoneId"::uuid = az.id
      WHERE az."communeCode" = $1
        AND az."zoneType" = $2
        AND zs."scoreType" = $3
        AND zs.period = $4
      ORDER BY zs."globalScore" DESC
      LIMIT $5
      `,
      [query.territory_code, query.zone_level, query.score_type, query.period, query.limit],
    );

    return parseResponse(territoryBenchmarkResponseSchema, {
      territory_code: query.territory_code,
      score_type: query.score_type,
      period: query.period,
      zone_level: query.zone_level,
      zones: rows.map((r) => ({
        zone_id: r.zone_id,
        name: r.zone_name,
        commune_code: r.commune_code,
        zone_type: r.zone_type,
        global_score: Number(r.global_score),
        confidence_score: Number(r.confidence_score),
        score_visibility: r.score_visibility,
        trend: {
          label: r.trend_label ?? null,
          delta: r.global_score_delta_previous != null ? Number(r.global_score_delta_previous) : null,
          delta_year: null,
        },
        sub_scores: r.sub_scores ?? {},
        quality_warnings: r.quality_warnings ?? [],
      })),
    });
  }
}
