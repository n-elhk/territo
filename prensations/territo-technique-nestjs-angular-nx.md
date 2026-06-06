# Territo — Partie technique

## 1. Objectif du produit

Territo est une application de veille territoriale qui aide les professionnels du bâtiment, de l'immobilier, du BTP et de l'aménagement à repérer les zones où les signaux de travaux, de rénovation, de ventes et de transformation immobilière augmentent.

Le produit ne doit pas vendre des “leads propriétaires” individuels. Il doit transformer des données publiques en **scores actionnables par profil métier**, avec un niveau de confiance et une explication détaillée.

Le scoring local pour artisans est important, mais il n'est qu'une couche du produit. Territo doit conserver plusieurs lectures :

- **artisan / petite entreprise** : prioriser les zones à prospecter dans son rayon réel d'intervention : 10, 20, 30 km ou rayon personnalisé ;
- **courtier en travaux / maître d'œuvre / réseau d'artisans** : identifier les zones où structurer une prospection commerciale ;
- **agence immobilière / investisseur** : repérer les quartiers en transformation et les zones où le marché immobilier est actif ;
- **fournisseur BTP / franchise** : anticiper les zones où la demande en matériaux, équipements ou prestations va augmenter ;
- **collectivité / bureau d'études** : suivre les dynamiques de construction, de rénovation et de mutation urbaine.

## 2. Architecture retenue

Architecture cible adaptée à une stack **NestJS + Angular + Nx** :

```text
Monorepo Nx
├─ apps/territo-front
│    └─ Angular + MapLibre
├─ apps/territo-api
│    └─ NestJS API
├─ libs/shared
│    ├─ contrats API
│    ├─ types TypeScript
│    └─ règles métier partagées
└─ libs/ui
     └─ composants Angular réutilisables

Angular Frontend
  ↓
API NestJS
  ↓
PostgreSQL + PostGIS
  ↑
Workers Python :
- imports
- scoring
- analytics
```

Principe général :

- **Angular** gère l'interface produit, la carte, les filtres, les tableaux et les vues métier ;
- **NestJS** expose l'API applicative, l'authentification, les droits d'accès, les exports et les endpoints pro ;
- **PostgreSQL + PostGIS** reste le cœur spatial et analytique du produit ;
- **Python** reste dédié à l'ingestion, au nettoyage, aux croisements géographiques et au calcul des scores ;
- **Nx** permet de garder une seule base de code cohérente pour le frontend, l'API et les librairies partagées.

### 2.1 Frontend Angular

Recommandation : **Angular + MapLibre**, dans une application Nx `apps/territo-front`.

Rôle du frontend :

- afficher la carte interactive ;
- permettre le choix du mode d'analyse : local ou benchmark ;
- gérer les filtres : métier, rayon, période, score, confiance, tendance ;
- afficher les sous-scores, les explications et l'évolution dans le temps ;
- comparer les périodes : 3, 6, 12 et 24 mois ;
- créer des alertes ;
- exporter des résultats ;
- afficher les avertissements de qualité data : score grisé, score masqué, source fragile, fallback zone.

Stack frontend retenue :

- Angular ;
- Nx ;
- MapLibre GL pour la carte ;
- Angular Material pour l'interface MVP ;
- NgRx Signals Store pour la gestion d'état globale : zones chargées, filtres actifs, score courant, alertes ;
- RxJS uniquement pour les événements MapLibre (qui exposent des Observables natifs) — tous les autres flux passent par des signals ;
- librairie partagée `libs/shared` pour les types de réponse API ;
- librairie `libs/ui` pour les composants réutilisables : score badge, zone card, trend chart, quality warning, filter panel.

Organisation Angular recommandée :

```text
apps/territo-front/
  src/app/
    core/
      auth/
      api/
      guards/
    features/
      map/
      local-opportunities/
      territory-benchmark/
      agency-market/
      alerts/
      exports/
    shared/
      components/
      pipes/
      directives/
```

### 2.2 API NestJS

L'API NestJS est la couche principale appelée par le frontend Angular et par les clients externes.

Rôle de l'API :

- authentification et comptes utilisateurs ;
- gestion des profils : artisan, agence, fournisseur, collectivité, etc. ;
- recherche d'adresses, communes et zones ;
- lecture des scores pré-calculés ;
- création et lecture des alertes ;
- exports CSV ;
- endpoints API pro ;
- contrôle des droits d'accès ;
- journalisation des actions produit ;
- exposition d'une documentation OpenAPI.

Stack API retenue :

- NestJS ;
- Nx ;
- Fastify adapter (`@nestjs/platform-fastify`) pour de meilleures performances HTTP ;
- PostgreSQL via TypeORM (`@nestjs/typeorm`) pour la couche ORM, les entités et les migrations ;
- colonnes `geometry` PostGIS typées nativement via `@Column({ type: 'geometry', spatialFeatureType: '...', srid: 4326 })` — TypeORM lit et écrit du GeoJSON directement ;
- migrations avec `typeorm migration:generate` pour les colonnes scalaires et JSONB ; migrations manuelles pour les colonnes `geom` et les index GIST (non supportés par la génération automatique) ;
- validation des payloads avec Zod (`nestjs-zod`) ;
- documentation API avec `@nestjs/swagger` ;
- authentification avec JWT ;
- jobs applicatifs légers avec `@nestjs/schedule` si nécessaire, sans remplacer les workers Python data.

Principe important : l'API NestJS ne recalcule pas tous les scores à la volée. Elle lit des agrégats et scores pré-calculés dans PostgreSQL/PostGIS.

Modules NestJS recommandés :

```text
apps/territo-api/src/app/
  modules/
    auth/
    profiles/
    geocoding/
    zones/
    scores/
    local-opportunities/
    territory-benchmark/
    agency/
    alerts/
    exports/
    product-events/
    feedback/
  common/
    guards/
    decorators/
    filters/
    interceptors/
  database/
    db.module.ts
    postgis.repository.ts
```

Découpage de responsabilité conseillé :

- les **controllers NestJS** exposent les routes HTTP ;
- les **services NestJS** orchestrent les règles applicatives et les droits ;
- les **repositories TypeORM** exécutent les requêtes scalaires via les entités ; les requêtes spatiales lourdes (rayons, intersections, agrégats géographiques) sont écrites en SQL explicite via `QueryRunner` ;
- les **schémas Zod** (`nestjs-zod`) valident et documentent les payloads entrants ;
- les **libs Nx partagées** contiennent les contrats TypeScript communs entre Angular et NestJS.

### 2.3 PostgreSQL + PostGIS

PostgreSQL + PostGIS est le cœur du système.

Rôle de la base :

- stocker les données brutes importées ;
- stocker les données nettoyées ;
- stocker les géométries : parcelles, zones, points, rayons, communes ;
- stocker les agrégats par zone ;
- stocker les scores et sous-scores ;
- permettre les requêtes géographiques rapides.

Fonctionnalités recommandées :

- extension PostGIS ;
- index `GIST` sur les géométries ;
- index sur dates, codes INSEE, métiers, types de score ;
- vues matérialisées pour les agrégats lourds ;
- tables d'historique pour suivre l'évolution des scores ;
- requêtes SQL spatiales explicites via `QueryRunner` TypeORM pour les opérations PostGIS (rayons, intersections, agrégats géographiques) ;
- colonnes `geom` et index GIST gérés par des migrations manuelles TypeORM.

### 2.4 Workers Python

Les workers Python s'occupent de la partie data, car Python est plus adapté pour l'import, le nettoyage, les traitements géographiques lourds et l'analyse.

Rôle des workers :

- récupérer les jeux de données data.gouv, ADEME et autres sources publiques ;
- importer DVF, autorisations d'urbanisme, cadastre, DPE, limites géographiques ;
- nettoyer et normaliser les données ;
- faire les croisements géographiques ;
- calculer les agrégats ;
- calculer les scores et sous-scores ;
- produire les analytics ;
- écrire les résultats dans PostgreSQL/PostGIS.

Librairies Python recommandées :

- `pandas` ;
- `geopandas` ;
- `shapely` ;
- `pyarrow` ;
- `sqlalchemy` ou `psycopg` ;
- `pydantic` pour valider les configurations de jobs.

Exemples de jobs :

```text
import_urbanisme_job
import_dvf_job
import_cadastre_job
import_dpe_job
normalize_parcels_job
build_analysis_zones_job
compute_zone_aggregates_job
compute_local_artisan_scores_job
compute_territory_benchmark_scores_job
compute_btp_demand_scores_job
compute_market_potential_scores_job
compute_urban_mutation_scores_job
```

Organisation recommandée des workers :

