# Douala Earth Watchers

Tableau de bord React/TanStack et FastAPI pour explorer des séries mensuelles de température de l’air et de précipitations associées à Douala. Le mode démonstration lit les CSV versionnés dans `nasa-data/csv/`; il ne lance pas de nouvelle requête vers NASA et n’utilise aucune série de remplacement.

> **Portée scientifique et spatiale :** les produits disponibles sont des réanalyses ou des exports agrégés/ponctuels. Leurs grilles sont plus larges que les quartiers. Le fond OpenStreetMap ne contient pas de mesure et le tableau de bord n’interroge pas de valeur au clic.

## Démonstrateur

- Le menu « Série / produit » propose six séries climatiques distinctes (deux produits T2M et quatre produits de précipitations) ainsi que l’archive de végétation MODIS `DV`, présentée séparément. Les sources GPM, MERRA‑2 PRECTOT et NASA POWER PRECTOTCORR restent distinctes.
- Pour les produits climatiques, jusqu’à quatre indicateurs décrivent les mois présents; les mois absents ne sont pas convertis en zéro. En sélection MODIS, ces indicateurs mensuels sont masqués.
- Le graphique historique climatique suit la zone et la période sélectionnées. Pour `DV`, l’interface affiche le nuage de points NDVI/EVI sur les seules dates de composites fournies.
- Export CSV local des seules lignes affichées, avec date, zone, indicateur, variable, valeur, unité et source.
- Carte temporelle Plotly sur fond OpenStreetMap, avec glissière et lecture/pause des mois; un seul point de référence, sans raster, interpolation ni valeur par quartier.
- Section Végétation MODIS dédiée à l’archive `DV`: nuage de points NDVI/EVI aux dates de composites réelles de 16 jours, avec QA et masque côtier visibles; séparée des séries climatiques.
- Mode clair/sombre avec **fond blanc en permanence par défaut** : le choix explicite est mémorisé dans le navigateur et appliqué avant le premier rendu; le mode clair ne dépend pas du réglage système.
- Page `/sources` avec catalogue, périodes, unités, résolutions, notes de provenance, contrôles de cohérence et panneau de traçabilité MODIS `DV`.
- Page `/validation-scientifique` avec le backtest T2M quotidien pré-calculé sur 2025, séparé par horizons J+1 à J+3 et comparé à la persistance et à une baseline saisonnière; exports CSV/JSON issus du même artefact.
- Page `/previsions` avec un laboratoire ML mensuel : dépôt manuel d’un CSV et confirmation utilisateur qu’il contient des observations réelles, choix des colonnes/date/variable, format numérique, horizon de 1 à 24 mois, candidats forêt aléatoire/Ridge, validation chronologique comparée à la persistance et à la baseline saisonnière, scores MAE/RMSE/N par horizon, dates/valeurs projetées et exports JSON/CSV. Ce scénario reste expérimental et distinct du forecast actuel.
- La même page indique « données insuffisantes » pour le forecast quotidien actuel, l’absence explicite de flux officiel d’alertes et un outil facultatif de seuil exploratoire défini par l’utilisateur sur la dernière observation archivée.
- Aucun calcul d’entraînement n’est exécuté au chargement d’une page; le modèle mensuel ne s’entraîne qu’après soumission explicite du formulaire. Le rapport scientifique quotidien reste pré-calculé et ses empreintes source/code sont vérifiées par l’API.
- Si l’API ou les CSV sont indisponibles, une erreur est affichée; aucune donnée fictive ne prend le relais.

L’archive MODIS `DV` est présentée séparément (NDVI/EVI, QA, composites de 16 jours); elle n’est pas ajoutée aux six séries climatiques, convertie en quotidienne ni utilisée comme prédicteur. Son point côtier et la forte proportion de composites classés nuageux limitent sa représentativité; cette série exploratoire n’est pas une validation de la végétation à l’échelle de toute la ville. Le backtest historique de T2M évalue uniquement la prévisibilité du produit NASA POWER/MERRA‑2, pas une vérité terrain de station. Le snapshot finit au 2025-12-31 et ne contient pas de date de récupération : aucune prévision actuelle n’est donc affichée. Aucune source d’alerte officielle n’est connectée; les seuils personnels restent des indicateurs historiques non officiels. T2M désigne la température de l’air à 2 m, jamais la température de surface.

### Résumé des scores du backtest T2M pré-calculé

Test chronologique terminal de 2025; MAE / RMSE en °C, calculés sur les mêmes dates valides par horizon. Les chiffres sont arrondis à six décimales depuis l’artefact, sans MAPE ni intervalle d’incertitude simulé.

