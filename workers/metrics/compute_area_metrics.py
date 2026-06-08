"""
Calcule les area_metrics par zone + période à partir des données brutes.

Agrège DVF, DPE et urbanisme via PostGIS (ST_Within) pour chaque zone.
Toutes les agrégations lourdes sont faites en SQL — Python orchestre seulement.

Usage:
    # Toutes les zones, toutes les périodes
    python workers/metrics/compute_area_metrics.py

    # Seulement les zones d'une commune
    python workers/metrics/compute_area_metrics.py --commune 35238

    # Seulement certaines périodes
    python workers/metrics/compute_area_metrics.py --periods 12m,24m
"""

import argparse
import sys
import json
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


from tqdm import tqdm
from db import get_connection

PERIODS = {
    "3m":  3,
    "6m":  6,
    "12m": 12,
    "24m": 24,
}

# Seuils qualité data (repris depuis ScoringQualityRule defaults)
THRESHOLDS = {
    "dpe":       {"min": 10,  "strong": 30},
    "dvf":       {"min": 5,   "strong": 15},
    "urbanisme": {"min": 5,   "strong": 20},
}


def get_zones(conn, commune_code: str | None) -> list[dict]:
    with conn.cursor() as cur:
        if commune_code:
            cur.execute(
                'SELECT id, name, "communeCode", "zoneType" FROM analysis_zones WHERE "communeCode" = %s',
                (commune_code,),
            )
        else:
            cur.execute('SELECT id, name, "communeCode", "zoneType" FROM analysis_zones')
        rows = cur.fetchall()
    return [{"id": r[0], "name": r[1], "commune_code": r[2], "zone_type": r[3]} for r in rows]


def compute_dvf_metrics(cur, zone_id: str, period_start: date, period_end: date) -> dict:
    cur.execute(
        """
        SELECT
            COUNT(*)                                                          AS sales_count,
            COUNT(*) FILTER (WHERE "propertyType" = 'maison')                AS houses_count,
            COUNT(*) FILTER (WHERE "propertyType" = 'appartement')           AS apartments_count,
            COUNT(*) FILTER (WHERE "builtSurface" > 0)                       AS comparable_count,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "pricePerM2")        AS median_price_m2,
            STDDEV("pricePerM2") / NULLIF(AVG("pricePerM2"), 0)              AS price_dispersion,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "pricePerM2")       AS p75_price_m2
        FROM dvf_transactions d
        WHERE ST_Within(d.geom, (SELECT geom FROM analysis_zones WHERE id = %s))
          AND d."mutationDate" BETWEEN %s AND %s
          AND d."pricePerM2" IS NOT NULL
        """,
        (zone_id, period_start, period_end),
    )
    row = cur.fetchone()
    if not row:
        return {}

    sales_count, houses_count, apartments_count, comparable_count, \
        median_price_m2, price_dispersion, p75_price_m2 = row

    # High-end ratio = % de ventes au-dessus du 75e percentile
    high_end_ratio = None
    if sales_count and p75_price_m2:
        cur.execute(
            """
            SELECT COUNT(*) FROM dvf_transactions d
            WHERE ST_Within(d.geom, (SELECT geom FROM analysis_zones WHERE id = %s))
              AND d."mutationDate" BETWEEN %s AND %s
              AND d."pricePerM2" > %s
            """,
            (zone_id, period_start, period_end, p75_price_m2),
        )
        high_end_count = cur.fetchone()[0]
        high_end_ratio = high_end_count / sales_count if sales_count else None

    # Régularité : nb de mois distincts avec au moins une vente
    months = (period_end.year - period_start.year) * 12 + period_end.month - period_start.month
    regularity = None
    if months > 0 and sales_count:
        cur.execute(
            """
            SELECT COUNT(DISTINCT DATE_TRUNC('month', "mutationDate"))
            FROM dvf_transactions d
            WHERE ST_Within(d.geom, (SELECT geom FROM analysis_zones WHERE id = %s))
              AND d."mutationDate" BETWEEN %s AND %s
            """,
            (zone_id, period_start, period_end),
        )
        active_months = cur.fetchone()[0]
        regularity = active_months / months

    return {
        "salesCount": int(sales_count or 0),
        "housesSalesCount": int(houses_count or 0),
        "apartmentsSalesCount": int(apartments_count or 0),
        "comparableSalesCount": int(comparable_count or 0),
        "medianPriceM2": float(median_price_m2) if median_price_m2 else None,
        "priceDispersion": float(price_dispersion) if price_dispersion else None,
        "highEndSalesRatio": float(high_end_ratio) if high_end_ratio else None,
        "regularitySalesIndex": float(regularity) if regularity else None,
    }