```text
workers/
  import_permits.py
  import_dvf.py
  import_dpe.py
  geocode_missing.py
  build_area_metrics.py
  compute_trade_scores.py
  compute_profile_scores.py
  refresh_alerts.py
  compute_score_history.py
  compute_trends.py
```

Fréquence simple pour le MVP :

```text
Quotidien ou hebdomadaire :
- import_permits
- import_dpe
- refresh_alerts

À chaque nouvelle publication :
- import_dvf
- rebuild_area_metrics
- compute_trade_scores
- compute_profile_scores
- compute_score_history
- compute_trends
```

### 2.5 Monorepo Nx recommandé

Organisation cible :

```text
chantier-radar/
  apps/
    territo-front/
    territo-api/
  libs/
    shared/
      api-contracts/
      domain-types/
      scoring-config-types/
    ui/
      score-card/
      map-legend/
      filter-panel/
    data-access/
      api-client-angular/
  workers/
    python/
  database/
    migrations/
    views/
    seeds/
  infra/
    docker/
    compose/
```

Librairies Nx utiles :

- `libs/shared/domain-types` : types communs `ZoneScore`, `AreaMetric`, `ScoreVisibility`, `TrendLabel` ;
- `libs/shared/api-contracts` : schémas Zod partagés entre NestJS et Angular, source unique des contrats API ;
- `libs/shared/scoring-config-types` : types des fichiers YAML/JSON de pondération par métier ;
- `libs/ui` : composants Angular réutilisables ;
- `libs/data-access/api-client-angular` : client API typé côté Angular.

Commandes de départ :

```bash
npx create-nx-workspace@latest chantier-radar
nx g @nx/angular:app territo-front
nx g @nx/nest:app api-nest
nx g @nx/js:lib shared/domain-types
nx g @nx/js:lib shared/api-contracts
nx g @nx/js:lib shared/scoring-config-types
nx g @nx/angular:lib ui/score-card
nx g @nx/angular:lib data-access/api-client-angular
```

À éviter : mélanger les traitements data lourds dans NestJS. NestJS doit rester l'API produit. Python reste responsable du pipeline data, du scoring et des calculs géographiques massifs.

## 3. Données utilisées

### 3.1 Autorisations d'urbanisme

Données exploitées :

- permis de construire ;
- déclarations préalables ;
- permis d'aménager ;
- permis de démolir ;
- dates de dépôt, décision, ouverture ou achèvement selon disponibilité ;
- type de travaux ;
- surface créée ou transformée ;
- destination : habitation, commerce, bureaux, etc. ;
- commune, parcelle ou géolocalisation selon disponibilité.

Usage produit :

- détecter l'activité de construction ou de transformation ;
- identifier les types de travaux dominants ;
- alimenter les scores par métier ;
- mesurer la récence des signaux.

### 3.2 DVF — Demandes de Valeurs Foncières

Données exploitées :

- transactions immobilières ;
- date de mutation ;
- prix de vente ;
- type de bien ;
- surface bâtie ;
- surface terrain ;
- parcelles ;
- prix au m² calculé ;
- géolocalisation si DVF géolocalisée est utilisée.

Usage produit :

- mesurer le niveau de marché immobilier ;
- calculer prix médian, volume de ventes et liquidité ;
- qualifier le contexte économique d'une zone ;
- croiser les projets de travaux avec la dynamique de vente.

### 3.3 Cadastre / géographie

Données exploitées :

- parcelles cadastrales ;
- limites communales ;
- quartiers ou IRIS si disponibles ;
- grille géographique 200 m / 500 m ;
- géolocalisation ;
- zones personnalisées par rayon.

Usage produit :

- rattacher les projets, ventes et DPE à une zone ;
- agréger sans exposer inutilement des données individuelles ;
- calculer les distances et rayons d'intervention ;
- produire des cartes exploitables.

### 3.4 DPE / performance énergétique

Données exploitées :

- classe énergétique du logement : A à G ;
- classe GES : A à G ;
- date du diagnostic ;
- surface du logement ;
- période de construction si disponible ;
- type de logement : maison, appartement, immeuble collectif ;
- adresse ou géolocalisation selon disponibilité ;
- indicateurs agrégés par zone : part de DPE E/F/G, part de passoires F/G, ancienneté des diagnostics.

Usage produit :

- calculer un sous-score **besoin rénovation** ;
- prioriser les zones pertinentes pour isolation, chauffage, ventilation, fenêtres, toiture, électricité et rénovation globale ;
- enrichir le scoring artisan ;
- enrichir les scores pour franchises rénovation, fournisseurs BTP et acteurs de la rénovation énergétique.

Point de vigilance : les DPE ne couvrent pas tout le parc immobilier. Ils sont surtout produits lors de ventes, locations ou constructions. Le score DPE doit donc être utilisé comme un **signal pondéré**, pas comme une photographie exhaustive du parc.

### 3.5 SIRENE / concurrence locale — optionnel après MVP

Données exploitées :

- entreprises actives par code NAF ;
- localisation des établissements ;
- secteur d'activité ;
- ancienneté de l'établissement si disponible.

Usage produit :

- calculer un sous-score de concurrence locale ;
- éviter de recommander une zone attractive mais déjà très saturée ;
- améliorer les recommandations de prospection.


### 3.6 INSEE / IRIS — amélioration pour agences et investisseurs

Données exploitables plus tard :

- population ;
- nombre de ménages ;
- structure d'âge ;
- revenus médians si disponibles à l'échelle pertinente ;
- part propriétaires / locataires ;
- typologie des ménages ;
- densité de logements.

Usage produit :

- améliorer le score de prospection vendeurs ;
- qualifier les zones avec forte densité de propriétaires occupants ;
- aider les agences à adapter leur discours commercial ;
- enrichir les rapports de micro-marché.

### 3.7 Équipements, accessibilité et risques — amélioration avancée

Sources possibles :

- base permanente des équipements ;
- données de transport ou d'accessibilité ;
- Géorisques ;
- bruit, inondation, retrait-gonflement des argiles, zones contraintes ;
- PLU / zonages si disponibles localement.

Usage produit :

- produire un score de risque ou de frein commercial ;
- contextualiser les estimations locales ;
- expliquer les écarts de prix entre zones proches ;
- enrichir les analyses pour agences, investisseurs et collectivités.

## 4. Modes d'analyse

### 4.1 Mode local par rayon d'intervention

Mode prioritaire pour artisans, petites entreprises, courtiers en travaux et agences locales.

L'utilisateur sélectionne :

- son adresse d'entreprise ;
- son rayon d'intervention : 10 km, 20 km, 30 km ou rayon personnalisé ;
- son métier ;
- une période : 3, 6, 12 ou 24 mois.

Le scoring se fait **à l'intérieur du rayon**, et non sur toute la France.

Exemple :

```text
Artisan : menuisier
Base : Rennes
Rayon : 20 km
Période : 12 mois

Résultat :
1. Rennes Nord — 84/100
2. Betton — 79/100
3. Cesson-Sévigné — 76/100
```

### 4.2 Mode benchmark territorial

Mode utile aux agences immobilières, investisseurs, fournisseurs BTP, franchises, collectivités et réseaux multi-sites.

L'utilisateur sélectionne :

- un territoire : ville, métropole, département, région ou liste de communes ;
- un type de scoring : transformation immobilière, potentiel marché, demande BTP, mutation urbaine ;
- une période ;
- éventuellement une typologie de bien ou de travaux.

Exemple :

```text
Territoire : Métropole de Lyon
Score : transformation immobilière
Période : 24 mois
Niveau : quartier

Résultat : classement des quartiers avec les plus forts signaux de transformation.
```



### 4.3 Analyse temporelle et évolution par période

Une zone ne doit pas seulement être évaluée par son score actuel. Le produit doit aussi montrer **l'évolution dans le temps**.

Objectif : répondre à ces questions :

- est-ce que la zone progresse ou baisse ?
- est-ce que le score est stable ou ponctuel ?
- est-ce que l'activité travaux accélère depuis quelques mois ?
- est-ce que la hausse vient des permis, des ventes DVF, des DPE ou d'un autre signal ?
- est-ce que la zone est intéressante aujourd'hui, ou surtout en tendance longue ?

Périodes recommandées :

```text
3 mois   : signaux très récents, utiles pour alertes et réactivité
6 mois   : tendance courte, utile pour prospection commerciale
12 mois  : période principale du MVP
24 mois  : tendance longue, utile pour immobilier, fournisseurs BTP et collectivités
36 mois+ : analyse avancée pour benchmarks et rapports
```

Pour chaque zone et chaque score, l'application doit afficher :

```text
Score actuel : 82/100
Évolution 3 mois : +6 pts
Évolution 6 mois : +11 pts
Évolution 12 mois : +18 pts
Tendance : accélération
```

