"""
Import DPE diagnostics into dpe_diagnostics.

Source : ADEME — DPE logements existants (depuis juillet 2021)
URL    : https://data.ademe.fr/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines

Les données sont paginées (max 10 000 par page). Le worker filtre par département
via le champ code_departement_ban pour éviter de télécharger la France entière d'un coup.

Usage:
    python workers/dpe/import_dpe.py --dept 35
    python workers/dpe/import_dpe.py --dept 35,44,56
"""

import argparse
import hashlib
from urllib.parse import urlparse, parse_qs


import time
import requests
from tqdm import tqdm
from db import get_connection

ADEME_API = "https://data.ademe.fr/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines"
PAGE_SIZE = 10_000
BATCH_SIZE = 500

HOUSING_TYPE_MAP = {
    "maison individuelle": "maison",
    "maison": "maison",
    "appartement": "appartement",
    "immeuble": "immeuble_collectif",
    "immeuble collectif": "immeuble_collectif",
}

SELECT_COLS = ",".join([
    "numero_dpe",
    "date_etablissement_dpe",
    "etiquette_dpe",
    "etiquette_ges",
    "type_batiment",
    "surface_habitable_immeuble",
    "periode_construction",
    "code_insee_ban",
    "code_departement_ban",
    "_geopoint",
])


def _hash(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.strip().encode()).hexdigest()[:32]


def _energy_class(val: str | None) -> str | None:
    if val and val.strip().upper() in "ABCDEFG":
        return val.strip().upper()
    return None


def _housing_type(val: str | None) -> str:
    if not val:
        return "maison"
    return HOUSING_TYPE_MAP.get(val.strip().lower(), "maison")


def _parse_geopoint(geopoint: str | None) -> tuple[float | None, float | None]:
    """Parse data-fair _geopoint field ("lat,lon") → (lng, lat)."""
    if not geopoint:
        return None, None
    try:
        parts = str(geopoint).split(",")
        lat = float(parts[0])
        lng = float(parts[1])
        return lng, lat
    except (ValueError, IndexError):
        return None, None


def fetch_page(dept: str, after: str | None) -> dict:
    params = {
        "size": PAGE_SIZE,
        "select": SELECT_COLS,
        "q": dept,
        "q_fields": "code_departement_ban",
    }
    if after:
        params["after"] = after

    for attempt in range(5):
        resp = requests.get(ADEME_API, params=params, timeout=60)
        if resp.status_code == 429:
            wait = 10 * (2 ** attempt)
            print(f"  429 rate limit — attente {wait}s …")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()

    raise RuntimeError("Trop de tentatives (429)")


def insert_batch(cur, rows: list[tuple]) -> None:
    cur.executemany(
        """
        INSERT INTO dpe_diagnostics (
            id, "dpeNumberHash", "diagnosticDate", "energyClass", "gesClass",
            "housingType", "builtSurface", "constructionPeriod",
            "addressHash", "communeCode", geom, "confidenceLevel"
        ) VALUES (
            gen_random_uuid(), %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s,
            CASE WHEN %s IS NOT NULL AND %s IS NOT NULL
                 THEN ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                 ELSE NULL END,
            1.0
        )
        ON CONFLICT DO NOTHING
        """,
        rows,
    )


def process_dept(conn, dept: str) -> int:
    print(f"\n→ Département {dept}")
    after = None
    total = 0
    page = 0

    while True:
        data = fetch_page(dept, after)
        items = data.get("results", [])
        if not items:
            break

        page += 1
        rows = []
        for item in items:
            lng, lat = _parse_geopoint(item.get("_geopoint"))

            try:
                surface = float(item.get("surface_habitable_immeuble") or 0) or None
            except (ValueError, TypeError):
                surface = None

            rows.append((
                _hash(item.get("numero_dpe")),
                item.get("date_etablissement_dpe"),
                _energy_class(item.get("etiquette_dpe")),
                _energy_class(item.get("etiquette_ges")),
                _housing_type(item.get("type_batiment")),
                surface,
                item.get("periode_construction"),
                None,  # addressHash — pas d'adresse individuelle dans ce dataset
                item.get("code_insee_ban"),
                lng, lat, lng, lat,  # geom params (x4)
            ))

        with conn.cursor() as cur:
            insert_batch(cur, rows)
        conn.commit()
        total += len(rows)
        print(f"  Page {page}: +{len(rows)} (total {total})")

        # data-fair returns "next" as a full URL — extract the cursor value from it
        next_url = data.get("next")
        if not next_url:
            break
        after = parse_qs(urlparse(next_url).query).get("after", [None])[0]
        if not after:
            break
        time.sleep(3)

    return total


def main():
    parser = argparse.ArgumentParser(description="Import DPE from ADEME API")
    parser.add_argument("--dept", required=True, help="Comma-separated dept codes, e.g. 35,44")
    args = parser.parse_args()

    depts = [d.strip() for d in args.dept.split(",")]

    conn = get_connection()
    try:
        grand_total = 0
        for dept in tqdm(depts, desc="Départements"):
            n = process_dept(conn, dept)
            print(f"  Inserted {n} DPE for dept {dept}")
            grand_total += n
        print(f"\nTotal inserted: {grand_total}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
