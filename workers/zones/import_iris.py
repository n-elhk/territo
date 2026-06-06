"""
Import IRIS zones + commune zones into analysis_zones via l'API WFS IGN.

Source : IGN — CONTOURS-IRIS (WFS public, sans clé)
URL    : https://data.geopf.fr/wfs/ows
Layer  : STATISTICALUNITS.IRIS:contours_iris

Avantages vs shapefile : pas de téléchargement manuel, filtrage par département.

Usage:
    python workers/zones/import_iris.py --dept 35
    python workers/zones/import_iris.py --dept 35,44,56
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import requests
from tqdm import tqdm
from db import get_connection

WFS_URL = "https://data.geopf.fr/wfs/ows"
LAYER = "STATISTICALUNITS.IRIS:contours_iris"
PAGE_SIZE = 1000


def fetch_iris_page(dept: str, start_index: int) -> dict:
    params = {
        "SERVICE": "WFS",
        "VERSION": "2.0.0",
        "REQUEST": "GetFeature",
        "TYPENAMES": LAYER,
        "CQL_FILTER": f"code_iris LIKE '{dept}%'",
        "OUTPUTFORMAT": "application/json",
        "COUNT": PAGE_SIZE,
        "STARTINDEX": start_index,
    }
    resp = requests.get(WFS_URL, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def fetch_all_iris(dept: str) -> list[dict]:
    features = []
    start = 0
    while True:
        data = fetch_iris_page(dept, start)
        batch = data.get("features", [])
        features.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        start += PAGE_SIZE
    return features


def upsert_iris_zones(conn, features: list[dict]) -> int:
    inserted = 0
    with conn.cursor() as cur:
        for f in tqdm(features, desc="  IRIS"):
            props = f.get("properties", {})
            geom_json = json.dumps(f["geometry"]) if f.get("geometry") else None

            nom_iris = props.get("nom_iris") or ""
            nom_commune = props.get("nom_commune") or ""
            code_insee = props.get("code_insee") or ""
            name = f"{nom_commune} — {nom_iris}" if nom_iris and nom_iris != nom_commune else nom_commune

            cur.execute(
                """
                INSERT INTO analysis_zones (id, "zoneType", name, "communeCode", geom)
                VALUES (
                    gen_random_uuid(), 'iris', %s, %s,
                    ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                )
                ON CONFLICT DO NOTHING
                """,
                (name, code_insee, geom_json),
            )
            inserted += cur.rowcount
    conn.commit()
    return inserted


def upsert_commune_zones(conn, features: list[dict]) -> int:
    # Collect commune names from features — PostGIS does the ST_Union on already-inserted IRIS
    communes: dict[str, str] = {}
    for f in features:
        props = f.get("properties", {})
        code_insee = props.get("code_insee") or ""
        nom_commune = props.get("nom_commune") or ""
        if code_insee and code_insee not in communes:
            communes[code_insee] = nom_commune

    inserted = 0
    with conn.cursor() as cur:
        for code_insee, nom_commune in tqdm(communes.items(), desc="  Communes"):
            cur.execute(
                """
                INSERT INTO analysis_zones (id, "zoneType", name, "communeCode", geom)
                SELECT gen_random_uuid(), 'commune', %s, "communeCode", ST_Union(geom)
                FROM analysis_zones
                WHERE "zoneType" = 'iris' AND "communeCode" = %s
                GROUP BY "communeCode"
                ON CONFLICT DO NOTHING
                """,
                (nom_commune, code_insee),
            )
            inserted += cur.rowcount
    conn.commit()
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Import IRIS zones via WFS IGN")
    parser.add_argument("--dept", required=True, help="Comma-separated dept codes, e.g. 35,44,56")
    parser.add_argument("--no-communes", action="store_true", help="Skip commune aggregation")
    args = parser.parse_args()

    depts = [d.strip() for d in args.dept.split(",")]
    conn = get_connection()

    try:
        for dept in depts:
            print(f"\n→ Département {dept}")
            features = fetch_all_iris(dept)
            print(f"  {len(features)} IRIS récupérés")

            iris_count = upsert_iris_zones(conn, features)
            print(f"  Inserted {iris_count} IRIS zones")

            if not args.no_communes:
                commune_count = upsert_commune_zones(conn, features)
                print(f"  Inserted {commune_count} commune zones")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