Le détail doit aussi exister par sous-score :

```text
Détail évolution — Menuisier, rayon 20 km

- Activité travaux : 76 → 84  (+8)
- Besoin rénovation : 88 → 89  (+1)
- Ventes DVF : 61 → 73  (+12)
- Compatibilité métier : stable
- Concurrence locale : 68 → 62  (-6, concurrence en hausse)
```

Interprétation produit :

- **score élevé + tendance en hausse** : zone prioritaire ;
- **score élevé + tendance stable** : zone déjà intéressante mais mature ;
- **score moyen + forte hausse** : zone émergente à surveiller ;
- **score élevé + forte baisse** : zone peut-être passée ou moins prioritaire ;
- **score faible + tendance faible** : zone secondaire.

Il faut donc stocker non seulement les scores par période, mais aussi les variations entre périodes.

## 5. Pipeline de données

### 5.1 Principe clé — données neutres puis scoring configurable

Le système doit séparer deux niveaux :

1. **métriques neutres** : données calculées de manière objective par zone ;
2. **scorings métier** : pondérations différentes selon le profil ou le métier.

Exemple : la proportion de logements DPE E/F/G est une métrique neutre. Elle n'a pas le même poids pour un chauffagiste, un menuisier, un peintre ou une agence immobilière.

Il ne faut donc pas coder une note unique en dur. Les workers Python doivent calculer des métriques communes, puis appliquer une configuration de scoring.

```text
Données brutes
  ↓
Nettoyage + géocroisement
  ↓
Métriques neutres par zone
  ↓
Configurations de scoring par métier / profil
  ↓
Scores globaux + sous-scores + explications
  ↓
API NestJS + frontend Angular
```

### Étape 1 — Ingestion

Les workers Python récupèrent régulièrement :

- autorisations d'urbanisme ;
- DVF ou DVF géolocalisée ;
- cadastre / parcelles ;
- DPE logements existants ;
- limites administratives et zones d'analyse.

Fréquence recommandée :

- autorisations d'urbanisme : mensuelle ou hebdomadaire selon disponibilité ;
- DVF : à chaque nouvelle publication ;
- DPE : hebdomadaire ou mensuelle selon volume et API ;
- cadastre : trimestrielle ou semestrielle ;
- agrégats internes : recalcul après chaque ingestion importante.

### Étape 2 — Nettoyage

Normalisation des champs :

- dates ;
- codes communes INSEE ;
- références cadastrales ;
- types de travaux ;
- surfaces ;
- montants ;
- géométries ;
- coordonnées ;
- classes DPE et GES ;
- dates de diagnostic DPE ;
- typologies de logements.

Suppression, masquage ou pseudonymisation des informations inutiles ou sensibles.

### Étape 3 — Géocroisement

Objectif : associer les données entre elles.

- autorisation d'urbanisme → parcelle ;
- DVF → parcelle ;
- DPE → adresse, bâtiment, parcelle, commune ou zone d'analyse selon précision ;
- parcelle → géométrie cadastrale ;
- parcelle → zone d'analyse ;
- zone d'analyse → périmètre utilisateur ou territoire benchmark.

Si la donnée est déjà géolocalisée, on utilise directement la latitude/longitude ou la géométrie. Sinon, on passe par l'identifiant de parcelle, la commune ou un rattachement géographique moins précis.

### Étape 4 — Agrégation

Création d'indicateurs par zone :

- nombre de projets sur 3, 6, 12 et 24 mois ;
- part des extensions ;
- part des constructions neuves ;
- part des démolitions ;
- part des projets commerciaux ;
- surface créée ou transformée ;
- nombre de ventes DVF ;
- prix médian au m² ;
- évolution du prix au m² ;
- volume de transactions ;
- part maison / appartement / local ;
- part de DPE E/F/G ;
- part de DPE F/G ;
- nombre de DPE disponibles ;
- âge moyen des diagnostics ;
- niveau de récence des signaux ;
- évolution des métriques par rapport aux périodes précédentes ;
- niveau de confiance de la donnée.

### Étape 5 — Scoring

Le scoring est calculé par des workers Python, puis stocké dans PostgreSQL/PostGIS pour être lu rapidement par l'API NestJS.

Chaque score contient :

- un score global ;
- des sous-scores ;
- des explications textuelles ;
- un niveau de confiance ;
- une période d'analyse ;
- un périmètre de comparaison ;
- la variation du score sur 3, 6, 12 et 24 mois (calculée en comparant les snapshots précédents) ;
- une tendance : hausse, baisse, stable, accélération, ralentissement.

## 6. Scoring détaillé

### 6.0 Moteur de scoring configurable

Le moteur de scoring doit être **configurable**, pas codé métier par métier dans l'API NestJS.

Les workers Python lisent une configuration de pondération, calculent les sous-scores, puis écrivent le résultat final dans PostgreSQL/PostGIS. L'API NestJS ne fait que lire les scores pré-calculés.

Exemple de configuration pour un menuisier :

```yaml
trade: menuisier
score_type: prospection_locale
weights:
  renovation_need: 0.20
  recent_sales: 0.20
  work_signals: 0.15
  building_compatibility: 0.15
  purchasing_power: 0.15
  competition: 0.10
  distance: 0.05
```

Exemple pour un couvreur :

```yaml
trade: couvreur
score_type: prospection_locale
weights:
  house_density: 0.25
  old_building_ratio: 0.20
  work_signals: 0.20
  dpe_efg_ratio: 0.10
  purchasing_power: 0.10
  competition: 0.10
  distance: 0.05
```

Exemple pour un peintre / solier :

```yaml
trade: peintre_solier
score_type: prospection_locale
weights:
  recent_sales: 0.30
  old_building_ratio: 0.20
  purchasing_power: 0.15
  work_signals: 0.10
  apartment_and_house_volume: 0.10
  competition: 0.10
  distance: 0.05
```

Un score métier doit donc être la combinaison de plusieurs sous-scores :

```text
score_métier =
  besoin_potentiel
+ signaux_travaux
+ pouvoir_achat_local
+ récence_signaux
+ compatibilité_parc_immobilier
+ concurrence_locale
+ distance
```

Chaque sous-score est normalisé sur 100. Le score global est une moyenne pondérée.

Exemple de fonction de normalisation :

```python
def normalize(value, min_value, max_value):
    if value is None:
        return 0
    if max_value == min_value:
        return 0
    score = (value - min_value) / (max_value - min_value) * 100
    return max(0, min(100, score))
```

`min_value` et `max_value` sont calculés à partir des percentiles observés sur le territoire pilote (ville ou métropole choisie), et non sur la France entière. Ils sont recalculés à chaque ingestion importante et stockés dans la table `scoring_configs` (champ `thresholds`). Cela évite qu'une commune exceptionnelle écrase toutes les autres ou que des valeurs nationales rendent les scores locaux peu discriminants.

Exemple de score de récence :

```python
def recency_score(days):
    if days <= 90:
        return 100
    if days <= 180:
        return 75
    if days <= 365:
        return 50
    if days <= 730:
        return 25
    return 5
```

Exemple de score de concurrence inversé :

```python
competition_score = 100 - normalize(competitors_count, 0, 50)
```

Le frontend doit toujours afficher :

- le score global ;
- les sous-scores ;
- les raisons principales ;
- les points faibles ;
- le niveau de confiance.



### 6.0.1 Score actuel, tendance courte et tendance longue

Chaque scoring doit produire trois lectures complémentaires :

```text
1. Score actuel
   Niveau d'opportunité sur la période demandée.

2. Tendance courte
   Variation récente, par exemple 3 ou 6 mois.

3. Tendance longue
   Dynamique structurelle, par exemple 12 ou 24 mois.
```

Exemple :

```text
Zone A — Score prospection menuisier

Score 12 mois : 82/100
Variation vs période précédente : +9 pts
Variation sur 24 mois : +17 pts
Tendance : hausse régulière

Lecture : zone prioritaire, pas seulement active mais en progression.
```

Formule simplifiée :

```text
trend_score =
  0.50 * variation_score_global
+ 0.25 * variation_signaux_travaux
+ 0.15 * variation_dvf
+ 0.10 * variation_dpe_renovation
```

Le `trend_score` ne remplace pas le score global. Il sert à qualifier la dynamique :

```text
+15 à +100 : forte hausse
+5 à +15   : hausse modérée
-5 à +5    : stable
-15 à -5   : baisse modérée
<-15       : forte baisse
```

Cette lecture est importante parce qu'une zone à 70/100 qui monte vite peut être plus intéressante qu'une zone à 82/100 qui baisse.

### 6.1 Score de prospection locale artisan

Ce score ne doit pas être une note unique opaque. Il doit être une moyenne pondérée de plusieurs sous-scores.

