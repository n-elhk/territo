"""
Calcule les zone_scores depuis les area_metrics.

Flow :
  area_metrics (par zone × période)
  → normalisation percentile p5/p95 sur l'ensemble des zones
  → sous-scores 0-100 par formule métier
  → globalScore = somme pondérée
  → visibilité + trend + explication
  → upsert zone_scores

Configs de pondération : scoring_configs en base (fallback : DEFAULT_CONFIGS).

Usage:
    python workers/scores/compute_zone_scores.py
    python workers/scores/compute_zone_scores.py --period 12m
    python workers/scores/compute_zone_scores.py --period 12m --commune 35238
"""

import argparse
import json
import sys
from datetime import datetime, timezone


from tqdm import tqdm
from db import get_connection

# ---------------------------------------------------------------------------
# Configs de scoring par défaut (utilisées si scoring_configs est vide en base)
# Chaque sous-score est une clé de area_metrics (ou une formule nommée).
# Les poids doivent sommer à 1.0.
# ---------------------------------------------------------------------------
DEFAULT_CONFIGS = {
    "prospection_locale": {
        "user_segment": "artisan",
        "weights": {
            "renovation_need":   0.35,  # dpeEfgRatio — besoins rénov énergétique
            "work_signals":      0.30,  # extensions / total permis
            "old_building":      0.20,  # oldBuildingRatio — vieux bâti
            "market_activity":   0.15,  # salesCount normalisé — signal clientèle
        },
    },
    "demande_btp": {
        "user_segment": "artisan",
        "weights": {
            "new_construction":  0.40,  # permitsNewHousingCount
            "extension_activity":0.35,  # permitsExtensionCount
            "market_size":       0.25,  # permitsCount global
        },
    },
    "transformation_immo": {
        "user_segment": "agence_immo",
        "weights": {
            "price_evolution":   0.30,  # priceM2Evolution
            "market_activity":   0.30,  # salesCount
            "regularity":        0.25,  # regularitySalesIndex
            "high_end":          0.15,  # highEndSalesRatio
        },
    },
    "prospection_vendeurs": {
        "user_segment": "agence_immo",
        "weights": {
            "old_building":      0.35,  # oldBuildingRatio — vieux bâti = propriétaires mûrs
            "renovation_need":   0.30,  # dpeEfgRatio — contrainte rénov pousse à vendre
            "low_market_flow":   0.20,  # inverse salesCount — zone peu active = stock latent
            "fg_urgency":        0.15,  # dpeFgRatio — F/G = pression réglementaire 2028
        },
    },
    "liquidite_marche": {
        "user_segment": "agence_immo",
        "weights": {
            "regularity":        0.40,  # regularitySalesIndex — ventes chaque mois
            "volume":            0.35,  # salesCount — volume global
            "price_consistency": 0.25,  # inverse priceDispersion — prix stables = marché fluide
        },
    },
    "quartier_mutation": {
        "user_segment": "agence_immo",
        "weights": {
            "new_construction":  0.35,  # permitsNewHousingCount — arrivée de neuf
            "extension_wave":    0.30,  # permitsExtensionCount — rénovation en cours
            "dpe_activity":      0.20,  # dpeCount normalisé — diagnostics = transactions imminentes
            "renovation_need":   0.15,  # dpeEfgRatio — bâti à rénover = mutation potentielle
        },
    },
    "valorisation_prix": {
        "user_segment": "agence_immo",
        "weights": {
            "renovation_potential": 0.35,  # dpeFgRatio — F/G rénové → hausse valeur
            "old_building":         0.30,  # oldBuildingRatio — bâti ancien sous-valorisé
            "construction_signal":  0.20,  # permitsNewHousingCount — arrivée de neuf tire les prix
            "extension_activity":   0.15,  # permitsExtensionCount — propriétaires qui investissent
        },
    },
}

PERIODS = ["3m", "6m", "12m", "24m", "36m", "48m"]

BATCH_SIZE = 200


