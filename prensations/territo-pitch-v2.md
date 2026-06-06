# Territo — Pitch produit

## 1. Résumé en une phrase

**Territo transforme les données publiques d'urbanisme, DVF, cadastre et DPE en scores territoriaux actionnables pour les professionnels du bâtiment, de l'immobilier, du BTP et de l'aménagement.**

Le produit peut servir plusieurs profils : artisans, courtiers en travaux, agences immobilières, investisseurs, fournisseurs BTP, franchises, réseaux multi-sites et collectivités. La lecture ne doit pas seulement être statique : elle doit montrer l'évolution des zones dans le temps.

## 2. Le problème

Les professionnels du bâtiment et de l'immobilier prennent souvent leurs décisions locales avec peu de données exploitables.

Un artisan se demande :

> “Dans mon rayon de 20 km, quelles communes dois-je prioriser pour prospecter ?”

Une agence immobilière se demande :

> “Quels quartiers sont en train de se transformer ?”

Un fournisseur BTP se demande :

> “Où la demande en matériaux, équipements ou rénovation énergétique risque-t-elle d'augmenter ?”

Un investisseur se demande :

> “Quels secteurs montrent à la fois de l'activité immobilière, des ventes, du bâti ancien et des projets de transformation ?”

Aujourd'hui, ces réponses sont dispersées dans des données publiques difficiles à croiser : autorisations d'urbanisme, DVF, cadastre, DPE, limites géographiques et historiques de projets.

## 3. L'insight clé

Un permis de construire déjà accordé peut arriver trop tard pour vendre un chantier à un artisan.

Donc Territo ne doit pas être présenté comme une base de leads propriétaires.

La vraie valeur est plus large :

> détecter les zones où les signaux de travaux, de rénovation, de ventes et de transformation augmentent.

Le même jeu de données peut produire plusieurs lectures :

- où un artisan doit concentrer sa prospection locale ;
- où une agence peut repérer un quartier en mutation ;
- où un fournisseur BTP peut anticiper la demande ;
- où un investisseur peut suivre la dynamique immobilière ;
- où une collectivité peut observer la transformation urbaine.

## 4. La solution

Territo croise :

- les autorisations d'urbanisme : permis, déclarations préalables, démolitions, extensions, changements de destination ;
- DVF : transactions, prix, volumes de ventes, typologies de biens ;
- le cadastre et les limites géographiques : parcelles, communes, quartiers, zones personnalisées ;
- les DPE : classes énergétiques A à G, proportion de logements E/F/G, passoires F/G et signaux de rénovation énergétique.

L'application transforme ces données en :

- cartes ;
- classements de zones ;
- scores par profil ;
- sous-scores explicables ;
- tendances temporelles ;
- courbes d'évolution ;
- alertes ;
- rapports ;
- recommandations commerciales ou territoriales.



## 4.1 Architecture produit retenue

La stack cible est :

```text
Frontend Next.js / MapLibre
  ↓
API Go
  ↓
PostgreSQL + PostGIS
  ↑
Workers Python
- imports data.gouv / ADEME / INSEE
- nettoyage et géocroisements
- agrégats par zone
- scoring métier
- analytics
```

Go sert à exposer une API robuste et rapide. Python sert à traiter les données, calculer les agrégats et faire évoluer les scores sans rigidifier l'API. PostgreSQL/PostGIS reste le cœur géospatial du produit.

## 5. Principe important : plusieurs scorings, pas un seul

Territo ne doit pas avoir une seule note générique.

Il faut distinguer plusieurs familles de scoring.

### 5.1 Score de prospection locale

Pour : artisans, petites entreprises du bâtiment, courtiers en travaux, maîtres d'œuvre locaux.

Question :

> “Dans mon rayon d'intervention, quelles zones dois-je prioriser ?”

Exemple :

> Un menuisier basé à Rennes choisit un rayon de 20 km. Territo classe les communes et quartiers autour de lui selon les extensions, rénovations, ventes récentes, prix DVF, proportion de DPE E/F/G et compatibilité avec son métier.

Ce score est local et relatif au rayon de l'utilisateur.

Il ne doit pas être une note unique opaque. Il doit afficher plusieurs sous-scores :

- activité travaux ;
- besoin rénovation, notamment proportion de DPE E, F ou G ;
- compatibilité métier ;
- dynamique DVF ;
- récence des signaux ;
- distance depuis l'entreprise ;
- concurrence locale si la donnée est disponible.

La note globale est une moyenne pondérée de ces critères. Chaque métier peut avoir une pondération différente.

### 5.2 Score de transformation immobilière

Pour : agences immobilières, investisseurs, marchands de biens, promoteurs.

Question :

> “Quels quartiers sont en train de se transformer ?”

Le score regarde notamment :

- hausse des autorisations d'urbanisme ;
- extensions ;
- démolitions/reconstructions ;
- changements de destination ;
- volume et dynamique des ventes DVF.

### 5.3 Score de potentiel marché immobilier

Pour : agences immobilières, investisseurs, banques, assureurs.

Question :