def compute_dpe_metrics(cur, zone_id: str, period_start: date, period_end: date) -> dict:
    cur.execute(
        """
        SELECT
            COUNT(*)                                                                AS dpe_count,
            COUNT(*) FILTER (WHERE "energyClass" IN ('E', 'F', 'G'))               AS efg_count,
            COUNT(*) FILTER (WHERE "energyClass" IN ('F', 'G'))                    AS fg_count,
            COUNT(*) FILTER (WHERE "housingType" = 'maison')                       AS house_count,
            COUNT(*) FILTER (WHERE "housingType" = 'appartement')                  AS apt_count,
            COUNT(*) FILTER (WHERE "constructionPeriod" IN (
                'Avant 1948', '1948-1974', '1975-1977'
            ))                                                                      AS old_count
        FROM dpe_diagnostics d
        WHERE ST_Within(d.geom, (SELECT geom FROM analysis_zones WHERE id = %s))
          AND d."diagnosticDate" BETWEEN %s AND %s
        """,
        (zone_id, period_start, period_end),
    )
    row = cur.fetchone()
    if not row:
        return {}

    dpe_count, efg_count, fg_count, house_count, apt_count, old_count = row
    total = dpe_count or 1

    return {
        "dpeCount": int(dpe_count or 0),
        "dpeEfgRatio": round(efg_count / total, 4) if dpe_count else None,
        "dpeFgRatio": round(fg_count / total, 4) if dpe_count else None,
        "houseRatio": round(house_count / total, 4) if dpe_count else None,
        "apartmentRatio": round(apt_count / total, 4) if dpe_count else None,
        "oldBuildingRatio": round(old_count / total, 4) if dpe_count else None,
    }


def compute_urbanisme_metrics(cur, zone_id: str, period_start: date, period_end: date) -> dict:
    cur.execute(
        """
        SELECT
            COUNT(*)                                                                          AS permits_count,
            COUNT(*) FILTER (WHERE "workCategory" = 'extension')                             AS extension_count,
            COUNT(*) FILTER (WHERE "workCategory" = 'construction_neuve')                    AS new_count,
            COUNT(*) FILTER (WHERE "workCategory" = 'demolition')                            AS demolition_count,
            AVG("surfaceCreated") FILTER (WHERE "surfaceCreated" > 0)                        AS avg_surface
        FROM urbanisme_projects u
        WHERE ST_Within(u.geom, (SELECT geom FROM analysis_zones WHERE id = %s))
          AND u."decisionDate" BETWEEN %s AND %s
        """,
        (zone_id, period_start, period_end),
    )
    row = cur.fetchone()
    if not row:
        return {}

    permits_count, ext_count, new_count, demo_count, avg_surface = row
    return {
        "permitsCount": int(permits_count or 0),
        "permitsExtensionCount": int(ext_count or 0),
        "permitsNewHousingCount": int(new_count or 0),
        "permitsDemolitionCount": int(demo_count or 0),
        "avgCreatedSurface": float(avg_surface) if avg_surface else None,
    }


def compute_evolution(current: float | None, prev: float | None) -> float | None:
    if current is None or prev is None or prev == 0:
        return None
    return round((current - prev) / prev * 100, 2)


def data_status(count: int, source: str) -> str:
    t = THRESHOLDS[source]
    if count >= t["strong"]:
        return "exploitable"
    if count >= t["min"]:
        return "fragile"
    return "insufficient"