# ---------------------------------------------------------------------------
# Extraction des sous-scores bruts depuis une ligne area_metrics
# ---------------------------------------------------------------------------
def raw_sub_scores(m: dict, score_type: str) -> dict[str, float | None]:
    permits_total = float(m.get("permitscount") or 0)

    if score_type == "prospection_locale":
        work_signals = (
            float(m.get("permitsextensioncount") or 0) / permits_total
            if permits_total > 0
            else None
        )
        return {
            "renovation_need":  _f(m.get("dpeefgratio")),
            "work_signals":     work_signals,
            "old_building":     _f(m.get("oldbuildingratio")),
            "market_activity":  _f(m.get("salescount")),
        }

    if score_type == "demande_btp":
        return {
            "new_construction":   _f(m.get("permitsnewhousingcount")),
            "extension_activity": _f(m.get("permitsextensioncount")),
            "market_size":        _f(m.get("permitscount")),
        }

    if score_type == "transformation_immo":
        return {
            "price_evolution": _f(m.get("pricem2evolution")),
            "market_activity": _f(m.get("salescount")),
            "regularity":      _f(m.get("regularitysalesindex")),
            "high_end":        _f(m.get("highendsalesratio")),
        }

    sales = _f(m.get("salescount"))

    if score_type == "prospection_vendeurs":
        low_market_flow = (1.0 - min(sales / 50.0, 1.0)) if sales is not None else None
        return {
            "old_building":    _f(m.get("oldbuildingratio")),
            "renovation_need": _f(m.get("dpeefgratio")),
            "low_market_flow": low_market_flow,
            "fg_urgency":      _f(m.get("dpefgratio")),
        }

    if score_type == "liquidite_marche":
        dispersion = _f(m.get("pricedispersion"))
        price_consistency = (1.0 - min(dispersion, 1.0)) if dispersion is not None else None
        return {
            "regularity":        _f(m.get("regularitysalesindex")),
            "volume":            sales,
            "price_consistency": price_consistency,
        }

    if score_type == "quartier_mutation":
        return {
            "new_construction": _f(m.get("permitsnewhousingcount")),
            "extension_wave":   _f(m.get("permitsextensioncount")),
            "dpe_activity":     _f(m.get("dpecount")),
            "renovation_need":  _f(m.get("dpeefgratio")),
        }

    if score_type == "valorisation_prix":
        return {
            "renovation_potential": _f(m.get("dpefgratio")),
            "old_building":         _f(m.get("oldbuildingratio")),
            "construction_signal":  _f(m.get("permitsnewhousingcount")),
            "extension_activity":   _f(m.get("permitsextensioncount")),
        }

    return {}


def _f(val) -> float | None:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Normalisation p5/p95 → 0-100
# ---------------------------------------------------------------------------
def compute_bounds(metrics: list[dict], score_type: str) -> dict[str, tuple[float, float]]:
    """Calcule les percentiles p5/p95 pour chaque sous-score sur l'ensemble des zones."""
    from statistics import quantiles

    keys = list(DEFAULT_CONFIGS[score_type]["weights"].keys())
    raw_all: dict[str, list[float]] = {k: [] for k in keys}

    for m in metrics:
        raw = raw_sub_scores(m, score_type)
        for k, v in raw.items():
            if v is not None:
                raw_all[k].append(v)

    bounds = {}
    for k, vals in raw_all.items():
        if len(vals) >= 10:
            qs = quantiles(vals, n=20)  # vigintiles → q1=p5, q19=p95
            bounds[k] = (qs[0], qs[18])
        elif vals:
            bounds[k] = (min(vals), max(vals))
        else:
            bounds[k] = (0.0, 1.0)

    return bounds


def normalize(val: float | None, lo: float, hi: float) -> float:
    if val is None:
        return 0.0
    if hi <= lo:
        return 50.0
    return max(0.0, min(100.0, (val - lo) / (hi - lo) * 100))


# ---------------------------------------------------------------------------
# Score global + trend + visibilité + explications
# ---------------------------------------------------------------------------
def compute_global_score(sub_scores_normalized: dict[str, float], weights: dict[str, float]) -> float:
    total = sum(sub_scores_normalized.get(k, 0) * w for k, w in weights.items())
    return round(total, 1)


def visibility(confidence: float, weak_sources: int) -> str:
    if confidence >= 60 and weak_sources == 0:
        return "visible"
    if confidence >= 40 or weak_sources <= 1:
        return "caution"
    if confidence >= 20:
        return "greyed"
    return "hidden"


def trend_label(delta: float | None) -> str | None:
    if delta is None:
        return None
    if delta > 10:
        return "acceleration"
    if delta > 3:
        return "hausse"
    if delta < -10:
        return "ralentissement"
    if delta < -3:
        return "baisse"
    return "stable"