> “Où le marché immobilier est-il actif, liquide et valorisé ?”

Il regarde surtout :

- prix médian au m² ;
- évolution des prix ;
- volume de transactions ;
- typologie des biens ;
- part maisons / appartements / locaux.

### 5.3.1 Scorings spécifiques pour agences immobilières

Pour une agence immobilière, le produit doit aller plus loin qu'un simple score de prix ou de transformation. Une agence veut rentrer des mandats, conseiller des vendeurs, rassurer des acquéreurs et produire des notes de marché locales.

Territo doit donc proposer un module agence avec plusieurs sous-scores.

#### 1. Score prospection vendeurs

Question :

> “Où l'agence doit-elle concentrer sa prospection pour rentrer des mandats ?”

Critères :

- volume de ventes DVF récent ;
- hausse du nombre de transactions ;
- prix médian élevé ;
- évolution positive du prix au m² ;
- forte densité de logements ;
- part de propriétaires occupants si données INSEE ajoutées ;
- activité d'urbanisme autour de la zone.

#### 2. Score liquidité du marché

Question :

> “Est-ce que la zone génère assez de transactions pour être commercialement intéressante ?”

Critères :

- nombre de ventes sur 12, 24 ou 36 mois ;
- régularité des transactions ;
- évolution du nombre de ventes ;
- diversité des biens vendus ;
- volume de ventes par rapport au parc estimé.

Important : DVF ne donne pas directement le délai de vente. Le score de liquidité doit donc être présenté comme un indicateur de volume et de régularité, pas comme une mesure directe de vitesse de vente.

#### 3. Score valorisation / prix immobilier

Question :

> “Où les prix sont-ils élevés, en progression ou sous-valorisés par rapport aux zones voisines ?”

Critères :

- prix médian au m² ;
- évolution du prix au m² sur 12, 24 et 36 mois ;
- écart par rapport à la commune ;
- écart par rapport aux quartiers voisins ;
- stabilité des prix ;
- part de ventes haut de gamme ;
- dispersion des prix.

#### 4. Score quartier en mutation

Question :

> “Quels quartiers changent structurellement ?”

Critères :

- autorisations d'urbanisme récentes ;
- changements de destination ;
- démolitions / reconstructions ;
- extensions ;
- création de logements ;
- évolution DVF ;
- hausse du volume de ventes ;
- DPE mauvais dans le parc ancien.

#### 5. Score opportunité acquéreur

Question :

> “Où conseiller un acheteur qui cherche un quartier avec potentiel ?”

Critères :

- prix encore inférieur aux quartiers voisins ;
- évolution positive mais pas trop avancée ;
- hausse des permis ou transformations ;
- volume de ventes suffisant ;
- présence de logements à rénover ;
- DPE E/F/G élevé ;
- potentiel de valorisation.

#### 6. Score risque / frein commercial

Question :

> “Quelles zones demandent de la prudence ?”

Critères :

- baisse du volume de ventes ;
- baisse ou stagnation des prix ;
- proportion très élevée de DPE F/G ;
- peu de projets urbains ;
- faible liquidité DVF ;
- marché trop irrégulier ;
- forte concurrence d'agences si SIRENE est utilisé ;
- risques ou contraintes si Géorisques est intégré.

#### 7. Score contexte estimation locale

Question :

> “Est-ce que l'agence a assez de références comparables pour préparer une estimation crédible ?”

Critères :

- ventes comparables récentes ;
- proximité géographique des références DVF ;
- même typologie de bien ;
- surface comparable ;
- période récente ;
- cohérence de la fourchette de prix ;
- dynamique du quartier.

Exemple :

```text
Pour un appartement T3 de 65 m² :

Références DVF proches : 12 ventes comparables sur 24 mois
Prix médian : 4 850 €/m²
Fourchette observée : 4 300 à 5 400 €/m²
Tendance quartier : +6 % sur 24 mois
Score fiabilité estimation : 78/100
```

Le score global agence peut synthétiser ces sous-scores, mais l'interface doit toujours afficher le détail.

```text
Score agence =
  prospection vendeurs
+ liquidité marché
+ valorisation prix
+ quartier en mutation
+ opportunité acquéreur
- risque commercial
```

### 5.4 Score de demande BTP / matériaux

Pour : fournisseurs BTP, distributeurs, fabricants, franchises travaux, réseaux commerciaux.

Question :

> “Où la demande potentielle en matériaux, équipements ou prestations va-t-elle augmenter ?”

Exemples de lecture :

- zones avec beaucoup d'extensions → menuiserie, isolation, électricité, plomberie ;
- zones avec beaucoup de DPE E/F/G → isolation, chauffage, ventilation, fenêtres, toiture ;
- zones avec beaucoup de démolitions/reconstructions → gros œuvre, matériaux lourds ;
- zones avec piscines ou aménagements extérieurs → paysagisme, terrassement, clôtures ;
- zones avec locaux commerciaux → électricité, agencement, sécurité, climatisation.

### 5.5 Score de mutation urbaine

