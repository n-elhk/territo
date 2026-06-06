"""
Import DVF transactions into dvf_transactions.

Source : data.gouv.fr — Géo-DVF (fichiers CSV par département et par année)
URL    : https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/departements/{dept}.csv

Usage:
    # Un département, plusieurs années
    python workers/dvf/import_dvf.py --dept 35 --years 2022,2023,2024

    # Plusieurs départements
    python workers/dvf/import_dvf.py --dept 35,44,56 --years 2023,2024
"""

import argparse
import hashlib
import io
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
import requests
from tqdm import tqdm
from db import get_connection

DVF_BASE_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/departements/{dept}.csv.gz"

BATCH_SIZE = 500

# Mapping type_local → enum PropertyType
PROPERTY_TYPE_MAP = {
    "Maison": "maison",
    "Appartement": "appartement",
    "Dépendance": "dependance",
    "Local industriel. commercial ou assimilé": "local",
}

DVF_COLS = [
    "id_mutation",
    "date_mutation",
    "valeur_fonciere",
    "code_commune",
    "id_parcelle",
    "type_local",
    "surface_reelle_bati",
    "surface_terrain",
    "longitude",
    "latitude",
]


def download_dvf(dept: str, year: int) -> pd.DataFrame:
    url = DVF_BASE_URL.format(year=year, dept=dept)
    print(f"  Downloading {url} …")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    df = pd.read_csv(
        io.BytesIO(resp.content),
        compression="gzip",
        usecols=lambda c: c in DVF_COLS,
        dtype=str,
        low_memory=False,
    )
    print(f"  {len(df)} rows downloaded")
    return df


def clean_dvf(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Parse types
    df["valeur_fonciere"] = pd.to_numeric(df["valeur_fonciere"].str.replace(",", "."), errors="coerce")
    df["surface_reelle_bati"] = pd.to_numeric(df["surface_reelle_bati"].str.replace(",", "."), errors="coerce")
    df["surface_terrain"] = pd.to_numeric(df["surface_terrain"].str.replace(",", "."), errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"].str.replace(",", "."), errors="coerce")
    df["latitude"] = pd.to_numeric(df["latitude"].str.replace(",", "."), errors="coerce")
    df["date_mutation"] = pd.to_datetime(df["date_mutation"], errors="coerce")

    # Drop invalid rows
    df = df.dropna(subset=["valeur_fonciere", "date_mutation", "code_commune"])
    df = df[df["valeur_fonciere"] > 0]

    # One row per mutation (aggregate lots)
    df = (
        df.groupby("id_mutation")
        .agg(
            date_mutation=("date_mutation", "first"),
            valeur_fonciere=("valeur_fonciere", "first"),
            code_commune=("code_commune", "first"),
            id_parcelle=("id_parcelle", "first"),
            type_local=("type_local", "first"),
            surface_reelle_bati=("surface_reelle_bati", "sum"),
            surface_terrain=("surface_terrain", "sum"),
            longitude=("longitude", "first"),
            latitude=("latitude", "first"),
        )
        .reset_index()
    )

    # Map property type — terrain if no type_local
    df["property_type"] = df["type_local"].map(PROPERTY_TYPE_MAP).fillna("terrain")

    # price per m2
    df["price_per_m2"] = (
        (df["valeur_fonciere"] / df["surface_reelle_bati"])
        .where(df["surface_reelle_bati"] > 0)
    )

    # Null out 0-surfaces
    df["surface_reelle_bati"] = df["surface_reelle_bati"].where(df["surface_reelle_bati"] > 0)
    df["surface_terrain"] = df["surface_terrain"].where(df["surface_terrain"] > 0)

    return df


def _none(val):
    """Convert NaN to None for psycopg2."""
    if pd.isna(val):
        return None
    return val


def insert_batch(cur, batch: list[tuple]) -> int:
    cur.executemany(
        """
        INSERT INTO dvf_transactions (
            id, "mutationDate", price, "builtSurface", "landSurface",
            "propertyType", "communeCode", "parcelId", "pricePerM2", geom
        ) VALUES (
            gen_random_uuid(), %s, %s, %s, %s,
            %s, %s, %s, %s,
            CASE WHEN %s IS NOT NULL AND %s IS NOT NULL
                 THEN ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                 ELSE NULL END
        )
        ON CONFLICT DO NOTHING
        """,
        batch,
    )
    return cur.rowcount


def process_dept_year(conn, dept: str, year: int) -> int:
    try:
        df = download_dvf(dept, year)
    except requests.HTTPError as e:
        print(f"  Skipping {dept}/{year}: {e}")
        return 0

    df = clean_dvf(df)
    print(f"  {len(df)} mutations after aggregation")

    inserted = 0
    rows = []
    for _, row in df.iterrows():
        lng = _none(row["longitude"])
        lat = _none(row["latitude"])
        rows.append((
            row["date_mutation"].date(),
            _none(row["valeur_fonciere"]),
            _none(row["surface_reelle_bati"]),
            _none(row["surface_terrain"]),
            row["property_type"],
            row["code_commune"],
            _none(row["id_parcelle"]),
            _none(row["price_per_m2"]),
            lng, lat, lng, lat,  # geom params (x4 for the CASE)
        ))

        if len(rows) >= BATCH_SIZE:
            with conn.cursor() as cur:
                insert_batch(cur, rows)
            conn.commit()
            inserted += len(rows)
            rows = []

    if rows:
        with conn.cursor() as cur:
            insert_batch(cur, rows)
        conn.commit()
        inserted += len(rows)

    return inserted


def main():
    parser = argparse.ArgumentParser(description="Import DVF transactions from data.gouv.fr")
    parser.add_argument("--dept", required=True, help="Comma-separated dept codes, e.g. 35,44")
    parser.add_argument("--years", default="2022,2023,2024", help="Comma-separated years")
    args = parser.parse_args()

    depts = [d.strip() for d in args.dept.split(",")]
    years = [int(y.strip()) for y in args.years.split(",")]

    conn = get_connection()
    try:
        total = 0
        for dept in tqdm(depts, desc="Départements"):
            for year in years:
                print(f"\n→ {dept} / {year}")
                n = process_dept_year(conn, dept, year)
                print(f"  Inserted {n} transactions")
                total += n
        print(f"\nTotal inserted: {total}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
