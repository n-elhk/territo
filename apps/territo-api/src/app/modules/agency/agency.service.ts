import { Injectable } from '@nestjs/common';
import {
  agencyMarketScoresResponseSchema,
  estimationContextResponseSchema,
} from '@territo/schemas';
import { parseResponse } from '../../common/utils/parse-response';
import { PostgisRepository } from '../../database/postgis.repository';
import { ScoreType } from '../../common/enums/score-type.enum';
import type { AgencyMarketScoresQueryDto, EstimationContextDto } from './schemas/agency.schemas';

const AGENCY_SCORE_TYPES = [
  ScoreType.ProspectionVendeurs,
  ScoreType.LiquiditeMarche,
  ScoreType.ValorisationPrix,
  ScoreType.QuartierMutation,
  ScoreType.OpportuniteAcquereur,
  ScoreType.RisqueCommercial,
];

@Injectable()
export class AgencyService {
  constructor(private readonly postgis: PostgisRepository) {}

  async getMarketScores(query: AgencyMarketScoresQueryDto) {
    const rows = await this.postgis.runQuery<{
      zone_id: string;
      zone_name: string;
      commune_code: string;
      score_type: string;
      global_score: string;
      trend_label: string | null;
      global_score_delta_previous: string | null;
      confidence_score: string;
      score_visibility: string;
    }>(
      `
      SELECT
        az.id                            AS zone_id,
        az.name                          AS zone_name,
        az."communeCode"                 AS commune_code,
        zs."scoreType"                   AS score_type,
        zs."globalScore"                 AS global_score,
        zs."trendLabel"                  AS trend_label,
        zs."globalScoreDeltaPrevious"    AS global_score_delta_previous,
        zs."confidenceScore"             AS confidence_score,
        zs."scoreVisibility"             AS score_visibility
      FROM analysis_zones az
      JOIN zone_scores zs ON zs."zoneId" = az.id
      WHERE az."communeCode" = $1
        AND az."zoneType" = $2
        AND zs."scoreType"::text = ANY($4::text[])
        AND zs.period = $3
        AND zs."userSegment" = 'agence_immo'
      ORDER BY az.id, zs."scoreType"
      `,
      [query.territory_code, query.zone_level, query.period, AGENCY_SCORE_TYPES],
    );

    // Regroupe les 6 scores par zone
    const byZone = new Map<
      string,
      {
        zone_id: string;
        name: string;
        commune_code: string;
        sub_scores: Record<string, number>;
        trends: Record<string, { label: string | null; delta: number | null }>;
        confidence_score: number;
        score_visibility: string;
      }
    >();

    for (const r of rows) {
      if (!byZone.has(r.zone_id)) {
        byZone.set(r.zone_id, {
          zone_id: r.zone_id,
          name: r.zone_name,
          commune_code: r.commune_code,
          sub_scores: {},
          trends: {},
          confidence_score: Number(r.confidence_score),
          score_visibility: r.score_visibility,
        });
      }
      const zone = byZone.get(r.zone_id)!;
      zone.sub_scores[r.score_type] = Number(r.global_score);
      zone.trends[r.score_type] = {
        label: r.trend_label ?? null,
        delta: r.global_score_delta_previous != null ? Number(r.global_score_delta_previous) : null,
      };
    }

    return parseResponse(agencyMarketScoresResponseSchema, {
      profile: 'agence_immo',
      territory_code: query.territory_code,
      period: query.period,
      zones: [...byZone.values()],
    });
  }

  async getEstimationContext(dto: EstimationContextDto) {
    const radiusMeters = dto.radius_km * 1000;
    const periodMonths = dto.period === '3m' ? 3 : dto.period === '6m' ? 6 : dto.period === '12m' ? 12 : 24;

    const rows = await this.postgis.runQuery<{
      price_per_m2: string;
      mutation_date: string;
    }>(
      `
      SELECT
        "pricePerM2"   AS price_per_m2,
        "mutationDate" AS mutation_date
      FROM dvf_transactions
      WHERE "propertyType" = $1
        AND "builtSurface" BETWEEN $2 AND $3
        AND "mutationDate" >= NOW() - ($4 || ' months')::interval
        AND geom IS NOT NULL
        AND ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
          $7
        )
      ORDER BY "mutationDate" DESC
      `,
      [
        dto.property_type,
        dto.surface_m2 * 0.7,
        dto.surface_m2 * 1.3,
        periodMonths,
        dto.lat,
        dto.lng,
        radiusMeters,
      ],
    );

    if (rows.length === 0) {
      return parseResponse(estimationContextResponseSchema, {
        comparable_sales_count: 0,
        median_price_m2: null,
        price_range_m2: null,
        trend_period: dto.period,
        estimation_reliability_score: 0,
        warnings: [
          "Aucune vente comparable trouvee dans ce perimetre et cette periode.",
          "DVF ne donne pas l'etat interieur, l'etage, l'exposition ou les travaux.",
        ],
      });
    }

    const prices = rows
      .map((r) => Number(r.price_per_m2))
      .filter(Boolean)
      .sort((a, b) => a - b);

    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0
        ? (prices[mid - 1] + prices[mid]) / 2
        : prices[mid];

    const reliabilityScore = Math.min(
      100,
      Math.round(
        (Math.min(rows.length, 20) / 20) * 60 +
          40 * (rows.length >= 10 ? 1 : rows.length / 10),
      ),
    );

    return parseResponse(estimationContextResponseSchema, {
      comparable_sales_count: rows.length,
      median_price_m2: Math.round(median),
      price_range_m2: {
        low: Math.round(prices[0]),
        high: Math.round(prices[prices.length - 1]),
      },
      trend_period: dto.period,
      estimation_reliability_score: reliabilityScore,
      warnings: [
        "DVF ne donne pas l'etat interieur, l'etage, l'exposition ou les travaux.",
        ...(rows.length < 5
          ? ["Volume DVF insuffisant - resultat a interpreter avec prudence."]
          : []),
      ],
    });
  }
}