Pour : collectivités, bureaux d'études, observatoires, acteurs publics ou parapublics.

Question :

> “Quels secteurs changent rapidement et comment ?”

Il sert à suivre :

- densification ;
- rénovation ;
- démolition/reconstruction ;
- changement d'usage ;
- pression immobilière ;
- transformation commerciale ou résidentielle.



## 5.6 Évolution temporelle des scores

Territo ne doit pas afficher uniquement une photo à un instant T.

Une zone peut être :

- forte aujourd'hui mais en baisse ;
- moyenne aujourd'hui mais en forte progression ;
- stable depuis longtemps ;
- émergente sur les 3 ou 6 derniers mois ;
- intéressante uniquement en tendance longue.

L'application doit donc afficher les scores par période :

```text
3 mois  : signal très récent
6 mois  : tendance courte
12 mois : période principale d'analyse
24 mois : tendance longue
```

Exemple :

```text
Zone : Rennes Nord
Métier : menuisier
Score actuel 12 mois : 82/100
Évolution 3 mois : +6 pts
Évolution 6 mois : +11 pts
Évolution 12 mois : +18 pts
Tendance : accélération

Lecture : zone prioritaire, car le score est élevé et continue de monter.
```

Cela permet de distinguer :

| Situation | Lecture produit |
|---|---|
| Score élevé + hausse forte | Zone prioritaire |
| Score élevé + stable | Zone mature, intéressante mais déjà installée |
| Score moyen + hausse forte | Zone émergente à surveiller |
| Score élevé + baisse | Zone peut-être moins prioritaire |
| Score faible + stable | Zone secondaire |

Cette dimension temporelle est utile pour tous les profils :

- artisans : savoir où la demande monte dans leur rayon ;
- agences : repérer les quartiers qui changent rapidement ;
- fournisseurs BTP : anticiper une hausse de demande ;
- collectivités : suivre les mutations urbaines ;
- investisseurs : détecter une dynamique avant qu'elle soit évidente.

## 6. Zoom artisan : score détaillé, pas note unique

Pour un artisan, une note globale seule n'est pas assez utile.

Il faut afficher :

```text
Score global : 82/100

Détail :
- Activité travaux : 76/100
- Besoin rénovation : 88/100
- Compatibilité métier : 91/100
- Dynamique DVF : 72/100
- Récence : 70/100
- Distance : 95/100
- Concurrence locale : 62/100
```

### Pourquoi le DPE est important

La proportion de logements classés E, F ou G au DPE permet d'ajouter une lecture “besoin rénovation”.

C'est particulièrement utile pour :

- isolation ;
- chauffage ;
- ventilation ;
- fenêtres ;
- toiture ;
- rénovation globale ;
- électricité dans certains cas.

Mais le DPE doit rester un signal agrégé par zone. Il ne doit pas servir à cibler nominativement un logement ou un propriétaire.



## 7. Scoring métier détaillé

Le produit doit éviter la “note magique”. Pour chaque métier ou catégorie, Territo doit afficher une note globale **et** le détail des critères qui la composent.

La logique devient :

```text
Score métier =
  besoin potentiel
+ signaux travaux
+ pouvoir d'achat local
+ récence des signaux
+ compatibilité du parc immobilier
+ concurrence locale
+ distance
```

Mais les pondérations changent selon le métier.

| Métier / catégorie | Critères les plus importants | Exemple de recommandation |
|---|---|---|
| Isolation / rénovation énergétique | DPE E/F/G, passoires F/G, maisons anciennes, concurrence RGE | “Mettre en avant isolation combles/murs et rénovation énergétique.” |
| Chauffage / pompe à chaleur | DPE E/F/G, maisons individuelles, ventes récentes, concurrence RGE | “Cibler les maisons anciennes vendues récemment.” |
| Menuiserie / fenêtres | DPE E/F/G, logements anciens, ventes récentes, extensions | “Promouvoir fenêtres, portes d'entrée et isolation des ouvertures.” |
| Couvreur / charpentier | maisons individuelles, bâti ancien, extensions, surélévations | “Cibler toiture, isolation toiture, surélévation et rénovation maison.” |
| Électricien | ventes récentes, logements anciens, créations/divisions de logements, locaux commerciaux | “Mettre en avant rénovation électrique et mise aux normes.” |
| Plombier / salle de bain | ventes récentes, logements anciens, extensions, grands logements | “Promouvoir rénovation salle de bain et plomberie post-achat.” |
| Peintre / solier / plaquiste | ventes récentes, volume DVF, logements anciens, projets d'extension | “Cibler les travaux intérieurs après mutation.” |
| Paysagiste / clôture / terrasse | maisons avec terrain, parcelles larges, ventes de maisons, prix DVF élevé | “Mettre en avant aménagement extérieur, clôture, terrasse.” |
| Pisciniste | grandes parcelles, maisons individuelles, pouvoir d'achat, climat/région | “Cibler les zones pavillonnaires à forte capacité d'achat.” |
| Solaire / photovoltaïque | maisons individuelles, potentiel toiture, DPE moyen/mauvais, concurrence RGE | “Prioriser les zones avec maisons et faible concurrence solaire.” |
| Maçon / gros œuvre | permis récents, extensions, constructions neuves, surface créée | “Surveiller les extensions et démolitions/reconstructions récentes.” |
| Architecte / maître d'œuvre | complexité des projets, changements de destination, DPE, DVF élevé | “Identifier les zones avec projets complexes et budget local.” |