| Horizon | N | Dates valides | Ridge expérimental MAE / RMSE | Persistance MAE / RMSE | Saisonnière MAE / RMSE |
|---|---:|---|---:|---:|---:|
| J+1 | 364 | 2025-01-02 — 2025-12-31 | 0,495538 / 0,614978 | 0,561593 / 0,708929 | 0,757363 / 0,978403 |
| J+2 | 363 | 2025-01-03 — 2025-12-31 | 0,550505 / 0,687736 | 0,683664 / 0,872431 | 0,756942 / 0,978585 |
| J+3 | 362 | 2025-01-04 — 2025-12-31 | 0,568498 / 0,697040 | 0,732155 / 0,904282 | 0,756685 / 0,978917 |

Rapport complet, configuration, empreintes et prédictions historiques : `nasa-data/forecast/t2m_daily_backtest.json` (run `ed4258102a7002f4186f`). Les scores décrivent seulement le produit archivé et ne valident pas une station de Douala.

## Séries locales

Les six entrées disponibles couvrent `2015-01` à `2025-12` (132 mois chacune, un seul secteur agrégé « Douala » dans les CSV contrôlés).

| Identifiant API | Fichier | Produit / variable | Unité et agrégation | Résolution / limite |
|---|---|---|---|---|
| `temperature` | `temperature_Douala.csv` | NASA MERRA‑2 T2M, température de l’air à 2 m | °C, moyenne mensuelle après conversion K → °C | Grille MERRA‑2 d’environ 0,5° × 0,625°; réanalyse, pas mesure de station. |
| `temperature_power` | `temperature_Douala_POWER_monthly.csv` | NASA POWER · MERRA‑2 T2M | °C, moyenne mensuelle de valeurs quotidiennes | Point de requête 4,05°N, 9,70°E; la grille sous-jacente ne distingue pas les quartiers. |
| `precipitation` | `precipitation_Douala.csv` | NASA GPM IMERG, cumul mensuel dérivé d’un taux journalier | mm/mois | Grille nominale d’environ 0,1°; agrégat du secteur fourni. |
| `precipitation_rate` | `precipitation_Douala_GPM.csv` | NASA GPM IMERG, taux moyen journalier | mm/jour, moyenne des taux par mois | À distinguer d’un cumul mensuel; agrégat du secteur fourni. |
| `precipitation_merra2` | `precipitation_Douala_MERRA2_monthly.csv` | NASA MERRA‑2 M2TMNXFLX v5.12.4 · PRECTOT | mm/mois, flux moyen × durée exacte de chaque mois | Grille 0,5° × 0,625°; export associé à la cellule 10°E, 4°N. |
| `precipitation_power` | `precipitation_Douala_POWER_monthly.csv` | NASA POWER · MERRA‑2 PRECTOTCORR | mm/mois, somme des taux quotidiens | Point de requête 4,05°N, 9,70°E; distinct de PRECTOT et de GPM. |

Le menu propose aussi « Végétation observée · MODIS DV », chargé par `/api/observations/modis-vegetation` plutôt que par le catalogue mensuel. Cette série NDVI/EVI conserve ses composites de 16 jours et ses QA; elle ne reçoit pas les filtres mensuels ni les indicateurs climatiques. Les fichiers POWER, GPM et MODIS restent distincts. Les coordonnées du tableau ne doivent pas être interprétées comme une mesure par rue ou par quartier.