Formule de base :

```text
score_prospection_locale =
  0.25 * activité_travaux
+ 0.20 * besoin_rénovation
+ 0.20 * compatibilité_métier
+ 0.15 * dynamique_dvf_locale
+ 0.10 * récence_des_signaux
+ 0.05 * accessibilité_distance
+ 0.05 * concurrence_locale
```

Les pondérations doivent être configurables par métier.

#### Sous-score 1 — Activité travaux

Objectif : mesurer si la zone montre déjà des signaux de transformation.

Indicateurs :

- nombre d'autorisations d'urbanisme récentes ;
- extensions ;
- changements de destination ;
- créations de logements ;
- surfaces créées ou transformées ;
- démolitions/reconstructions.

#### Sous-score 2 — Besoin rénovation

Objectif : mesurer si le parc local semble avoir un besoin potentiel de rénovation.

Indicateurs :

- proportion de logements classés E, F ou G au DPE ;
- proportion de passoires énergétiques F ou G ;
- part de logements anciens ;
- audits énergétiques disponibles ;
- maisons individuelles anciennes ;
- signaux de rénovation énergétique dans les autorisations d'urbanisme si disponibles.

Métiers pour lesquels ce sous-score est très important :

- isolation ;
- chauffage ;
- ventilation ;
- menuiserie / fenêtres ;
- toiture ;
- rénovation globale ;
- électricité dans certains cas.

#### Sous-score 3 — Compatibilité métier

Objectif : adapter la lecture à chaque activité.

| Métier | Signaux à poids fort |
|---|---|
| Menuisier | extensions, rénovations, DPE E/F/G, maisons anciennes, ventes récentes |
| Couvreur | maisons anciennes, rénovation énergétique, extensions, surélévations, DPE E/F/G |
| Isolation | DPE E/F/G, audits énergétiques, maisons anciennes, aides rénovation |
| Chauffagiste | DPE E/F/G, audits énergétiques, logements anciens |
| Électricien | créations de logements, divisions, rénovations, ventes récentes, locaux commerciaux |
| Plombier | créations de logements, divisions, rénovations, extensions |
| Peintre / sols | ventes récentes, rénovations, logements anciens, projets achevés ou en cours |
| Paysagiste | maisons avec terrain, extensions, piscines, aménagements extérieurs |



#### Détail des critères par métier

Le score local artisan doit adapter les critères au métier choisi. Une même zone peut être excellente pour un peintre, moyenne pour un couvreur et mauvaise pour un pisciniste.

| Métier / catégorie | Critères prioritaires | Signaux forts |
|---|---|---|
| Isolation / rénovation énergétique | DPE E/F/G, DPE F/G, maisons anciennes, parc individuel, concurrence RGE | forte part de passoires énergétiques, maisons anciennes, peu d'acteurs RGE locaux |
| Chauffage / pompe à chaleur | DPE E/F/G, mode de chauffage si disponible, maisons individuelles, ventes récentes, concurrence RGE | maison ancienne vendue récemment avec mauvais DPE |
| Menuiserie / fenêtres | DPE E/F/G, logements anciens, ventes récentes, extensions, modifications de façade | ventes récentes + bâti ancien + besoin thermique |
| Couvreur / charpentier | maisons individuelles, âge du bâti, extensions, surélévations, DPE E/F/G, densité pavillonnaire | quartier pavillonnaire ancien avec extensions ou surélévations |
| Électricien | ventes récentes, logements anciens, créations de logements, divisions, locaux commerciaux | vente récente + logement ancien + création ou division de logement |
| Plombier / salle de bain | ventes récentes, logements anciens, extensions, créations de pièces d'eau, population senior si ajout INSEE | maisons/appartements anciens vendus récemment |
| Peintre / solier / plaquiste | ventes récentes, volume DVF, logements anciens, projets d'extension, appartements et maisons | mutation récente, rénovation intérieure probable |
| Paysagiste / clôture / terrasse | maisons avec terrain, surface parcellaire, ventes de maisons, extensions, piscines, annexes | maisons avec jardin + prix DVF élevé + ventes récentes |
| Pisciniste | grandes parcelles, maisons individuelles, pouvoir d'achat DVF, climat/région, concurrence spécialisée | grandes parcelles dans zones à fort prix immobilier |
| Solaire / photovoltaïque | maisons individuelles, potentiel toiture, DPE moyen/mauvais, pouvoir d'achat, concurrence RGE solaire | maison individuelle + bonne surface toiture + peu de concurrents RGE |
| Maçon / gros œuvre | permis récents, extensions, constructions neuves, surélévations, démolitions/reconstructions, surface créée | autorisation récente avec surface créée importante |
| Architecte / maître d'œuvre / courtier | complexité projet, extensions, changements de destination, DPE E/F/G, DVF élevé, volume de permis | zone avec projets complexes et budget local élevé |

Pour le MVP, il est recommandé de commencer avec 4 métiers :

```text
1. isolation / rénovation énergétique
2. menuiserie / fenêtres
3. couvreur / charpentier
4. peintre / rénovation intérieure
```

Ces métiers couvrent des signaux différents : DPE, permis, DVF, typologie du bâti et ventes récentes.

#### Sous-score 4 — Dynamique DVF locale

Objectif : qualifier le contexte immobilier et le budget probable de la zone.

Indicateurs :

- volume de ventes ;
- prix médian au m² ;
- évolution du prix au m² ;
- part maisons / appartements ;
- ventes de maisons avec terrain ;
- liquidité du marché.

#### Sous-score 5 — Récence des signaux

Objectif : éviter de survaloriser des signaux trop anciens.

```text
signal < 3 mois      => poids fort
signal 3 à 12 mois   => poids moyen
signal 12 à 24 mois  => poids faible
signal > 24 mois     => tendance historique seulement
```

#### Sous-score 6 — Accessibilité / distance

Objectif : respecter le vrai rayon d'intervention.

Indicateurs :

- distance depuis l'atelier ;
- temps de trajet estimé si disponible ;
- zone dans le rayon 10, 20 ou 30 km ;
- pénalité pour les zones en limite de rayon.

#### Sous-score 7 — Concurrence locale

Objectif : éviter de recommander une zone attractive mais déjà saturée.

Indicateurs possibles :

- nombre d'entreprises du même métier dans la zone ou à proximité ;
- densité concurrentielle par habitant ou par logement ;
- présence de grandes franchises ou réseaux si détectable.

Ce sous-score peut être ajouté après le MVP si l'on veut réduire la complexité initiale.

#### Exemple de sortie artisan

```text
Zone : Rennes Nord
Métier : menuisier
Rayon : 20 km
Score global : 82/100

Détail :
- Activité travaux : 76/100
- Besoin rénovation : 88/100
- Compatibilité métier : 91/100
- Dynamique DVF : 72/100
- Récence : 70/100
- Distance : 95/100
- Concurrence locale : 62/100

Pourquoi cette zone ressort :
- forte proportion de DPE E/F/G ;
- maisons individuelles anciennes ;
- extensions et rénovations récentes ;
- marché DVF actif ;
- zone proche de l'atelier.
```

### 6.2 Score de transformation immobilière

Cible : agences, investisseurs, marchands de biens, promoteurs, analystes locaux.

```text
score_transformation_immo =
  0.30 * intensité_autorisations
+ 0.20 * diversité_des_projets
+ 0.20 * dynamique_transactions_dvf
+ 0.15 * évolution_prix_m2
+ 0.15 * changements_d_usage_ou_densification
```

### 6.3 Score de potentiel marché immobilier

Cible : agences immobilières, investisseurs, banques, assureurs.

```text
score_potentiel_marche =
  0.35 * volume_transactions
+ 0.25 * niveau_prix_m2
+ 0.20 * tendance_prix_m2
+ 0.10 * liquidité_du_marché
+ 0.10 * cohérence_typologie_biens
```

### 6.3.1 Module agences immobilières

Le profil agence immobilière ne doit pas se limiter à un score générique “marché immobilier”. Une agence a besoin de décider où prospecter des vendeurs, comment argumenter une estimation, quels quartiers recommander à des acquéreurs et quels secteurs éviter ou surveiller.

Le module agence doit donc exposer plusieurs scores complémentaires.

#### Score 1 — Prospection vendeurs

Objectif : identifier les zones où une agence doit concentrer ses actions pour rentrer des mandats.

```text
score_prospection_vendeurs =
  0.25 * volume_ventes_recent
+ 0.20 * hausse_transactions
+ 0.20 * niveau_prix_m2
+ 0.15 * densité_logements
+ 0.10 * dynamique_urbanisme
+ 0.10 * part_proprietaires_estimée
```

Indicateurs :

