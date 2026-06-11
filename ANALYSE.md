# Analyse Territo — axes d'amélioration


## 🔴 Bugs probablement bloquants

1. **Module `agency` très probablement cassé (noms de colonnes).** ✅ `agency.service.ts` écrit du SQL en `snake_case` non quoté — `az.commune_code`, `az.zone_type`, `zs.zone_id`, `zs.score_type`, `zs.global_score`. Or partout ailleurs (workers, `zones.service.ts`) les colonnes sont en `camelCase` quoté (`"communeCode"`, `"zoneType"`, `"zoneId"`…), car TypeORM crée des colonnes case-sensitive. En Postgres `az.commune_code` ne matche **pas** `"communeCode"` → erreur *column does not exist* au runtime. Les deux endpoints agence plantent probablement.

2. **Scores agence `opportunite_acquereur` et `risque_commercial` jamais calculés.** ✅ `AGENCY_SCORE_TYPES` les demande, mais `DEFAULT_CONFIGS` (worker `compute_zone_scores.py`) ne les définit pas (7 types calculés, ces 2 manquants).

3. **Évolution temporelle — cœur du produit — non implémentée.** ✅ `compute_zone_scores.py:451` :
   ```python
   prev_score = None  # computed in a second pass if needed
   ```
   Donc `trendScore`, `globalScoreDeltaPrevious`, `globalScoreDeltaYear`, `trendLabel` sont **toujours NULL**. Or le pitch (§5.6, §8, §9, §12) fait de la tendance (+18 pts, « accélération ») LA promesse centrale. Le front affiche déjà ces champs (`map-zone-detail.ts`, `local-opportunities.ts`) mais ils seront toujours vides.

4. **Courbe d'historique sans données.** ✅ L'entité `score_history_snapshot` et l'endpoint `/score-history` existent, le front a un SVG d3 (`map-zone-detail.ts`)… mais **aucun worker n'écrit dans `score_history_snapshots`**. Le graphe restera masqué (`linePoints().length >= 2` jamais vrai).

5. **Imports probablement non-idempotents.** ⚠️ `import_dvf.py` insère avec `id = gen_random_uuid()` puis `ON CONFLICT DO NOTHING` — le conflit porte sur la PK aléatoire, donc ne se déclenche jamais. Sans contrainte unique sur clé naturelle, **relancer l'import duplique les transactions** → gonfle `sales_count` → corrompt métriques et scores. À vérifier sur DPE/urbanisme aussi.

---

## 🟠 Sécurité & robustesse

- **CORS ouvert à tous.** ✅ `main.ts:26` : `app.enableCors()` sans options. À restreindre par origine en prod.
- **Pas de rate-limiting ni de helmet.** ✅ `main.ts` minimal. `/auth/login`, `/register`, `/refresh` exposés au brute-force. Ajouter `@nestjs/throttler` + `@fastify/helmet`.
- **Geocoding sans validation.** ✅ `geocoding.controller.ts:40` : `parseFloat(lat)`/`parseInt(limit)` sans garde → `NaN` transmis à l'API BAN. Passer par un schéma Zod (`z.coerce.number().min(-90).max(90)`).
- **Pas de migrations.** ✅ `db.module.ts` : `migrations: []`, `synchronize: NODE_ENV !== 'production'`. En dev ça auto-sync, **en prod aucune gestion de schéma**. Générer des migrations TypeORM avant déploiement. `retryAttempts: 1` très bas.
- **Swagger exposé en prod.** ✅ `/api/docs` sans condition. À conditionner hors-prod.
- **Résilience API externes** (todo.md le signale). ✅ `requests.get` en un seul essai, pas de retry/backoff, pas de garde si le schéma CSV/WFS change. DVF/DPE/IGN/SITADEL doivent avoir retries + validation des colonnes attendues.

**Côté positif (vérifié) :** rotation des refresh-tokens via Redis, bcrypt 12 rounds, cookies `httpOnly`/`secure`/`sameSite`, requêtes paramétrées (`$1,$2…`), validation Zod entrées **et** réponses. Base sécurité auth solide.

> ⚠️ Quelques points issus d'un sous-agent non revérifiés ligne à ligne : CSRF absent (auth par cookie), ambiguïté d'auth sur le endpoint `/auth/refresh`. À confirmer avant traitement.

---

## 🟡 Qualité données & scoring