def explanations(m: dict, score_type: str, sub_scores: dict[str, float]) -> list[str]:
    parts = []

    if score_type == "prospection_locale":
        efg = _f(m.get("dpeefgratio"))
        if efg and efg > 0.5:
            parts.append(f"{round(efg*100)}% des logements classés E/F/G — fort besoin rénov")
        ext = _f(m.get("permitsextensioncount"))
        if ext and ext > 5:
            parts.append(f"{int(ext)} extensions autorisées sur la période")
        old = _f(m.get("oldbuildingratio"))
        if old and old > 0.4:
            parts.append(f"{round(old*100)}% de bâti avant 1977")

    if score_type == "demande_btp":
        new = _f(m.get("permitsnewhousingcount"))
        if new and new > 10:
            parts.append(f"{int(new)} logements neufs autorisés")
        ext = _f(m.get("permitsextensioncount"))
        if ext and ext > 5:
            parts.append(f"{int(ext)} extensions autorisées")

    if score_type == "transformation_immo":
        evol = _f(m.get("pricem2evolution"))
        if evol and evol > 3:
            parts.append(f"Prix/m² en hausse de {round(evol, 1)}%")
        elif evol and evol < -3:
            parts.append(f"Prix/m² en baisse de {round(abs(evol), 1)}%")
        sales = _f(m.get("salescount"))
        if sales:
            parts.append(f"{int(sales)} ventes sur la période")
        reg = _f(m.get("regularitysalesindex"))
        if reg and reg > 0.7:
            parts.append("Marché régulier (ventes chaque mois)")

    if score_type == "prospection_vendeurs":
        old = _f(m.get("oldbuildingratio"))
        if old and old > 0.4:
            parts.append(f"{round(old*100)}% de bâti avant 1977")
        fg = _f(m.get("dpefgratio"))
        if fg and fg > 0.2:
            parts.append(f"{round(fg*100)}% de logements F/G — pression réglementaire 2028")
        sales = _f(m.get("salescount"))
        if sales is not None and sales < 10:
            parts.append("Marché peu actif — stock de vendeurs potentiels")

    if score_type == "liquidite_marche":
        reg = _f(m.get("regularitysalesindex"))
        if reg and reg > 0.7:
            parts.append("Ventes régulières chaque mois")
        sales = _f(m.get("salescount"))
        if sales:
            parts.append(f"{int(sales)} ventes sur la période")
        disp = _f(m.get("pricedispersion"))
        if disp is not None and disp < 0.15:
            parts.append("Prix homogènes — marché fluide")

    if score_type == "quartier_mutation":
        new = _f(m.get("permitsnewhousingcount"))
        if new and new > 5:
            parts.append(f"{int(new)} logements neufs autorisés")
        ext = _f(m.get("permitsextensioncount"))
        if ext and ext > 5:
            parts.append(f"{int(ext)} extensions en cours")
        dpe = _f(m.get("dpecount"))
        if dpe and dpe > 20:
            parts.append(f"{int(dpe)} DPE réalisés — transactions imminentes")

    if score_type == "valorisation_prix":
        fg = _f(m.get("dpefgratio"))
        if fg and fg > 0.2:
            parts.append(f"{round(fg*100)}% de logements F/G à fort potentiel après rénov")
        old = _f(m.get("oldbuildingratio"))
        if old and old > 0.4:
            parts.append(f"{round(old*100)}% de bâti ancien sous-valorisé")
        new = _f(m.get("permitsnewhousingcount"))
        if new and new > 5:
            parts.append(f"{int(new)} logements neufs autorisés — tire les prix à la hausse")

    return parts[:3]


# ---------------------------------------------------------------------------
# Chargement des configs depuis la base (fallback DEFAULT_CONFIGS)
# ---------------------------------------------------------------------------
def load_scoring_configs(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "scoreType", "userSegment", "tradeOrCategory", weights FROM scoring_configs WHERE active = true'
        )
        rows = cur.fetchall()

    if not rows:
        return DEFAULT_CONFIGS

    configs = {}
    for score_type, user_segment, trade, weights in rows:
        configs[score_type] = {
            "user_segment": user_segment,
            "trade_or_category": trade,
            "weights": weights,
        }
    return configs