Exemple pour un menuisier :

```text
Score global : 81/100

Détail :
- Besoin rénovation énergétique : 78/100
- Parc compatible : 85/100
- Ventes récentes DVF : 72/100
- Signaux travaux : 69/100
- Pouvoir d'achat local : 80/100
- Concurrence locale : 64/100
- Distance : 94/100

Recommandation :
Prioriser les communes A, B et C. Mettre en avant fenêtres, portes d'entrée et isolation des ouvertures.
```

Pour le MVP, il est préférable de ne pas couvrir tous les métiers dès le départ. Les 4 premiers métiers recommandés sont :

1. isolation / rénovation énergétique ;
2. menuiserie / fenêtres ;
3. couvreur / charpentier ;
4. peintre / rénovation intérieure.

Ces 4 métiers permettent de tester des signaux différents : DPE, permis, DVF, typologie du bâti et ventes récentes.

## 8. Exemple concret — Artisan

Un menuisier à Rennes ouvre Territo.

Il choisit :

- adresse de départ : son atelier ;
- métier : menuisier ;
- rayon : 20 km ;
- période : 12 derniers mois ;
- score : prospection locale.

Résultat :

```text
Périmètre analysé : 20 km autour de l'entreprise

Zone 1 — Rennes Nord
Distance : 6 km
Score local : 84/100
Tendance : +12 pts sur 6 mois, +19 pts sur 12 mois
Statut : zone en accélération

Détail du score :
- activité travaux : 76/100 ;
- besoin rénovation : 88/100 ;
- compatibilité métier : 91/100 ;
- dynamique DVF : 72/100 ;
- récence : 70/100 ;
- distance : 95/100 ;
- concurrence locale : 62/100.

Pourquoi :
- forte hausse des extensions de maisons ;
- beaucoup de projets de rénovation ;
- forte proportion de logements classés E, F ou G au DPE ;
- prix immobilier supérieur à la médiane locale ;
- volume de ventes récent élevé ;
- bonne compatibilité avec menuiserie extérieure et intérieure ;
- progression nette des signaux sur les 6 derniers mois.

Action recommandée :
- lancer une campagne locale ;
- contacter les agences immo du secteur ;
- créer une offre “extension, fenêtres et rénovation maison”.
```

## 9. Exemple concret — Agence immobilière

Une agence immobilière veut savoir où concentrer ses actions commerciales et comment argumenter son expertise locale.

Elle choisit :

- territoire : Métropole de Lyon ;
- période : 24 mois ;
- profil : agence immobilière ;
- niveau d'analyse : quartier ;
- type de bien : appartements et maisons.

Résultat :

```text
Zone 1 — Lyon 7e / Gerland
Score global agence : 86/100
Évolution : +14 pts sur 24 mois
Tendance : marché actif et quartier en transformation

Détail :
- Prospection vendeurs : 82/100
- Liquidité marché : 89/100
- Valorisation prix : 84/100
- Quartier en mutation : 91/100
- Opportunité acquéreur : 76/100
- Risque commercial : 32/100

Indicateurs :
- prix médian : 5 200 €/m²
- évolution prix 24 mois : +8 %
- volume de ventes : +11 %
- autorisations d'urbanisme : +18 %
- nombreux changements de destination et projets mixtes.

Lecture :
quartier actif, en transformation, avec un volume de transactions solide. Zone intéressante pour rentrer des mandats, produire une note de marché locale et cibler les propriétaires vendeurs.

Actions possibles :
- lancer une campagne d'estimation gratuite ;
- produire une note de marché sur Gerland ;
- cibler la prospection vendeurs ;
- préparer des arguments pour acquéreurs sur la transformation du quartier ;
- surveiller le risque de tension ou de surestimation si les prix accélèrent trop.
```

Le module agence peut aussi produire un contexte d'estimation :

```text
Bien analysé : appartement T3, 65 m²
Références DVF proches : 12 ventes comparables sur 24 mois
Prix médian observé : 4 850 €/m²
Fourchette : 4 300 à 5 400 €/m²
Tendance quartier : +6 % sur 24 mois
Score fiabilité estimation : 78/100

Limite : DVF ne donne pas l'état intérieur, l'étage, l'exposition, les travaux, l'extérieur ou la qualité des prestations.
```

## 10. Exemple concret — Fournisseur BTP

Un fournisseur de matériaux veut savoir où pousser ses actions commerciales.

Il choisit :

- territoire : Loire-Atlantique ;
- score : demande BTP ;
- catégorie : menuiserie / isolation ;
- période : 12 mois.

Résultat :