def quality_warnings(dvf: dict, dpe: dict, urb: dict) -> list[str]:
    warnings = []
    if dvf.get("salesCount", 0) < THRESHOLDS["dvf"]["min"]:
        warnings.append("Données DVF insuffisantes")
    elif dvf.get("salesCount", 0) < THRESHOLDS["dvf"]["strong"]:
        warnings.append("Données DVF fragiles")
    if dpe.get("dpeCount", 0) < THRESHOLDS["dpe"]["min"]:
        warnings.append("Données DPE insuffisantes")
    elif dpe.get("dpeCount", 0) < THRESHOLDS["dpe"]["strong"]:
        warnings.append("Données DPE fragiles")
    if urb.get("permitsCount", 0) < THRESHOLDS["urbanisme"]["min"]:
        warnings.append("Données urbanisme insuffisantes")
    return warnings


def confidence_score(dvf: dict, dpe: dict, urb: dict) -> float:
    scores = []
    for count, source in [
        (dvf.get("salesCount", 0), "dvf"),
        (dpe.get("dpeCount", 0), "dpe"),
        (urb.get("permitsCount", 0), "urbanisme"),
    ]:
        t = THRESHOLDS[source]
        s = min(count / t["strong"], 1.0)
        scores.append(s)
    return round(sum(scores) / len(scores) * 100, 1)


def upsert_area_metric(cur, zone_id: str, period: str, period_start: date, period_end: date, metrics: dict) -> None:
    # Delete existing before insert (no unique constraint on entity)
    cur.execute(
        'DELETE FROM area_metrics WHERE "zoneId" = %s AND period = %s AND "periodEnd" = %s',
        (zone_id, period, period_end),
    )

    cur.execute(
        """
        INSERT INTO area_metrics (
            id, "zoneId", period, "periodStart", "periodEnd",
            "permitsCount", "permitsExtensionCount", "permitsNewHousingCount",
            "permitsDemolitionCount", "avgCreatedSurface", "permitsCountEvolution",
            "salesCount", "medianPriceM2", "priceM2Evolution",
            "medianPriceM2VsCommune", "medianPriceM2VsNeighbors",
            "priceDispersion", "housesSalesCount", "apartmentsSalesCount",
            "salesCountEvolution", "comparableSalesCount",
            "regularitySalesIndex", "highEndSalesRatio",
            "dpeCount", "dpeEfgRatio", "dpeFgRatio", "dpeEfgRatioEvolution",
            "houseRatio", "apartmentRatio", "oldBuildingRatio",
            "confidenceScore", "dpeStatus", "dvfStatus", "urbanismStatus",
            "weakSourcesCount", "recommendedZoneLevel", "qualityWarnings"
        ) VALUES (
            gen_random_uuid(), %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s
        )
        """,
        (
            zone_id, period, period_start, period_end,
            # urbanisme
            metrics.get("permitsCount", 0),
            metrics.get("permitsExtensionCount", 0),
            metrics.get("permitsNewHousingCount", 0),
            metrics.get("permitsDemolitionCount", 0),
            metrics.get("avgCreatedSurface"),
            metrics.get("permitsCountEvolution"),
            # dvf
            metrics.get("salesCount", 0),
            metrics.get("medianPriceM2"),
            metrics.get("priceM2Evolution"),
            metrics.get("medianPriceM2VsCommune"),
            None,  # medianPriceM2VsNeighbors — computed in score worker
            metrics.get("priceDispersion"),
            metrics.get("housesSalesCount", 0),
            metrics.get("apartmentsSalesCount", 0),
            metrics.get("salesCountEvolution"),
            metrics.get("comparableSalesCount", 0),
            metrics.get("regularitySalesIndex"),
            metrics.get("highEndSalesRatio"),
            # dpe
            metrics.get("dpeCount", 0),
            metrics.get("dpeEfgRatio"),
            metrics.get("dpeFgRatio"),
            metrics.get("dpeEfgRatioEvolution"),
            metrics.get("houseRatio"),
            metrics.get("apartmentRatio"),
            metrics.get("oldBuildingRatio"),
            # qualité
            metrics["confidenceScore"],
            metrics["dpeStatus"],
            metrics["dvfStatus"],
            metrics["urbanismStatus"],
            metrics["weakSourcesCount"],
            metrics["recommendedZoneLevel"],
            json.dumps(metrics["qualityWarnings"]),
        ),
    )


