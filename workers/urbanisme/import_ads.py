"""
Import permis d'urbanisme (PC/DP) depuis SITADEL via l'API Dido (SDES).

Source : SDES Dido — Liste des autorisations d'urbanisme créant des logements
URL    : https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles/{RID}/json
Filtre : DEP_CODE=eq:{dept}

Usage:
    python workers/urbanisme/import_ads.py --dept 35
    python workers/urbanisme/import_ads.py --dept 35,44,56
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import requests
from tqdm import tqdm
from db import get_connection

SITADEL_URL = "https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles/8b35affb-55fc-4c1f-915b-7750f974446a/json"

BATCH_SIZE = 500

PROJECT_TYPE_MAP = {"PC": "PC", "DP": "DP", "PA": "PA", "PD": "PD"}

WORK_CATEGORY_RULES = [
    (["demolition", "démolition", "démolir"], "demolition"),
    (["surélévation", "surelevation"], "surelevation"),
    (["division", "lotissement"], "division_logement"),
    (["changement", "destination", "activité", "activite"], "changement_destination"),
    (["extension", "agrandissement", "annexe"], "extension"),
    (["rénovation", "renovation", "réhabilitation", "rehabilitation", "travaux"], "renovation"),
    (["construction neuve", "neuf", "nouveau"], "construction_neuve"),
]


def map_project_type(val: str | None) -> str:
    return PROJECT_TYPE_MAP.get(str(val or "").strip().upper(), "PC")


def map_work_category(nature: str | None, destination: str | None) -> str:
    text = " ".join(str(v) for v in [nature, destination] if v).lower()
    for keywords, cat in WORK_CATEGORY_RULES:
        if any(kw in text for kw in keywords):
            return cat
    return "autre"


def _parse_date(val) -> str | None:
    if not val:
        return None
    s = str(val).strip()
    if len(s) == 7 and s[4] == "-":
        return f"{s}-01"
    if len(s) == 6 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-01"
    return s if len(s) == 10 else None


def _float(val) -> float | None:
    try:
        return float(val) or None
    except (ValueError, TypeError):
        return None


def fetch_dept(dept: str) -> list[dict]:
    print(f"\n→ Département {dept}")
    resp = requests.get(SITADEL_URL, params={"DEP_CODE": f"eq:{dept}"}, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    print(f"  {len(data)} autorisations")
    return data


def upsert(conn, records: list[dict]) -> int:
    rows = []
    for r in records:
        commune_code = str(r.get("COMM") or "").strip().zfill(5) or None
        if not commune_code:
            continue

        rows.append((
            str(r.get("NUM_DAU") or "").strip() or f"{commune_code}_{id(r)}",
            commune_code,
            map_project_type(r.get("TYPE_DAU")),
            map_work_category(r.get("NATURE_PROJET_COMPLETEE"), r.get("DESTINATION_PRINCIPALE")),
            _parse_date(r.get("DATE_REELLE_AUTORISATION")),
            _parse_date(r.get("DR_DEPOT")),
            _parse_date(r.get("DATE_REELLE_DOC")),
            _parse_date(r.get("DATE_REELLE_DAACT")),
            _float(r.get("SURF_HAB_CREEE")),
            _float(r.get("SURF_HAB_AVANT")),
            str(r.get("DESTINATION_PRINCIPALE") or "")[:255] or None,
        ))

    with conn.cursor() as cur:
        for i in range(0, len(rows), BATCH_SIZE):
            cur.executemany(
                """
                INSERT INTO urbanisme_projects (
                    id, "sourceId", "communeCode",
                    "projectType", "workCategory",
                    "decisionDate", "filingDate", "openingDate", "completionDate",
                    "surfaceCreated", "surfaceExisting", destination, geom,
                    "confidenceLevel"
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, NULL, 1.0
                )
                ON CONFLICT ("sourceId") DO NOTHING
                """,
                rows[i : i + BATCH_SIZE],
            )
    conn.commit()
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Import SITADEL via Dido API")
    parser.add_argument("--dept", required=True, help="Comma-separated dept codes, e.g. 35,44")
    args = parser.parse_args()

    depts = [d.strip() for d in args.dept.split(",")]
    conn = get_connection()

    try:
        total = 0
        for dept in tqdm(depts, desc="Départements"):
            records = fetch_dept(dept)
            n = upsert(conn, records)
            print(f"  Inserted {n} permits")
            total += n
        print(f"\nTotal inserted: {total}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