L’archive Drive [`NewD.zip`](https://drive.google.com/file/d/1bWKAoOgZ7szQ7cdQIvu2oFl4L2NKLWwr/view?usp=drivesdk) a été extraite dans le dossier local ignoré `google_drive/NewD/` pour inspection. Elle contient des produits MERRA‑2 **mensuels** 2015–2025 (T2M, TLML, GHTSKIN, U2M et V2M), pas un flux quotidien récent. Ces produits restent distincts des six séries du tableau de bord et ne sont ni fusionnés ni interpolés pour le modèle J+1 à J+3. La grille limite les exports à 10°E, 4°N; aucune date de récupération n’est vérifiée.

## Architecture et API

```text
frontend/src/routes/index.tsx                 Tableau de bord et filtres partagés
frontend/src/routes/sources.tsx               Catalogue, contrôles et limites
frontend/src/routes/previsions.tsx             Statuts distincts, laboratoire ML mensuel et seuil exploratoire
frontend/src/components/MonthlyMlLab.tsx         Dépôt CSV, validation, projection et exports ML
frontend/src/routes/validation-scientifique.tsx Backtest quotidien, métriques et exports
frontend/src/components/MapPanel.tsx           Carte Plotly sur fond OpenStreetMap, sans interrogation
frontend/src/lib/climate.ts                     Statistiques mensuelles, filtres et export CSV
backend/api/main.py                             API FastAPI, résultats, upload ML et alertes exploratoires
backend/climate_ml.py                           Validation chronologique et forecast mensuel utilisateur
backend/nasa_data.py                            Catalogue et validation des CSV mensuels
backend/daily_forecast.py                       Lecture source et backtest hors ligne
scripts/build_t2m_daily_backtest.py             Génération explicite de l’artefact de validation
nasa-data/forecast/                             Backtest JSON pré-calculé et versionné
nasa-data/csv/                                  Séries versionnées utilisées en démonstration
```

Le frontend appelle `GET /api/dashboard-data` via le proxy Vite `/api` → FastAPI `:8000`. Le backend vérifie les colonnes requises, les dates, les valeurs finies, les secteurs non vides et l’unicité mois/secteur; il ne complète pas les lacunes.

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | État de l’API et identifiants des jeux chargés. |
| `GET` | `/api/sectors` | Secteurs réellement présents dans les séries. |
| `GET` | `/api/data/catalog` | Métadonnées, périodes et nombre de lignes du catalogue. |
| `GET` | `/api/dashboard-data` | Catalogue et séries utilisées par le tableau de bord. |
| `GET` | `/api/data/{kind}?sector=&start=&end=` | Série optionnelle filtrée par secteur et mois. |
| `GET` | `/api/demo/{kind}?sector=&start=&end=` | Alias historique déprécié de la route précédente. |
| `GET` | `/api/observations/modis-vegetation` | Archive MODIS `DV` NDVI/EVI avec provenance et QA; fréquence native de 16 jours. |
| `GET` | `/api/forecasts/t2m-daily` | État du forecast actuel; renvoie « données insuffisantes » et aucune valeur future pour le snapshot historique. |
| `GET` | `/api/validation/t2m-daily` | Backtest quotidien T2M pré-calculé, manifeste, scores et lignes historiques par horizon. |
| `GET` | `/api/validation/t2m-daily/export.csv` · `.json` | Exports du même artefact que la page de validation. |
| `GET` | `/api/alerts/status` | Disponibilité des sources d’alertes officielles et de l’observation archivée. |
| `POST` | `/api/alerts/exploratory` | Compare un seuil choisi par l’utilisateur à la dernière observation POWER archivée; résultat historique non officiel. |
| `POST` | `/api/ml/evaluate` | Évaluation explicite d’un CSV (max. 5 Mio), validation chronologique par horizon, comparateurs persistance/saisonnière et scénario mensuel; configuration et empreintes dans la réponse. Pas de persistance ni de forecast officiel. |

## Documents de référence

- [Inventaire des fonctionnalités actuelles (état existant)](docs/fonctionnalites-actuelles-plateforme.md)
- [Cahier des charges — prévisions quotidiennes et validation scientifique](docs/cahier-des-charges-previsions-scientifiques.md)
- [Audit de préparation des prévisions](docs/audit-readiness-previsions-scientifiques.md)
- [Guide d’évaluation ML sur une série mensuelle](docs/guide-previsions-ml-mensuelles.md)

## Lancement local

Prérequis : Python 3.10+ et Node.js compatible avec Vite 8.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cd frontend && npm ci
```

Dans deux terminaux depuis la racine du dépôt :

```bash
.venv/bin/uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
cd frontend && npm run dev -- --host 0.0.0.0 --port 5173
```

Ouvrir `http://localhost:5173`. Le frontend ne s’appuie que sur l’API locale pour les données; la carte de fond OpenStreetMap reste un contenu externe.

## Vérifications

```bash
cd frontend && npm run typecheck
cd frontend && npm test
cd frontend && npm run build
.venv/bin/python -m compileall -q backend scripts
.venv/bin/python -m unittest discover -s backend/tests -v
```

Regénérer le backtest (commande explicite hors des routes de l’application) :

```bash
.venv/bin/python scripts/build_t2m_daily_backtest.py
```

## Limites connues

- Pas de couche raster, de polygone administratif ou de coordonnées d’observation par quartier : pas de carte de chaleur, de valeur au clic ou d’analyse intra-urbaine.
- L’archive MODIS `DV` fournit un NDVI/EVI ponctuel exploratoire près de Douala, mais son QA majoritairement nuageux et son masque côtier ne valident pas une série représentative de toute la ville; aucune température de surface (LST) exploitable.
- Le laboratoire ML mensuel n’analyse que le CSV choisi par l’utilisateur : sa provenance n’est pas vérifiée indépendamment, ses résultats ne s’appliquent pas automatiquement à Douala et le scénario n’est pas un forecast actuel. Les candidats et leurs scores sont exploratoires, sans validation par station ni incertitude quantifiée.
- Les indicateurs mensuels ne sont ni des mesures de station, ni des alertes officielles, ni des prévisions. Le backtest quotidien n’évalue que NASA POWER/MERRA‑2; le candidat reste un comparateur expérimental sans validation indépendante par station.
- Les seuils exploratoires sont configurés explicitement par l’utilisateur et ne portent que sur la dernière observation archivée (2025-12-31); aucun seuil normatif par défaut n’est fourni.
- Les séries sont sélectionnables séparément et ne doivent pas être fusionnées sans vérifier leur définition, leur période, leur unité et leur résolution.