- **Normalisation non stable dans le temps.** ✅ Sous-scores normalisés par percentiles p5/p95 **recalculés à chaque run** sur le lot chargé (`compute_bounds`). Un même territoire n'a donc pas un score comparable d'un run à l'autre ; filtrer `--commune` change les bornes. Ça **contredit** la feature historique/tendance. Figer les bornes (table de référence nationale/départementale versionnée).
- **Données manquantes pénalisent au lieu de masquer.** ✅ `normalize(None)` renvoie `0.0`, donc un sous-score absent tire le global vers le bas au lieu de re-normaliser sur les poids disponibles. Le pitch §17 demande de masquer/griser. La `visibility()` gère bien le masquage (aligné §17), mais le `global_score` brut reste faussé.
- **Tests quasi inexistants.** ✅ 4 specs front (login/register/app/home), **0 test backend**, **0 test worker**. Prioriser : tests scoring (formules + seuils), tests requêtes PostGIS, tests robustesse importers (todo.md le demande).

---

## 🟢 Features à ajouter / compléter (vs pitch & MVP)

Par ordre d'impact MVP (pitch §15 priorise *artisan rénovation* et *agence locale*) :

1. **Tendance temporelle réelle** (lié #3/#4) — différenciation n°1 du pitch. Calculer `delta` vs période précédente + alimenter `score_history_snapshots`.
2. **Recherche par adresse + rayon d'intervention.** Tout le récit artisan (« rayon de 20 km ») en dépend. Le front filtre uniquement par `commune_code` (`map.store.ts`, `local-opportunities.ts`). Manque : géocodage adresse→(lat,lng) + rayon + appel `POST /scores/local` (scénario §8).
3. **Sélection du métier (artisan).** Scoring supporte `tradeOrCategory`, pitch §7 détaille 12 métiers à pondérations distinctes, mais `DEFAULT_CONFIGS` n'a aucune pondération métier et le front n'a pas de sélecteur. MVP : commencer par 4 métiers (isolation, menuiserie, couvreur, peintre).
4. **Boucle de feedback** (« Cette recommandation vous semble-t-elle crédible ? »). ✅ Entité `zone_feedback` présente mais **aucun controller/service**. Central au MVP (§16, North Star = décisions qualifiées). À implémenter end-to-end.
5. **Analytics produit / events.** ✅ `product_event` en entité mais **aucun endpoint**. Toutes les métriques MVP (activation, action intent, rétention J+7) en dépendent.
6. **Score de confiance affiché explicitement.** Back calcule `confidenceScore`/`visibility`, mais le front se limite à un badge « — ». Pitch §17 veut « Confiance donnée : 74/100 » + statut + raison. À exposer dans `map-zone-detail`.
7. **Sauvegarde / export CSV de zone.** Aucune UI (métrique « action intent »). Les alertes (back existant) n'ont pas non plus d'UI front.
8. **Mode benchmark territorial** (2ᵉ mode d'analyse du pitch) et **module agence côté front** (estimation, note de marché) : absents du front.

---

## Ce qui est bien fait (à préserver)

- **Front Angular exemplaire** vs CLAUDE.md : signals + `@ngrx/signals`, `rxResource`, `OnPush`, control-flow natif, templates/styles inline, Signal Forms (`form`/`FormField`), `input()`/`output()`, `inject()`, ARIA présent, d3 pour sparklines, MapLibre. Très peu de dette.
- **Schemas Zod partagés** front/back/workers — excellent garde-fou de contrat d'API.
- **Seuils qualité data** déjà présents dans le worker metrics + logique `visibility()` alignée pitch §17.
- **Pipeline data clair** : agrégations lourdes en SQL/PostGIS, Python orchestre seulement.

---

## Priorisation

| Priorité | Action |
|---|---|
| **P0** | Corriger les colonnes SQL `agency.service.ts` (#1) ; vérifier l'idempotence des imports (#5) |
| **P0** | Calcul des deltas + écriture des snapshots historiques (#3/#4) — promesse cœur |
| **P1** | Recherche adresse + rayon + métier (features 2 & 3, scénario artisan MVP) |
| **P1** | Sécu prod : CORS restreint, throttler, helmet, validation geocoding, migrations TypeORM |
| **P2** | Feedback + events end-to-end (métriques MVP) ; affichage confiance ; export/save |
| **P2** | Stabiliser la normalisation des scores ; base de tests (scoring, PostGIS, importers) |
