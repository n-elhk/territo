# Todo

## ✅ Fait

- Entités TypeORM : `analysis_zones`, `dvf_transactions`, `dpe_diagnostics`, `urbanisme_projects`, `area_metrics`, `zone_scores`, `scoring_configs`, `scoring_quality_rules`, `score_history_snapshots`, `product_events`, `zone_feedback`
- Workers Python : import IRIS/communes (WFS IGN), DPE (ADEME), DVF (data.gouv), urbanisme (Dido/SITADEL)
- Worker metrics : agrégations PostGIS par zone × période
- Worker scores : 7 types de scores (`prospection_locale`, `demande_btp`, `transformation_immo`, `prospection_vendeurs`, `liquidite_marche`, `quartier_mutation`, `valorisation_prix`)
- Endpoints scoring : `POST /scores/local`, `GET /territory-benchmark`
- Endpoints zones : `GET /zones/:id/scores`, `GET /zones/:id/score-history`, `GET /zones/rising`

## 🔲 Reste à faire

### Backend

- [ ] **Module `geocoding`** — appel API Adresse BAN (`api-adresse.data.gouv.fr`) pour convertir adresse → (lat, lng). Bloquant pour le front.
- [ ] **Module `agency`** — `GET /agency/market-scores` + `POST /agency/estimation-context` (segment agence immo)
- [ ] **`POST /alerts`** — abonnements aux zones en hausse (email ou push)

### Frontend Angular

- [ ] **MapLibre GL** — intégration carte, affichage des zones colorées par score
- [ ] **Feature `map`** — recherche par adresse (geocoding) + affichage scores sur la carte
- [ ] **Feature `local-opportunities`** — liste des zones triées par score avec filtres (métier, période, rayon)

### Qualité / ops

- [ ] Sécuriser les workers API externe avec des tests au cas où les URLs/params/data changent