- ventes DVF sur 12, 24 et 36 mois ;
- évolution du nombre de transactions ;
- prix médian au m² ;
- écart du prix au m² par rapport à la commune ;
- densité résidentielle ;
- typologie maison / appartement ;
- part propriétaires / locataires si données INSEE intégrées ;
- activité d'urbanisme autour de la zone.

#### Score 2 — Liquidité du marché

Objectif : mesurer si une zone génère suffisamment de transactions pour être intéressante commercialement.

```text
score_liquidité =
  0.40 * nombre_ventes_12m
+ 0.25 * régularité_transactions
+ 0.20 * évolution_volume_ventes
+ 0.15 * diversité_typologies_vendues
```

Point de vigilance : DVF ne donne pas directement le délai de vente. Le score de liquidité doit donc être présenté comme un indicateur de volume et de régularité des transactions, pas comme une mesure directe de vitesse de vente.

#### Score 3 — Valorisation / prix immobilier

Objectif : comprendre où les prix sont élevés, en progression ou décorrélés des zones voisines.

```text
score_valorisation =
  0.30 * prix_median_m2
+ 0.25 * évolution_prix_24m
+ 0.20 * écart_vs_commune
+ 0.15 * écart_vs_zones_voisines
+ 0.10 * stabilité_prix
```

Indicateurs :

- prix médian au m² ;
- évolution 12, 24 et 36 mois ;
- comparaison avec la commune ;
- comparaison avec les zones voisines ;
- fourchette observée ;
- part de ventes haut de gamme ;
- dispersion des prix.

#### Score 4 — Quartier en mutation

Objectif : détecter les quartiers qui changent structurellement.

```text
score_quartier_mutation =
  0.25 * croissance_autorisations
+ 0.20 * changements_destination
+ 0.20 * démolitions_reconstructions
+ 0.15 * créations_logements
+ 0.10 * hausse_volume_ventes
+ 0.10 * besoin_rénovation_dpe
```

Indicateurs :

- extensions ;
- démolitions / reconstructions ;
- créations de logements ;
- changements de destination ;
- hausse des transactions ;
- DPE E/F/G dans le parc ancien ;
- évolution sur 12, 24 et 36 mois.

#### Score 5 — Opportunité acquéreur

Objectif : aider une agence à repérer les zones intéressantes pour conseiller un acheteur.

```text
score_opportunité_acquéreur =
  0.25 * prix_inférieur_aux_voisins
+ 0.20 * tendance_positive_modérée
+ 0.20 * signaux_transformation
+ 0.15 * volume_ventes_suffisant
+ 0.10 * potentiel_rénovation_dpe
+ 0.10 * stabilité_marché
```

Lecture : une zone peut être intéressante si elle reste moins chère que les zones voisines mais montre des signaux de transformation et de reprise.

#### Score 6 — Risque / frein commercial

Objectif : éviter de recommander une zone uniquement parce qu'un indicateur est bon.

```text
score_risque_commercial =
  0.25 * baisse_volume_ventes
+ 0.20 * baisse_ou_stagnation_prix
+ 0.15 * faible_liquidité
+ 0.15 * DPE_FG_très_élevé
+ 0.10 * absence_projets_urbains
+ 0.10 * forte_concurrence_agences
+ 0.05 * risques_ou_contraintes
```

Ce score est négatif : plus il est élevé, plus la zone demande de prudence.

#### Score 7 — Contexte estimation locale

Objectif : aider une agence à préparer une estimation avec des comparables DVF et un contexte de marché.

```text
score_fiabilité_estimation =
  0.30 * nombre_comparables_récents
+ 0.25 * proximité_géographique_comparables
+ 0.20 * similarité_typologie_surface
+ 0.15 * récence_transactions
+ 0.10 * cohérence_fourchette_prix
```

Exemple de sortie :

```text
Bien analysé : appartement T3, 65 m²
Zone : quartier sélectionné
Références DVF proches : 12 ventes comparables sur 24 mois
Prix médian observé : 4 850 €/m²
Fourchette : 4 300 à 5 400 €/m²
Tendance quartier : +6 % sur 24 mois
Score fiabilité estimation : 78/100
```

#### Score global agence

Le score global agence peut être calculé comme une synthèse, mais il doit toujours rester explicable.

```text
score_agence =
  0.25 * prospection_vendeurs
+ 0.20 * liquidité
+ 0.20 * valorisation
+ 0.15 * quartier_mutation
+ 0.10 * opportunité_acquéreur
- 0.10 * risque_commercial
```

Exemple de sortie :

```text
Zone : Lyon 7e / Gerland
Période : 24 mois
Profil : agence immobilière

Score global agence : 86/100

Détail :
- Prospection vendeurs : 82/100
- Liquidité marché : 89/100
- Valorisation prix : 84/100
- Quartier en mutation : 91/100
- Opportunité acquéreur : 76/100
- Risque commercial : 32/100

Tendance :
- score global : +14 pts sur 24 mois
- prix médian : +8 %
- volume de ventes : +11 %
- autorisations d'urbanisme : +18 %
```

### 6.4 Score de demande BTP / matériaux

Cible : fournisseurs BTP, franchises travaux, distributeurs et fabricants.

```text
score_demande_btp =
  0.25 * surfaces_créées_ou_transformées
+ 0.20 * volume_projets_compatibles
+ 0.20 * typologie_travaux
+ 0.15 * besoin_rénovation_dpe
+ 0.10 * dynamique_zone
+ 0.10 * niveau_budget_dvf
```

Catégories possibles :

- menuiserie ;
- toiture ;
- isolation ;
- chauffage ;
- électricité ;
- plomberie ;
- aménagement extérieur ;
- gros œuvre ;
- équipement commercial.

### 6.5 Score de mutation urbaine

Cible : collectivités, bureaux d'études, observatoires.

```text
score_mutation_urbaine =
  0.30 * intensité_des_projets
+ 0.20 * changement_de_destination
+ 0.20 * densification_ou_extension
+ 0.15 * démolition_reconstruction
+ 0.15 * évolution_du_marché_dvf
```



### 6.6 Règles de seuil minimum et qualité du score

Le moteur de scoring ne doit jamais produire une note forte à partir d'un échantillon trop faible. Le score d'opportunité et le score de confiance doivent être séparés.

```text
score_opportunité = attractivité commerciale ou territoriale de la zone
confidence_score = fiabilité des données utilisées pour calculer ce score
```

Une zone peut donc avoir :

- un score d'opportunité élevé mais une confiance faible ;
- un score moyen avec une confiance forte ;
- un score masqué si les données sont insuffisantes.

#### Règles dures

```text
Si dpe_count < seuil_minimum : ne pas afficher de score DPE fort.
Si sales_count < seuil_minimum : afficher “données DVF insuffisantes”.
Si permits_count trop faible : privilégier tendance commune/IRIS plutôt que micro-zone.
Si échantillon faible : masquer la note globale ou l'afficher grisée.
Si 2 sources sur 3 sont faibles : ne pas afficher de score global plein.
```

#### Seuils initiaux recommandés

| Source | Condition | Statut | Effet produit |
|---|---|---|---|
| DPE | `dpe_count < 10` | insuffisant | masquer le sous-score DPE |
| DPE | `10 <= dpe_count < 20` | fragile | afficher avec prudence, plafonner le sous-score DPE |
| DPE | `dpe_count >= 20` | exploitable | score DPE possible |
| DVF | `sales_count < 5` | insuffisant | masquer liquidité/prix local fiable |
| DVF | `5 <= sales_count < 10` | fragile | griser le score DVF et afficher un warning |
| DVF | `sales_count >= 10` | exploitable | score DVF possible |
| Urbanisme | `permits_count < 5` | fragile | éviter les conclusions micro-zone |
| Global | 2 sources faibles sur 3 | insuffisant | masquer ou griser le score global |
| Confiance | `confidence_score < 40` | faible | score masqué |
| Confiance | `40 <= confidence_score < 70` | moyen | score grisé avec avertissement |
| Confiance | `confidence_score >= 70` | bon | score affiché normalement |

Ces seuils sont des valeurs de départ. Ils doivent être configurables par type de zone, densité urbaine, période et segment utilisateur.

#### Plafonnement des sous-scores

Pour éviter les faux positifs, un sous-score peut être plafonné si le volume est faible.

```python
def cap_score_by_sample_size(score: float, count: int, min_count: int, strong_count: int) -> float:
    if count < min_count:
        return None  # sous-score masqué
    if count < strong_count:
        return min(score, 60)  # score visible mais jamais fort
    return score
```

Exemple :

```text
DPE E/F/G très élevé mais seulement 12 DPE disponibles.
Sous-score brut : 87/100
Sous-score affiché : 60/100 maximum
Message : signal intéressant mais échantillon DPE limité.
```