```text
Zone 1 — Nord de Nantes
Score demande BTP : 81/100
Évolution : +9 pts sur 6 mois
Tendance : demande en hausse

Pourquoi :
- nombreuses extensions de maisons ;
- surface créée importante ;
- part importante de DPE E/F/G ;
- prix DVF supérieur à la médiane départementale ;
- volume de projets compatible avec isolation et menuiserie.

Action possible :
- cibler les artisans de la zone ;
- organiser une opération commerciale locale ;
- adapter les stocks ou la communication régionale.
```

## 11. Clients cibles

### Cible 1 — Artisans et petites entreprises du bâtiment

Métiers concernés :

- couvreurs ;
- menuisiers ;
- électriciens ;
- plombiers ;
- peintres ;
- paysagistes ;
- terrassiers ;
- entreprises d'isolation ;
- entreprises de chauffage ;
- entreprises de rénovation.

Valeur :

- savoir où prospecter dans leur rayon habituel ;
- adapter leurs campagnes locales ;
- anticiper les périodes de demande ;
- repérer les quartiers actifs ;
- identifier les zones avec fort besoin de rénovation énergétique ;
- choisir où investir en publicité.

### Cible 2 — Courtiers en travaux et maîtres d'œuvre

Valeur :

- identifier les zones à fort potentiel ;
- structurer un réseau d'artisans ;
- cibler les quartiers où les projets se multiplient ;
- alimenter une stratégie commerciale locale.

### Cible 3 — Agences immobilières

Valeur :

- repérer les quartiers en transformation ;
- prioriser la prospection vendeurs ;
- identifier les zones avec forte liquidité de marché ;
- suivre les prix immobiliers par micro-zone ;
- comparer une zone à la commune et aux quartiers voisins ;
- produire des notes de marché locales ;
- préparer des contextes d'estimation avec comparables DVF ;
- mieux conseiller vendeurs et acheteurs ;
- identifier les zones avec potentiel de valorisation ;
- détecter les risques : baisse des volumes, stagnation des prix, DPE dégradé, marché irrégulier.

### Cible 4 — Investisseurs et marchands de biens

Valeur :

- suivre les zones en mutation ;
- détecter les quartiers actifs avant qu'ils soient évidents ;
- croiser prix, ventes, DPE et transformation urbaine ;
- prioriser les secteurs à étudier.

### Cible 5 — Fournisseurs BTP et franchises travaux

Valeur :

- savoir où la demande travaux augmente ;
- adapter les actions commerciales ;
- cibler les artisans par zone ;
- anticiper les besoins en matériaux ou équipements ;
- comparer plusieurs territoires.

### Cible 6 — Collectivités et bureaux d'études

Valeur :

- suivre la transformation urbaine ;
- objectiver les dynamiques de construction ;
- repérer les zones de densification ;
- produire des observatoires locaux.

## 12. Fonctionnalités principales

### Carte des zones actives

Visualisation des quartiers et communes avec forte activité :

- permis ;
- déclarations préalables ;
- extensions ;
- démolitions ;
- constructions ;
- rénovations ;
- changements de destination ;
- signaux DPE E/F/G.

### Choix du mode d'analyse

Deux modes principaux :

- local par rayon d'intervention ;
- benchmark territorial.

### Scoring par profil

Un même signal n'a pas la même valeur selon l'utilisateur.

Exemples :

- une extension intéresse un menuisier, un électricien, un plombier, un peintre ;
- une surélévation intéresse un couvreur et un charpentier ;
- une forte proportion de DPE E/F/G intéresse isolation, chauffage, ventilation, fenêtres et toiture ;
- une forte hausse DVF intéresse une agence ou un investisseur ;
- un volume important de surfaces créées intéresse un fournisseur BTP ;
- une concentration de démolitions/reconstructions intéresse une collectivité ou un urbaniste.

### Croisement avec DPE

Les DPE permettent d'ajouter une lecture “besoin rénovation” :

- proportion de logements classés E, F ou G ;
- proportion de passoires énergétiques F ou G ;
- typologie maison / appartement ;
- ancienneté des diagnostics ;
- signaux utiles pour isolation, chauffage, ventilation, fenêtres, toiture et rénovation globale.

Ce score doit rester agrégé par zone.

### Croisement avec DVF

DVF permet d'évaluer le contexte immobilier :

- prix médian au m² ;
- volume de ventes ;
- dynamique du marché ;
- niveau de budget probable du quartier ;
- typologie des biens.



### Module agences immobilières

Fonctionnalités spécifiques :

- classement des quartiers pour la prospection vendeurs ;
- score de liquidité du marché ;
- suivi du prix médian au m² ;
- évolution 12, 24 et 36 mois ;
- comparaison avec la commune et les zones voisines ;
- score de quartier en mutation ;
- score opportunité acquéreur ;
- score risque / frein commercial ;
- contexte d'estimation locale avec ventes comparables DVF ;
- génération de notes de marché locales.

Exemple d'usage :