def get_reference_date(conn) -> date:
    """Use the latest DVF mutation date as reference, falling back to today."""
    with conn.cursor() as cur:
        cur.execute('SELECT MAX("mutationDate") FROM dvf_transactions')
        row = cur.fetchone()
        if row and row[0]:
            return row[0]
    return date.today()


def process_zone(conn, zone: dict, periods: list[str], reference_date: date | None = None) -> None:
    ref = reference_date or date.today()

    with conn.cursor() as cur:
        for period_key in periods:
            months = PERIODS[period_key]
            period_end = ref
            period_start = ref - relativedelta(months=months)
            prev_end = period_start
            prev_start = prev_end - relativedelta(months=months)

            # Métriques période courante
            dvf = compute_dvf_metrics(cur, zone["id"], period_start, period_end)
            dpe = compute_dpe_metrics(cur, zone["id"], period_start, period_end)
            urb = compute_urbanisme_metrics(cur, zone["id"], period_start, period_end)

            # Métriques période précédente pour les évolutions
            dvf_prev = compute_dvf_metrics(cur, zone["id"], prev_start, prev_end)
            dpe_prev = compute_dpe_metrics(cur, zone["id"], prev_start, prev_end)
            urb_prev = compute_urbanisme_metrics(cur, zone["id"], prev_start, prev_end)

            merged = {
                **dvf, **dpe, **urb,
                "priceM2Evolution": compute_evolution(
                    dvf.get("medianPriceM2"), dvf_prev.get("medianPriceM2")
                ),
                "salesCountEvolution": compute_evolution(
                    dvf.get("salesCount"), dvf_prev.get("salesCount")
                ),
                "permitsCountEvolution": compute_evolution(
                    urb.get("permitsCount"), urb_prev.get("permitsCount")
                ),
                "dpeEfgRatioEvolution": compute_evolution(
                    dpe.get("dpeEfgRatio"), dpe_prev.get("dpeEfgRatio")
                ),
                "confidenceScore": confidence_score(dvf, dpe, urb),
                "dpeStatus": data_status(dpe.get("dpeCount", 0), "dpe"),
                "dvfStatus": data_status(dvf.get("salesCount", 0), "dvf"),
                "urbanismStatus": data_status(urb.get("permitsCount", 0), "urbanisme"),
                "weakSourcesCount": sum([
                    1 for src, count in [
                        ("dpe", dpe.get("dpeCount", 0)),
                        ("dvf", dvf.get("salesCount", 0)),
                        ("urbanisme", urb.get("permitsCount", 0)),
                    ] if count < THRESHOLDS[src]["min"]
                ]),
                "recommendedZoneLevel": _recommended_level(zone["zone_type"], dvf, dpe),
                "qualityWarnings": quality_warnings(dvf, dpe, urb),
            }

            upsert_area_metric(cur, zone["id"], period_key, period_start, period_end, merged)

    conn.commit()


def _recommended_level(zone_type: str, dvf: dict, dpe: dict) -> str:
    sales = dvf.get("salesCount", 0)
    dpe_count = dpe.get("dpeCount", 0)
    if sales >= THRESHOLDS["dvf"]["strong"] and dpe_count >= THRESHOLDS["dpe"]["strong"]:
        return "micro"
    if sales >= THRESHOLDS["dvf"]["min"] or dpe_count >= THRESHOLDS["dpe"]["min"]:
        return "iris"
    return "commune"


def main():
    parser = argparse.ArgumentParser(description="Compute area_metrics from raw data")
    parser.add_argument("--commune", default=None, help="Filter by commune code, e.g. 35238")
    parser.add_argument("--periods", default="3m,6m,12m,24m", help="Comma-separated periods")
    args = parser.parse_args()

    periods = [p.strip() for p in args.periods.split(",")]
    unknown = [p for p in periods if p not in PERIODS]
    if unknown:
        print(f"Unknown periods: {unknown}. Valid: {list(PERIODS)}")
        sys.exit(1)

    conn = get_connection()
    try:
        ref_date = get_reference_date(conn)
        print(f"Reference date: {ref_date}")
        zones = get_zones(conn, args.commune)
        print(f"{len(zones)} zones to process × {len(periods)} periods")

        for zone in tqdm(zones, desc="Zones"):
            process_zone(conn, zone, periods, ref_date)

        print("Done.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