#### Calcul simplifié du score de confiance

```text
confidence_score =
  0.25 * dvf_coverage_score
+ 0.25 * dpe_coverage_score
+ 0.20 * urbanism_coverage_score
+ 0.15 * source_freshness_score
+ 0.10 * temporal_consistency_score
+ 0.05 * geocoding_quality_score
```

Exemples de composantes :

- `dvf_coverage_score` : basé sur `sales_count`, régularité des ventes et période couverte ;
- `dpe_coverage_score` : basé sur `dpe_count`, ancienneté des diagnostics et diversité des logements ;
- `urbanism_coverage_score` : basé sur `permits_count`, fraîcheur et précision géographique ;
- `source_freshness_score` : pénalise les sources trop anciennes ;
- `temporal_consistency_score` : pénalise les variations extrêmes dues à un faible volume ;
- `geocoding_quality_score` : pénalise les rattachements flous à la commune seulement.

#### Statuts d'affichage

| `score_visibility` | Condition | Interface |
|---|---|---|
| `visible` | confiance suffisante | score normal |
| `caution` | confiance moyenne ou une source fragile | score affiché avec avertissement |
| `greyed` | échantillon limité | score grisé, non prioritaire |
| `hidden` | confiance trop faible | score masqué |
| `fallback_zone` | micro-zone fragile mais commune/IRIS fiable | afficher la maille supérieure |

#### Messages d'avertissement possibles

```text
Données DPE insuffisantes sur cette zone.
Volume DVF trop faible pour mesurer la liquidité locale.
Tendance urbanisme calculée à la maille commune, car la micro-zone contient trop peu d'autorisations.
Score grisé : la recommandation repose sur un échantillon limité.
Score masqué : données insuffisantes pour produire une note fiable.
```

## 7. Modèle de données simplifié

### Table `urbanisme_projects`

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| source_id | text | Identifiant source |
| commune_code | text | Code INSEE |
| commune_name | text | Nom de commune |
| parcel_id | text | Identifiant cadastral si disponible |
| project_type | text | PC, DP, PA, PD |
| work_category | text | Extension, construction, démolition, rénovation, changement de destination, etc. |
| decision_date | date | Date de décision |
| filing_date | date | Date de dépôt si disponible |
| opening_date | date | Date d'ouverture de chantier si disponible |
| completion_date | date | Date d'achèvement si disponible |
| surface_created | numeric | Surface créée |
| surface_existing | numeric | Surface existante |
| destination | text | Habitation, commerce, bureaux, etc. |
| geom | geometry | Géométrie ou point |
| confidence_level | numeric | Niveau de confiance interne |

### Table `dvf_transactions`

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| mutation_date | date | Date de vente |
| price | numeric | Valeur foncière |
| built_surface | numeric | Surface bâtie |
| land_surface | numeric | Surface terrain |
| property_type | text | Maison, appartement, dépendance, local |
| commune_code | text | Code INSEE |
| parcel_id | text | Identifiant cadastral |
| price_per_m2 | numeric | Prix au m² calculé |
| geom | geometry | Géométrie ou point |

### Table `dpe_diagnostics`

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| dpe_number_hash | text | Numéro DPE pseudonymisé si conservé |
| diagnostic_date | date | Date du diagnostic |
| energy_class | text | Classe énergétique A à G |
| ges_class | text | Classe GES A à G |
| housing_type | text | Maison, appartement, immeuble collectif |
| built_surface | numeric | Surface du logement |
| construction_period | text | Période de construction si disponible |
| address_hash | text | Adresse pseudonymisée ou identifiant interne |
| commune_code | text | Code INSEE |
| parcel_id | text | Identifiant cadastral si disponible |
| geom | geometry | Point ou rattachement géographique |
| source_updated_at | timestamp | Date de mise à jour source |
| confidence_level | numeric | Niveau de confiance interne |

### Table `analysis_zones`

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| zone_type | text | Commune, quartier, IRIS, carreau, rayon, territoire personnalisé |
| name | text | Nom de la zone |
| commune_code | text | Code INSEE si applicable |
| geom | geometry | Polygone de la zone |
| parent_zone_id | UUID | Zone parente éventuelle |



### Table `area_metrics`

Cette table contient les métriques neutres calculées par zone et période. Elle sert de base commune à tous les scorings.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| zone_id | UUID | Zone analysée |
| period | text | 3m, 6m, 12m, 24m |
| period_start | date | Début de période analysée |
| period_end | date | Fin de période analysée |
| comparison_period | text | Période de comparaison : previous_period, previous_year, rolling_window |
| permits_count | numeric | Nombre d'autorisations |
| permits_extension_count | numeric | Extensions |
| permits_new_housing_count | numeric | Créations de logements |
| permits_demolition_count | numeric | Démolitions |
| avg_created_surface | numeric | Surface créée moyenne |
| sales_count | numeric | Nombre de ventes DVF |
| median_price_m2 | numeric | Prix médian au m² |
| price_m2_evolution | numeric | Évolution des prix sur la période |
| median_price_m2_vs_commune | numeric | Écart du prix médian au m² vs commune |
| median_price_m2_vs_neighbors | numeric | Écart du prix médian au m² vs zones voisines |
| price_dispersion | numeric | Dispersion des prix observés |
| comparable_sales_count | numeric | Nombre de ventes comparables pour estimation |
| high_end_sales_ratio | numeric | Part de ventes dans le haut de marché local |
| regularity_sales_index | numeric | Régularité des transactions dans le temps |
| permits_count_evolution | numeric | Variation du nombre d'autorisations vs période précédente |
| sales_count_evolution | numeric | Variation du nombre de ventes vs période précédente |
| dpe_efg_ratio_evolution | numeric | Variation de la part DPE E/F/G vs période précédente |
| houses_sales_count | numeric | Ventes de maisons |
| apartments_sales_count | numeric | Ventes d'appartements |
| dpe_count | numeric | Nombre de DPE disponibles |
| dpe_efg_ratio | numeric | Proportion de DPE E/F/G |
| dpe_fg_ratio | numeric | Proportion de DPE F/G |
| house_ratio | numeric | Part de maisons |
| apartment_ratio | numeric | Part d'appartements |
| old_building_ratio | numeric | Part estimée de bâti ancien |
| confidence_score | numeric | Qualité / fiabilité de l'agrégat |
| dpe_status | text | insufficient, fragile, exploitable |
| dvf_status | text | insufficient, fragile, exploitable |
| urbanism_status | text | insufficient, fragile, exploitable |
| weak_sources_count | numeric | Nombre de sources jugées faibles sur la zone/période |
| recommended_zone_level | text | Niveau conseillé si la micro-zone est trop fragile : micro, iris, commune |
| quality_warnings | jsonb | Liste des avertissements qualité data |

### Table `scoring_configs`

Les pondérations sont définies dans des fichiers YAML versionnés dans le repo (`workers/scoring_configs/`), lus par les workers Python au moment du calcul. La table `scoring_configs` stocke un snapshot de la configuration active utilisée pour chaque run, ce qui permet de retrouver exactement quelles pondérations ont produit un score donné.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| score_type | text | prospection_locale, transformation_immo, potentiel_marche, prospection_vendeurs, liquidite_marche, valorisation_prix, quartier_mutation, opportunite_acquereur, risque_commercial, estimation_locale, demande_btp, mutation_urbaine |
| user_segment | text | artisan, agence_immo, fournisseur_btp, collectivité |
| trade_or_category | text | Métier ou catégorie |
| version | text | Version de configuration |
| weights | jsonb | Pondérations des sous-scores |
| thresholds | jsonb | Seuils de normalisation |
| active | boolean | Configuration active |
| created_at | timestamp | Date de création |

### Table `zone_scores`

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| zone_id | UUID | Zone analysée |
| score_type | text | prospection_locale, transformation_immo, potentiel_marche, prospection_vendeurs, liquidite_marche, valorisation_prix, quartier_mutation, opportunite_acquereur, risque_commercial, estimation_locale, demande_btp, mutation_urbaine |
| user_segment | text | artisan, agence_immo, investisseur, fournisseur_btp, collectivite, etc. |
| trade_or_category | text | Métier ou catégorie si applicable |
| period | text | 3m, 6m, 12m, 24m |
| period_start | date | Début de période analysée |
| period_end | date | Fin de période analysée |
| global_score | numeric | Score final |
| sub_scores | jsonb | Sous-scores par clé (ex: `{"activity": 76, "renovation_need": 88, "trade_fit": 91, ...}`) — les clés présentes varient selon le `score_type` et le `user_segment` |
| trend_score | numeric | Score de tendance / évolution |
| global_score_delta_previous | numeric | Variation du score vs période précédente |
| global_score_delta_year | numeric | Variation du score vs même période N-1 si disponible |
| trend_label | text | hausse, baisse, stable, accélération, ralentissement |
| confidence_score | numeric | Niveau de confiance |
| score_visibility | text | visible, caution, greyed, hidden, fallback_zone |
| weak_sources_count | numeric | Nombre de sources faibles utilisées pour ce score |
| quality_warnings | jsonb | Avertissements à afficher à l'utilisateur |
| fallback_zone_id | UUID | Zone de repli si la maille initiale est trop fragile |
| explanation | jsonb | Raisons principales du score |
| generated_at | timestamp | Date de calcul |