```text
Objectif : rentrer des mandats
Résultat : top 10 des micro-zones avec volume de ventes élevé, prix en hausse et forte densité résidentielle.

Objectif : conseiller un acquéreur
Résultat : zones encore moins chères que les quartiers voisins mais avec signaux de transformation.

Objectif : préparer une estimation
Résultat : comparables DVF, fourchette de prix, tendance locale et score de fiabilité.
```

### Historique et évolution

Le produit doit permettre de voir l'évolution des zones dans le temps :

- courbe du score global ;
- courbe par sous-score ;
- comparaison 3, 6, 12 et 24 mois ;
- classement des zones qui montent le plus ;
- distinction entre zone forte, zone stable et zone émergente.

Exemple d'affichage :

```text
Score actuel : 82/100
Il y a 6 mois : 71/100
Il y a 12 mois : 64/100
Évolution : +18 pts
Tendance : accélération
```

Cette lecture est importante : une zone à 72/100 qui monte vite peut être plus intéressante qu'une zone à 85/100 qui baisse.

### Alertes

L'utilisateur peut recevoir :

- les zones qui montent ;
- les zones qui accélèrent ;
- les nouveaux signaux ;
- les types de projets dominants ;
- les recommandations commerciales ou territoriales.

### Export et rapport

Pour les utilisateurs pro :

- export CSV ;
- rapport PDF ;
- comparaison de zones ;
- historique des scores ;
- courbes d'évolution ;
- classement des zones en hausse ;
- accès API.

## 13. Ce que le produit n'est pas

Territo n'est pas :

- une base de données de particuliers à contacter ;
- une plateforme de vente de leads nominative ;
- un outil pour contourner la confidentialité ;
- une promesse de chantiers déjà disponibles ;
- un outil pour cibler nominativement un logement à partir d'un DPE.

Territo est :

- un outil de veille ;
- un outil de ciblage géographique ;
- un outil d'aide à la décision commerciale ;
- un radar de transformation locale ;
- une plateforme de scoring territorial multi-profils.

## 14. Business model

### Offre gratuite

Objectif : acquisition.

Fonctionnalités :

- accès limité à une ville ;
- carte simplifiée ;
- quelques zones visibles ;
- score global sans tout le détail.

### Offre Artisan — 19 à 29 €/mois

Fonctionnalités :

- une adresse de départ ;
- un rayon de prospection local ;
- scoring par métier ;
- sous-scores détaillés ;
- alertes hebdomadaires ;
- historique simple ;
- évolution 3/6/12 mois ;
- recommandations.

### Offre Pro — 49 à 149 €/mois

Pour : agences, courtiers, investisseurs locaux, petites structures multi-zones.

Fonctionnalités :

- plusieurs territoires ;
- benchmark de quartiers ou communes ;
- scores transformation immobilière et potentiel marché ;
- exports CSV ;
- rapports ;
- filtres par type de projet ;
- comparaison entre zones ;
- suivi de l'évolution par période.

### Offre Enterprise — sur devis

Pour :

- fournisseurs BTP ;
- réseaux d'artisans ;
- agences multi-sites ;
- collectivités ;
- promoteurs ;
- franchises ;
- bureaux d'études.

Fonctionnalités :

- accès API ;
- rapports personnalisés ;
- zones sur mesure ;
- intégration CRM ;
- scoring métier spécifique ;
- benchmark multi-territoires ;
- analyses temporelles et rapports d'évolution.

## 15. MVP recommandé — version resserrée

Le MVP ne doit pas essayer de prouver toute la plateforme. Il doit prouver une seule chose : **Territo aide un utilisateur à décider où agir localement mieux qu'avec son intuition seule**.

Le produit complet peut servir plusieurs profils, mais le MVP doit tester un segment prioritaire à la fois.

### Segment pilote recommandé

Deux segments peuvent être testés en parallèle via landing pages ou entretiens, mais le produit MVP doit en privilégier un seul :

1. **agences immobilières locales** : repérer les quartiers en mutation, produire une note de marché locale, prioriser la prospection vendeurs ;
2. **artisans rénovation / menuiserie / isolation** : repérer les zones où concentrer leur prospection dans un rayon réel d'intervention.

Recommandation stricte : ne pas construire dès le départ un produit complet pour artisans, agences, fournisseurs BTP, investisseurs et collectivités. Ces lectures doivent rester dans la vision long terme.

### Ville ou territoire pilote

Choisir une seule ville ou métropole :

- Nantes ;
- Rennes ;
- Bordeaux ;
- Lyon ;
- Toulouse ;
- Lille ;
- Montpellier.

Le territoire pilote doit avoir assez de données DVF, DPE et urbanisme pour éviter les scores trop fragiles.

### Version 1 — périmètre produit strict

Fonctionnalités à garder :

1. carte des zones actives ;
2. import autorisations d'urbanisme ;
3. croisement DVF ;
4. croisement DPE agrégé ;
5. zones classées ;
6. un score principal ;
7. 4 à 6 sous-scores visibles ;
8. tendance simple sur 12 mois ;
9. niveau de confiance ;
10. message d'explication ;
11. sauvegarde ou export CSV basique ;
12. formulaire de retour utilisateur sur la crédibilité de la recommandation.

