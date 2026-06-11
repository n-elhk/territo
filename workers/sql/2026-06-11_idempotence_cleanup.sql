-- Nettoyage one-off avant l'ajout des clés naturelles d'idempotence.
-- À exécuter UNE FOIS avant de redémarrer l'API (synchronize créera ensuite
-- la colonne "mutationId" et les contraintes uniques sans erreur).
--
--   psql -h localhost -U territo -d territo -f workers/sql/2026-06-11_idempotence_cleanup.sql

BEGIN;

-- 1. DVF : la table ne porte pas encore "mutationId" (NOT NULL), impossible de
--    l'ajouter sur des lignes existantes — et les données sont intégralement
--    ré-importables depuis geo-DVF. On repart de zéro.
TRUNCATE dvf_transactions;

-- 2. DPE : dédoublonner sur la clé naturelle avant la contrainte unique.
--    On garde une ligne par "dpeNumberHash" et on supprime les lignes sans hash
--    (non dédupliquables, ré-importées proprement au prochain run).
DELETE FROM dpe_diagnostics a
USING dpe_diagnostics b
WHERE a."dpeNumberHash" = b."dpeNumberHash"
  AND a.ctid > b.ctid;

DELETE FROM dpe_diagnostics WHERE "dpeNumberHash" IS NULL;

-- 3. Urbanisme : purger les lignes créées par l'ancien fallback non-déterministe
--    f"{commune_code}_{id(r)}" (les vrais NUM_DAU ne contiennent pas d'underscore).
DELETE FROM urbanisme_projects WHERE "sourceId" ~ '^\d{5}_\d+$';

COMMIT;

-- Après redémarrage de l'API (synchronize), relancer les imports :
--   python workers/dvf/import_dvf.py --dept <depts> --years 2022,2023,2024
--   python workers/dpe/import_dpe.py --dept <depts>
--   python workers/urbanisme/import_ads.py --dept <depts>