### Table `scoring_quality_rules`

Cette table permet de versionner les seuils minimums et les règles de masquage/grisage sans les coder en dur.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| score_type | text | Type de score concerné |
| user_segment | text | Segment utilisateur |
| zone_type | text | commune, IRIS, quartier, grille, rayon |
| period | text | 3m, 6m, 12m, 24m |
| min_dpe_count | numeric | Minimum DPE pour afficher un signal DPE |
| strong_dpe_count | numeric | Volume DPE à partir duquel le sous-score peut être fort |
| min_sales_count | numeric | Minimum DVF pour afficher un signal marché |
| strong_sales_count | numeric | Volume DVF à partir duquel le score DVF peut être fort |
| min_permits_count | numeric | Minimum urbanisme pour interpréter une tendance micro-zone |
| min_confidence_visible | numeric | Seuil de confiance pour score visible |
| min_confidence_greyed | numeric | Seuil de confiance pour score grisé |
| active | boolean | Règle active |
| version | text | Version de la règle |
| created_at | timestamp | Date de création |

Exemple de configuration initiale :

```json
{
  "score_type": "prospection_locale",
  "user_segment": "artisan",
  "zone_type": "iris",
  "period": "12m",
  "min_dpe_count": 10,
  "strong_dpe_count": 20,
  "min_sales_count": 5,
  "strong_sales_count": 10,
  "min_permits_count": 5,
  "min_confidence_visible": 70,
  "min_confidence_greyed": 40
}
```

### Table `product_events`

Cette table sert à mesurer si le MVP crée de vraies décisions territoriales, pas seulement des vues de carte.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| user_id | UUID | Utilisateur |
| event_name | text | Nom de l'événement produit |
| user_segment | text | artisan, agence_immo, fournisseur_btp, etc. |
| zone_id | UUID | Zone concernée si applicable |
| score_type | text | Score consulté si applicable |
| metadata | jsonb | Détails : métier, rayon, période, score, action |
| created_at | timestamp | Date de l'événement |

Événements MVP recommandés :

```text
zone_detail_opened
subscores_opened
zone_compared
zone_saved
zone_exported
alert_created
market_note_generated
credibility_feedback_submitted
willingness_to_pay_submitted
```

### Table `zone_feedback`

Cette table permet de collecter les retours terrain sur la crédibilité des recommandations.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| user_id | UUID | Utilisateur |
| zone_id | UUID | Zone évaluée |
| score_id | UUID | Score évalué |
| credibility_answer | text | yes, no, unsure |
| reason | text | data_insufficient, bad_ranking, opaque_score, local_knowledge_disagrees, other |
| comment | text | Commentaire libre |
| created_at | timestamp | Date du retour |



### Table `score_history_snapshots`

Cette table sert à historiser les scores calculés à chaque exécution importante. Elle permet d'afficher des courbes, des comparaisons et des tendances sans recalculer toute la donnée brute.

| Champ | Type | Description |
|---|---|---|
| id | UUID | Identifiant interne |
| zone_id | UUID | Zone analysée |
| score_type | text | Type de score |
| user_segment | text | Segment utilisateur |
| trade_or_category | text | Métier ou catégorie |
| period | text | 3m, 6m, 12m, 24m |
| global_score | numeric | Score global au moment du snapshot |
| sub_scores | jsonb | Sous-scores au moment du snapshot |
| metric_values | jsonb | Métriques principales utilisées |
| generated_at | timestamp | Date de génération |
| source_freshness | jsonb | Fraîcheur des sources utilisées |

Cette table est utile pour produire :

- courbes de score ;
- graphiques par sous-score ;
- classement des zones qui montent ;
- alertes sur accélération ou baisse ;
- rapports mensuels et trimestriels.

## 8. API MVP

Ces endpoints sont exposés par l'application **NestJS** `apps/territo-api`. Le frontend **Angular** les consomme via un client typé partagé dans le monorepo Nx (`libs/data-access/api-client-angular`).

Convention territoire : tous les endpoints utilisant un territoire nommé (ville, métropole, département) acceptent un paramètre `territory_code` (code INSEE ou slug interne). Les endpoints en mode local utilisent `lat` + `lng`. Les deux conventions ne se mélangent pas.

### `POST /scores/local`

Lit les scores pré-calculés pour les zones dans un rayon autour d'une adresse. Ne recalcule rien à la volée.

Payload :

```json
{
  "trade": "menuisier",
  "lat": 48.1173,
  "lng": -1.6778,
  "radius_km": 20,
  "period": "12m"
}
```

Réponse :

```json
{
  "trade": "menuisier",
  "radius_km": 20,
  "areas": [
    {
      "name": "Cesson-Sévigné",
      "global_score": 82,
      "confidence_score": 74,
      "score_visibility": "visible",
      "trend": {
        "label": "hausse",
        "delta_3m": 6,
        "delta_6m": 11,
        "delta_12m": 18
      },
      "subscores": {
        "renovation_need": 78,
        "recent_sales": 84,
        "work_signals": 71,
        "building_compatibility": 88,
        "purchasing_power": 80,
        "competition": 61,
        "distance": 95
      },
      "recommendation": "Prioriser fenêtres, portes d'entrée et isolation des ouvertures.",
      "quality_warnings": []
    }
  ]
}
```

### `GET /territory-benchmark`

Retourne un classement de zones pour un score non limité au cas artisan.

Paramètres :

```text
territory_code=200046977
score_type=transformation_immo
period=24m
zone_level=quartier
```

`territory_code` est le code INSEE de la commune ou de l'EPCI (ex: `200046977` pour la Métropole de Lyon).

### `GET /agency/market-scores`

Retourne les scores dédiés à une agence immobilière sur un territoire donné.

Paramètres :

```text
territory_code=200046977
period=24m
zone_level=quartier
property_type=appartement
```

Retour simplifié :

```json
{
  "profile": "agence_immo",
  "period": "24m",
  "zones": [
    {
      "name": "Lyon 7e / Gerland",
      "global_agency_score": 86,
      "trend": {
        "label": "hausse",
        "delta_24m": 14
      },
      "sub_scores": {
        "prospection_vendeurs": 82,
        "liquidite_marche": 89,
        "valorisation_prix": 84,
        "quartier_mutation": 91,
        "opportunite_acquereur": 76,
        "risque_commercial": 32
      },
      "metrics": {
        "median_price_m2": 5200,
        "price_m2_evolution_24m": 8.0,
        "sales_count_24m": 214,
        "sales_count_evolution_24m": 11.0,
        "urbanism_evolution_24m": 18.0
      }
    }
  ]
}
```

### `POST /agency/estimation-context`

Retourne un contexte de marché local pour aider une agence à préparer une estimation. Ce n'est pas une estimation automatique définitive, mais une base de comparables et de tendance.

Payload :

```json
{
  "lat": 45.748,
  "lng": 4.846,
  "property_type": "appartement",
  "surface_m2": 65,
  "rooms": 3,
  "period": "24m"
}
```

Retour simplifié :

```json
{
  "comparable_sales_count": 12,
  "median_price_m2": 4850,
  "price_range_m2": {
    "low": 4300,
    "high": 5400
  },
  "trend_24m": 6.0,
  "estimation_reliability_score": 78,
  "warnings": [
    "DVF ne donne pas l'état intérieur du bien",
    "adapter selon étage, extérieur, travaux et prestations"
  ]
}
```

### `GET /zones/{zone_id}/scores`

Retourne les scores disponibles pour une zone, avec sous-scores.

```json
{
  "zone": "Rennes Nord",
  "score_type": "prospection_locale",
  "trade": "menuisier",
  "global_score": 82,
  "trend": {
    "label": "hausse",
    "delta_previous_period": 9,
    "delta_12m": 18
  },
  "sub_scores": {
    "activite_travaux": 76,
    "besoin_renovation": 88,
    "compatibilite_metier": 91,
    "dynamique_dvf": 72,
    "recence": 70,
    "distance": 95,
    "concurrence_locale": 62
  },
  "confidence_score": 74,
  "score_visibility": "visible",
  "quality_warnings": [],
  "explanation": [
    "DPE E/F/G supérieur à la médiane du rayon",
    "forte activité d'extensions",
    "marché immobilier actif",
    "zone proche du point de départ"
  ]
}
```