# ---------------------------------------------------------------------------
# Chargement des area_metrics
# ---------------------------------------------------------------------------
def load_metrics(conn, period: str, commune_code: str | None) -> list[dict]:
    with conn.cursor() as cur:
        if commune_code:
            cur.execute(
                """
                SELECT am.*, az."communeCode", az."zoneType"
                FROM area_metrics am
                JOIN analysis_zones az ON az.id = am."zoneId"::uuid
                WHERE am.period = %s AND az."communeCode" = %s
                """,
                (period, commune_code),
            )
        else:
            cur.execute(
                """
                SELECT am.*, az."communeCode", az."zoneType"
                FROM area_metrics am
                JOIN analysis_zones az ON az.id = am."zoneId"::uuid
                WHERE am.period = %s
                """,
                (period,),
            )
        cols = [d[0].lower() for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Upsert zone_scores
# ---------------------------------------------------------------------------
def upsert_scores(conn, rows: list[tuple], period: str, score_types: list[str]) -> None:
    with conn.cursor() as cur:
        # Supprime les scores existants pour cette période/score_types avant recalcul
        cur.execute(
            'DELETE FROM zone_scores WHERE period = %s AND "scoreType" = ANY(%s::zone_scores_scoretype_enum[])',
            (period, score_types),
        )
        for i in range(0, len(rows), BATCH_SIZE):
            cur.executemany(
                """
                INSERT INTO zone_scores (
                    id, "zoneId", "scoreType", "userSegment", "tradeOrCategory",
                    period, "periodStart", "periodEnd",
                    "globalScore", "subScores",
                    "trendScore", "globalScoreDeltaPrevious", "globalScoreDeltaYear",
                    "trendLabel", "confidenceScore", "scoreVisibility",
                    "weakSourcesCount", "qualityWarnings", "fallbackZoneId",
                    explanation, "generatedAt"
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    NULL, %s, NULL,
                    %s, %s, %s,
                    %s, %s, NULL,
                    %s, %s
                )
                """,
                rows[i : i + BATCH_SIZE],
            )
    conn.commit()


# ---------------------------------------------------------------------------
# Traitement d'une période
# ---------------------------------------------------------------------------
def process_period(conn, period: str, configs: dict, commune_code: str | None) -> int:
    metrics = load_metrics(conn, period, commune_code)
    if not metrics:
        print(f"  Aucune metric pour {period}")
        return 0

    print(f"  {len(metrics)} zones × {len(configs)} score types")
    now = datetime.now(timezone.utc)
    rows = []

    for score_type, cfg in configs.items():
        weights = cfg["weights"]
        bounds = compute_bounds(metrics, score_type)

        for m in metrics:
            zone_id = m["zoneid"]
            raw = raw_sub_scores(m, score_type)
            norm = {k: normalize(v, *bounds.get(k, (0, 1))) for k, v in raw.items()}
            global_score = compute_global_score(norm, weights)

            confidence = float(m.get("confidencescore") or 0)
            weak = int(m.get("weaksourcescount") or 0)
            warnings = m.get("qualitywarnings") or []
            if isinstance(warnings, str):
                warnings = json.loads(warnings)

            prev_score = None  # computed in a second pass if needed

            rows.append((
                zone_id,
                score_type,
                cfg.get("user_segment"),
                cfg.get("trade_or_category"),
                period,
                m["periodstart"],
                m["periodend"],
                global_score,
                json.dumps(norm),
                prev_score,
                trend_label(prev_score),
                confidence,
                visibility(confidence, weak),
                weak,
                json.dumps(warnings),
                json.dumps(explanations(m, score_type, norm)),
                now,
            ))

    upsert_scores(conn, rows, period, list(configs.keys()))
    return len(rows)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Compute zone_scores from area_metrics")
    parser.add_argument("--period", default=None, help="Période unique ex: 12m (défaut: toutes)")
    parser.add_argument("--commune", default=None, help="Filtrer par commune ex: 35238")
    args = parser.parse_args()

    periods = [args.period] if args.period else PERIODS
    unknown = [p for p in periods if p not in PERIODS]
    if unknown:
        print(f"Période(s) inconnue(s): {unknown}. Valeurs: {PERIODS}")
        sys.exit(1)

    conn = get_connection()
    try:
        configs = load_scoring_configs(conn)
        print(f"{len(configs)} score types à calculer : {list(configs.keys())}")

        total = 0
        for period in tqdm(periods, desc="Périodes"):
            print(f"\n→ Période {period}")
            n = process_period(conn, period, configs, args.commune)
            total += n

        print(f"\nTotal scores générés : {total}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