Fonctionnalités à éviter au tout début :

- module complet multi-profils ;
- score fournisseur BTP ;
- score collectivité ;
- API externe ;
- rapports PDF avancés ;
- intégration CRM ;
- trop de métiers artisans ;
- historique complexe sur 24 ou 36 mois si les données ne sont pas encore propres.

### Objectif du MVP

Répondre à trois questions :

> Est-ce que l'utilisateur comprend pourquoi une zone ressort ?

> Est-ce que la recommandation lui semble crédible ?

> Est-ce qu'il est prêt à payer pour recevoir ce classement régulièrement ?

Le MVP ne doit pas seulement mesurer l'intérêt. Il doit mesurer l'action : sauvegarde, export, création d'alerte, usage en prospection ou en rendez-vous client.

### Objectif quantifié MVP

```text
10 utilisateurs pilotes
100 zones analysées
30 zones sauvegardées ou exportées
70 % des recommandations top 10 jugées crédibles
3 pilotes prêts à payer ou à prolonger
1 segment clairement plus intéressé que les autres
```

## 16. Métriques de succès du MVP

La métrique principale ne doit pas être le nombre d'inscrits ou le nombre de vues carte.

La North Star recommandée est :

> **Nombre de décisions territoriales qualifiées générées par semaine.**

Une décision territoriale qualifiée correspond à une action concrète :

- consulter le détail d'une zone ;
- comparer deux zones ;
- sauvegarder une zone ;
- exporter une zone ;
- créer une alerte ;
- générer une note de marché ;
- marquer une zone comme “à prospecter” ;
- ouvrir l'explication “pourquoi cette zone ressort”.

### Métriques produit à suivre

| Métrique | Définition | Objectif MVP |
|---|---|---:|
| Activation | % d'utilisateurs qui analysent au moins 3 zones dans leur première session | ≥ 40 % |
| Compréhension du score | % d'utilisateurs qui ouvrent le détail des sous-scores | ≥ 50 % |
| Crédibilité perçue | % de recommandations top 10 jugées crédibles par les utilisateurs | ≥ 70 % |
| Action intent | % d'utilisateurs qui sauvegardent, exportent ou marquent une zone | ≥ 25 % |
| Rétention J+7 | % d'utilisateurs qui reviennent dans les 7 jours | ≥ 25 % |
| Création d'alerte | % d'utilisateurs activés qui créent au moins une alerte | ≥ 15 % |
| Intention de payer | % de pilotes qui accepteraient de payer | À mesurer |
| Conversion pilote | nombre de pilotes qui paient ou prolongent | 2 à 3 sur 10 |

### Questions de feedback intégrées au produit

Après consultation d'une zone, l'interface peut demander :

```text
Cette recommandation vous semble-t-elle crédible ?
- Oui
- Non
- Je ne sais pas
```

Puis, si l'utilisateur répond non :

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
```

Puis :

```text
À quel prix ?
- 29 €/mois
- 49 €/mois
- 99 €/mois
- 199 €/mois
- plus
```

### Métriques par segment

Pour les artisans :

- zones sauvegardées ;
- recommandations consultées ;
- intention de prospecter une zone ;
- campagne locale lancée ;
- contact agence, courtier ou partenaire envisagé ;
- retour terrain après 30 jours.

Pour les agences immobilières :

- rapport ou note de marché généré ;
- zone utilisée pour prospection vendeurs ;
- zone utilisée pour argumentaire acquéreur ;
- comparables DVF consultés ;
- note de marché téléchargée ;
- usage en rendez-vous client.

### Métriques à éviter comme indicateur principal

Ces métriques peuvent être suivies, mais ne doivent pas piloter le MVP :

- nombre d'inscrits ;
- nombre de vues carte ;
- temps passé ;
- nombre de communes affichées ;
- nombre de scores calculés.

Elles peuvent augmenter sans prouver que le produit crée une décision utile ou une intention de paiement.

## 17. Règles qualité data et seuils minimums

Territo doit éviter de surpromettre. Une zone ne doit jamais recevoir un score fort si les données disponibles sont trop faibles.

Principe produit :

> **Pas de score fort sans volume minimum, fraîcheur suffisante et niveau de confiance affiché.**

### Règles dures recommandées

```text
Si dpe_count < seuil_minimum : ne pas afficher de score DPE fort.
Si sales_count < seuil_minimum : afficher “données DVF insuffisantes”.
Si permits_count trop faible : privilégier la tendance commune ou IRIS plutôt que micro-zone.
Si l'échantillon est faible : masquer la note globale ou l'afficher grisée.
Si 2 sources sur 3 sont faibles : ne pas afficher de score global plein.
```

### Seuils initiaux recommandés

Ces seuils doivent être configurables et ajustés après les premiers tests terrain.

| Source | Règle | Comportement produit |
|---|---|---|
| DPE | `dpe_count < 10` | données DPE insuffisantes, sous-score masqué |
| DPE | `10 <= dpe_count < 20` | sous-score DPE affiché avec prudence, pas de score fort |
| DPE | `dpe_count >= 20` | sous-score DPE exploitable si la zone est cohérente |
| DVF | `sales_count < 5` | références insuffisantes |
| DVF | `5 <= sales_count < 10` | score DVF grisé ou prudence affichée |
| DVF | `sales_count >= 10` | score DVF exploitable |
| Urbanisme | `permits_count < 5` | ne pas surinterpréter la tendance micro-zone |
| Global | 2 sources faibles sur 3 | note globale masquée ou grisée |
| Confiance | `confidence_score < 40` | score masqué |
| Confiance | `40 <= confidence_score < 70` | score grisé avec avertissement |
| Confiance | `confidence_score >= 70` | score affiché normalement |

### Score de confiance data

Chaque zone doit avoir un score de confiance indépendant du score d'opportunité.

```text
data_confidence_score =
  couverture_dvf