### `GET /zones/{zone_id}/score-history`

Retourne l'historique d'un score pour une zone.

Paramètres :

```text
score_type=prospection_locale
trade=menuisier
period=12m
from=2024-01-01
to=2026-12-31
```

Réponse :

```json
{
  "zone": "Rennes Nord",
  "score_type": "prospection_locale",
  "trade": "menuisier",
  "series": [
    { "date": "2025-01-01", "global_score": 61 },
    { "date": "2025-04-01", "global_score": 68 },
    { "date": "2025-07-01", "global_score": 74 },
    { "date": "2025-10-01", "global_score": 79 },
    { "date": "2026-01-01", "global_score": 82 }
  ]
}
```

### `GET /zones/rising`

Retourne les zones dont le score progresse le plus sur une période donnée.

Paramètres :

```text
territory_code=243500139
score_type=demande_btp
category=isolation
period=12m
min_delta=10
```

`territory_code` suit la même convention que les autres endpoints.

Usage produit : afficher les zones émergentes, pas seulement les zones déjà fortes.

### `POST /alerts`

Crée une alerte.

```json
{
  "alert_type": "local_radius",
  "base_location": {
    "lat": 48.1173,
    "lng": -1.6778
  },
  "radius_km": 20,
  "score_type": "prospection_locale",
  "trade": "menuisier",
  "min_score": 70,
  "min_trend_delta": 8,
  "frequency": "weekly"
}
```

## 9. Fonctionnalités MVP

### MVP 1 — Données, carte et premier score fiable

Objectif : prouver qu'un utilisateur comprend et juge crédible un classement de zones.

À construire :

- choisir une ville ou métropole pilote ;
- importer autorisations d'urbanisme ;
- importer DVF géolocalisée ;
- importer DPE logements existants ;
- créer les zones d'analyse : commune, IRIS, quartier ou grille ;
- créer les métriques neutres par zone ;
- calculer un seul score principal ;
- afficher les sous-scores ;
- afficher le `confidence_score` ;
- appliquer les règles de masquage/grisage ;
- afficher une carte ;
- afficher le détail d'une zone ;
- permettre la sauvegarde ou l'export CSV basique ;
- collecter un feedback de crédibilité.

À ne pas construire dans le MVP 1 :

- score fournisseur BTP ;
- score collectivité ;
- rapports PDF avancés ;
- API publique ;
- intégration CRM ;
- trop de métiers ;
- historique complexe 24/36 mois si la donnée n'est pas stabilisée.

### MVP 2 — Segment prioritaire

Ajouter un seul segment prioritaire :

- soit profil agence immobilière : prospection vendeurs, quartier en mutation, note de marché locale ;
- soit profil artisan : rayon d'intervention, métier, recommandations de prospection locale.

Le choix doit être guidé par les retours MVP 1 et par l'intention de payer.

### MVP 3 — Version pro

Après validation :

- plusieurs territoires comparables ;
- plusieurs métiers ou profils ;
- alertes hebdomadaires ou mensuelles ;
- rapports ;
- exports avancés ;
- accès API ;
- historique des scores ;
- courbes d'évolution ;
- alertes sur zones en accélération.

## 10. Métriques produit et analytics MVP

La métrique principale est :

> **Nombre de décisions territoriales qualifiées générées par semaine.**

Une décision territoriale qualifiée est une action comme : ouvrir le détail d'une zone, comparer deux zones, sauvegarder, exporter, créer une alerte, générer une note de marché ou donner un feedback de crédibilité.

### Événements produit à tracker

```text
zone_detail_opened
subscores_opened
zone_compared
zone_saved
zone_exported
alert_created
market_note_generated
credibility_feedback_submitted
willingness_to_pay_submitted
```

### Tableau de bord MVP

| Catégorie | Métrique | Objectif MVP |
|---|---|---:|
| Activation | % utilisateurs ayant consulté 3 zones ou plus | ≥ 40 % |
| Valeur | % utilisateurs ayant sauvegardé/exporté une zone | ≥ 25 % |
| Valeur | % zones top 10 jugées crédibles | ≥ 70 % |
| Compréhension | % utilisateurs ouvrant les sous-scores | ≥ 50 % |
| Rétention | retour J+7 | ≥ 25 % |
| Alerte | % utilisateurs activés créant une alerte | ≥ 15 % |
| Monétisation | pilotes prêts à payer | 2 à 3 sur 10 |
| Qualité data | % zones avec `confidence_score >= 70` | À suivre |
| Qualité data | % scores grisés ou masqués | À suivre |

### Feedback utilisateur intégré

Après consultation d'une zone :

```text
Cette recommandation vous semble-t-elle crédible ?
- Oui
- Non
- Je ne sais pas
```

Si non :

```text
Pourquoi ?
- données insuffisantes
- zone mal classée
- score trop opaque
- je connais le terrain et la zone n'est pas pertinente
- autre
```

Pour tester la monétisation :

```text
Payeriez-vous pour recevoir ce classement chaque mois ?
- Oui
- Non

À quel prix ?
- 29 €/mois
- 49 €/mois
- 99 €/mois
- 199 €/mois
- plus
```

## 11. Confidentialité et conformité

Principes :

- ne pas afficher les noms de particuliers ;
- ne pas créer de fiche individuelle propriétaire ;
- ne pas cibler nominativement un logement à partir d'un DPE ;
- privilégier les agrégats par zone ;
- limiter les exports détaillés ;
- ne pas permettre la ré-identification indirecte ;
- documenter les sources et limites des données ;
- afficher un niveau de confiance ;
- masquer les scores quand l'échantillon est trop faible ;
- ne pas exporter d'adresses individuelles dans l'offre standard ;
- journaliser les exports ;
- afficher les avertissements qualité data quand une source est fragile.

Positionnement recommandé :

> Outil de veille commerciale et territoriale, pas base de prospection nominative.

## 12. Limites techniques

Points à surveiller :

- qualité variable des données selon les communes ;
- délais de publication des autorisations d'urbanisme ;
- DVF non temps réel ;
- DPE non représentatif de l'ensemble du parc ;
- données parfois incomplètes sur les surfaces ou parcelles ;
- un permis accordé ne signifie pas qu'un chantier est disponible ;
- les scores doivent être contextualisés selon le profil utilisateur.

## 13. Roadmap technique recommandée

Cette roadmap suppose une petite équipe (1 à 2 développeurs à plein temps) et un périmètre strictement limité au MVP 1. Les délais sont des objectifs, pas des garanties : la qualité des données publiques sur la ville pilote peut allonger significativement les phases 1 et 2.

### Semaine 1 à 2 — socle data

- choisir une ville pilote ;
- créer la base PostgreSQL/PostGIS ;
- importer autorisations d'urbanisme ;
- importer DVF géolocalisée ;
- importer un premier échantillon DPE ;
- créer les premières zones d'analyse ;
- faire les premiers croisements géographiques.

### Semaine 3 à 4 — métriques neutres

- créer les agrégats par zone ;
- calculer les volumes DPE, DVF et urbanisme ;
- calculer les premières tendances simples ;
- calculer le `confidence_score` ;
- appliquer les règles de seuil minimum ;
- afficher les zones masquées, grisées ou visibles.

### Semaine 5 à 6 — premier score utilisable

- construire un seul score principal ;
- afficher les sous-scores ;
- afficher les explications ;
- ajouter les avertissements qualité data ;
- créer une première carte interactive Angular + MapLibre ;
- ajouter sauvegarde/export CSV basique.

### Semaine 7 à 8 — validation terrain

- tester avec 10 utilisateurs pilotes ;
- mesurer activation, sauvegarde, export et crédibilité perçue ;
- collecter l'intention de payer ;
- comparer les retours entre artisans et agences si les deux segments sont testés commercialement ;
- choisir le segment prioritaire pour la suite.

Objectif : ne pas sortir une plateforme complète, mais vérifier que le classement de zones est compris, crédible et monétisable.

## 14. Conclusion technique

Le scoring artisan doit être local, mais pas simpliste.

La bonne approche :

- un **score global** pour classer les zones ;
- plusieurs **sous-scores visibles** pour expliquer la note ;
- une pondération différente selon le métier ;
- un niveau de confiance pour ne pas surpromettre ;
- une lecture temporelle pour distinguer zone forte, zone stable et zone émergente ;
- DPE utilisé comme signal de besoin rénovation, pas comme vérité exhaustive.

Territo devient ainsi une plateforme de lecture territoriale multi-profils, pas seulement une app de prospection artisanale.