+ couverture_dpe
+ couverture_urbanisme
+ fraîcheur_données
+ volume_observations
+ cohérence_temporelle
```

Exemple d'affichage :

```text
Score opportunité : 82/100
Confiance donnée : 74/100
Statut : score exploitable
```

Ou :

```text
Score opportunité : masqué
Confiance donnée : 36/100
Statut : données insuffisantes
Raison : trop peu de ventes DVF et de DPE disponibles sur cette micro-zone.
```

### Message produit recommandé

À afficher dans l'interface :

> Territo ne prédit pas les chantiers. Il classe les zones selon des signaux publics agrégés, avec un niveau de confiance.

Cette phrase protège le positionnement, évite la surpromesse et rend le produit plus crédible.

## 18. Différenciation

Les plateformes de leads vendent souvent des contacts déjà très sollicités.

Territo prend un autre angle :

- pas de dépendance aux demandes entrantes ;
- pas de concurrence immédiate sur le même lead ;
- vision territoriale ;
- anticipation ;
- analyse issue de données publiques ;
- scores par profil ;
- sous-scores explicables ;
- lecture locale ou benchmark selon le besoin.

Territo aide à décider **où agir**, **où investir** et **où surveiller**.

## 19. Risques et réponses

### Risque : les permis arrivent trop tard

Réponse :

> Le produit ne vend pas le chantier individuel. Il détecte des dynamiques de zone et adapte la lecture selon le profil utilisateur.

### Risque : les DPE ne représentent pas tout le parc

Réponse :

> Le DPE est utilisé comme un signal de besoin rénovation, pondéré par un niveau de confiance et agrégé par zone. Il ne doit pas être présenté comme une photographie exhaustive de tous les logements.

### Risque : usage trop intrusif

Réponse :

> L'app privilégie les agrégats par zone et évite le ciblage nominatif.

### Risque : scoring trop opaque

Réponse :

> Le score global est accompagné de sous-scores détaillés, d'explications concrètes et d'une évolution dans le temps.

### Risque : produit trop large

Réponse :

> Le MVP doit tester un seul segment prioritaire dans le produit, même si deux segments peuvent être testés commercialement via entretiens ou landing pages.

### Risque : échantillons trop faibles

Réponse :

> Le produit applique des seuils minimums par source. Si les volumes DPE, DVF ou urbanisme sont trop faibles, le score est masqué, grisé ou remplacé par une lecture à une maille plus fiable comme la commune ou l'IRIS.

## 20. Pitch court

> Territo est une plateforme de veille territoriale pour les professionnels du bâtiment et de l'immobilier. Elle croise les autorisations d'urbanisme, DVF, DPE et le cadastre pour identifier les zones où les travaux, les ventes, la rénovation énergétique et la transformation immobilière augmentent, stagnent ou baissent. Selon le profil, l'utilisateur peut obtenir un score local dans son rayon d'intervention, un benchmark de quartiers, un score de potentiel immobilier ou un indicateur de demande BTP.

## 21. Pitch très court

> Territo transforme les données publiques d'urbanisme, d'immobilier et de performance énergétique en scores territoriaux actionnables pour les pros du bâtiment, de l'immobilier et du BTP.

## 22. Taglines possibles

- “Repérez les zones qui se transforment.”
- “Des données publiques aux décisions locales.”
- “Le radar territorial des pros du bâtiment et de l'immobilier.”
- “Où prospecter, où investir, où surveiller.”
- “Arrêtez de décider à l'intuition.”
- “La veille travaux, rénovation et immobilier, zone par zone.”

## 23. Conclusion

Territo ne doit pas être présenté comme une app qui trouve des chantiers déjà disponibles.

La bonne promesse est plus large et plus crédible :

> **Aider les professionnels à repérer les zones où les signaux de travaux, de ventes, de rénovation, de demande BTP et de transformation immobilière sont les plus forts — et surtout où ils progressent.**

Le scoring local 10, 20 ou 30 km est essentiel pour les artisans, mais il doit rester une couche parmi d'autres.

Le produit complet doit conserver plusieurs scores : prospection locale, transformation immobilière, potentiel marché, demande BTP et mutation urbaine.
