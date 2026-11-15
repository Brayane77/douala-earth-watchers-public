# Audit de préparation — prévisions et validation scientifique

- **Date de l’audit initial :** 2026-10-18
- **Complément Drive / backtest :** 2026-10-18 (inspection de l’archive MODIS et extraction contrôlée de `NewD.zip`; backtest quotidien T2M calculé hors ligne). Les horodatages Drive rapportés au 2026-11-14 et au 2026-11-15 sont postérieurs à la référence système et restent à vérifier.
- **Branche :** `arena/1d435fd2-douala-earth-watchers` · **HEAD de base :** `17f212dd0171056ad3d30d62ff5a2e399062603b` · **État audité :** modifications locales non commitées.
- **Périmètre :** inventaire des données, exécution du backtest historique J+1/J+2/J+3, API pré-calculée, alertes exploratoires et limites du forecast actuel.
- **Cahier des charges :** [`cahier-des-charges-previsions-scientifiques.md`](cahier-des-charges-previsions-scientifiques.md).

## Conclusion exécutive

- **Backtest historique exécuté :** la série POWER T2M quotidienne (4 018 jours continus, 2015-01-01 à 2025-12-31, LST) a été évaluée par origines glissantes sur le test terminal 2025. Les prédictions J+1/J+2/J+3 ont été comparées à la persistance et à la valeur saisonnière à cible−365 jours, sans accès aux observations futures à chaque origine.
- **Résultats reproductibles, uniquement pour le produit archivé :** Ridge candidat — J+1 `N=364`, MAE `0,495538 °C`, RMSE `0,614978 °C`; J+2 `N=363`, MAE `0,550505 °C`, RMSE `0,687736 °C`; J+3 `N=362`, MAE `0,568498 °C`, RMSE `0,697040 °C`. Sur ce test, les deux erreurs sont inférieures à celles des baselines pour les trois horizons; le candidat reste un comparateur expérimental et n’est pas présenté comme une prévision météo validée.
- **Pas de prévision actuelle publiable :** la dernière observation est le **2025-12-31**, 291 jours avant la référence du 2026-10-18; la date de récupération du CSV est absente et les validités calculées à partir du snapshot ne sont plus futures. L’API renvoie donc `insufficient_data` et une liste de forecasts vide.
- **Pas de vérité terrain indépendante :** les scores décrivent la prévisibilité du produit NASA POWER/MERRA‑2 archivé, à la grille native, pas l’exactitude sur une station de Douala, une mesure de quartier ou une prévision officielle. L’incertitude reste non quantifiée.
- **Alertes :** aucune source officielle n’est intégrée. La page permet uniquement de tester un seuil choisi par l’utilisateur sur la dernière observation archivée, avec sa date et son unité; le résultat est explicitement historique, non actuel et non officiel. Aucun risque d’inondation, de santé ou de chaleur n’est déduit.

### Scores du run versionné

Les nombres sont en °C; aucun MAPE ni intervalle d’incertitude n’est calculé. Les MAE/RMSE sont calculés sur les mêmes N dates valides à chaque horizon.

| Horizon | N | Dates valides | Ridge candidat MAE / RMSE | Persistance MAE / RMSE | Saisonnière MAE / RMSE |
|---|---:|---|---:|---:|---:|
| J+1 | 364 | 2025-01-02 — 2025-12-31 | 0,495538 / 0,614978 | 0,561593 / 0,708929 | 0,757363 / 0,978403 |
| J+2 | 363 | 2025-01-03 — 2025-12-31 | 0,550505 / 0,687736 | 0,683664 / 0,872431 | 0,756942 / 0,978585 |
| J+3 | 362 | 2025-01-04 — 2025-12-31 | 0,568498 / 0,697040 | 0,732155 / 0,904282 | 0,756685 / 0,978917 |

- **Run ID :** `ed4258102a7002f4186f`; `1 089` lignes origine/horizon.
- **Source SHA‑256 :** `988ac7b0ab0b177679880664822805825320b52cc179a03676fec30528a579c7`.
- **Code SHA‑256 :** `89136bb63bfdeea843b5db279d607d708595ccacc60bc3b90a66120d59e512d8`.
- **Configuration :** `Ridge(alpha=10, fit_intercept=True)`; retards 1, 2, 3, 7, 14, 30, 365 jours; moyennes passées 7 et 30 jours; cycle annuel sin/cos. Entraînement expansif à chaque origine, jusqu’à T(t) inclus, prédiction récursive jusqu’à J+3. Aucun split aléatoire.
- **Réexécution hors ligne :** `.venv/bin/python scripts/build_t2m_daily_backtest.py`. L’API vérifie les SHA-256 au démarrage et sert l’artefact sans réentraînement.

## 1. Inventaire et contrôles des données

### Séries quotidiennes disponibles

| Source locale | Produit / couverture constatée | Contrôles locaux et limites |
|---|---|---|
| `nasa-data/csv/POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv` | Export NASA POWER au point demandé **4,05°N, 9,70°E**, du 2015-01-01 au 2025-12-31. 4 018 jours continus. `T2M` en °C et `PRECTOTCORR` en mm/jour selon l’en-tête; l’en-tête indique le marqueur manquant `-999`. | Aucun jour manquant ni valeur `-999` détecté pour ces deux variables. La dernière valeur est datée du 2025-12-31. Le champ de temps est **LST = Local Solar Time**, pas « Land Surface Temperature ». La maille météorologique MERRA‑2 est d’environ 0,5° × 0,625° (ordre de grandeur 55–70 km) : le point de requête ne constitue pas une mesure de station ni une mesure de quartier. L’en-tête ne fournit ni `fetched_at`, ni version d’API, ni source amont par ligne. |
| `nasa-data/precipitation_Douala_GPM_raw.csv` | Export Giovanni **GPM IMERG Late Daily V07**, du 2015-01-01 au 2025-12-31; série agrégée sur la zone demandée 9,5–9,9°E / 3,9–4,2°N, avec boîte de données 9,55–9,85°E / 3,95–4,15°N. Variable exportée `mean_GPM_3IMERGDL_07_precipitation`. | 4 018 jours, sans cellule manquante ni sentinelle `-9999.9` détectée. C’est une **estimation satellitaire de taux moyen quotidien** (mm/jour), agrégée sur une zone, pas une mesure de pluviomètre. GPM signale une performance potentiellement plus faible en zone côtière; c’est particulièrement pertinent pour Douala. |

SHA‑256 des deux CSV bruts présents (empreintes du snapshot local, pas du produit NASA entier) :

- POWER quotidien : `988ac7b0ab0b177679880664822805825320b52cc179a03676fec30528a579c7`
- GPM quotidien : `da3d12aa7e92bb5b32f1638aa4965bc99a7ffaddcc31d7ff9558756e5476f099`

### Séries mensuelles actuellement chargées par l’API

Les six fichiers suivants contiennent chacun **132 mois consécutifs**, de 2015-01 à 2025-12, sans valeur manquante détectée. Ils restent six séries distinctes : ne pas les fusionner ni substituer silencieusement un produit à un autre.

| Identifiant API | Fichier | Produit et interprétation |
|---|---|---|
| `temperature` | `nasa-data/csv/temperature_Douala.csv` | MERRA‑2 T2M, moyenne mensuelle, convertie de K en °C; air à 2 m. |
| `temperature_power` | `nasa-data/csv/temperature_Douala_POWER_monthly.csv` | Moyenne mensuelle des valeurs quotidiennes POWER T2M en °C. |
| `precipitation` | `nasa-data/csv/precipitation_Douala.csv` | Série dérivée de `precipitation_Douala_GPM.csv` × nombre de jours du mois; approx. mm/mois, distincte d’une observation quotidienne de cumul. |
| `precipitation_rate` | `nasa-data/csv/precipitation_Douala_GPM.csv` | Moyenne mensuelle du taux quotidien GPM, en mm/jour; ce n’est pas un cumul mensuel. |
| `precipitation_merra2` | `nasa-data/csv/precipitation_Douala_MERRA2_monthly.csv` | MERRA‑2 M2TMNXFLX/PRECTOT : flux moyen converti en cumul mensuel, mm/mois. |
| `precipitation_power` | `nasa-data/csv/precipitation_Douala_POWER_monthly.csv` | Somme mensuelle de PRECTOTCORR quotidien, mm/jour → mm/mois; distincte de GPM et du PRECTOT archivé. |

### Fichiers MERRA‑2 archivés

Dans `nasa-data/Nasa/Nasa/`, trois NetCDF Giovanni v5.12.4 couvrent chacun 132 mois, 2015–2025; le contrôle du `_FillValue` n’a trouvé aucune valeur sentinelle :

- `g4.areaAvgTimeSeries.M2IMNXASM_5_12_4_T2M.20150101-20251231.9E_4N_9E_4N.nc` : T2M, air à 2 m, K, moyenne mensuelle.
- `g4.areaAvgTimeSeries.M2IMNXASM_5_12_4_T10M.20150101-20251231.9E_4N_9E_4N.nc` : T10M, air à 10 m, K, moyenne mensuelle.
- `g4.areaAvgTimeSeries.M2TMNXFLX_5_12_4_PRECTOT.20150101-20251231.9E_4N_9E_4N.nc` : PRECTOT, flux moyen en kg m⁻² s⁻¹. Le script séparé intègre le flux sur la durée exacte des mois. Pour cet export, les métadonnées limitent l’analyse à la cellule de grille 10°E, 4°N; ce point de grille ne correspond pas à un quartier.

### Archive Drive `NewD.zip` — extraite et inspectée, hors modèle

L’archive Drive ID `1bWKAoOgZ7szQ7cdQIvu2oFl4L2NKLWwr` (63 393 octets, SHA‑256 `1a65045e544af0b8d2d403b46763d529547e962f8d1bfc47c36643b77b112156`) a été extraite à `google_drive/NewD/NewD/`, emplacement ignoré par Git. Quatre fichiers NetCDF et le CSV U2M couvrent chacun 132 moyennes mensuelles de 2015-01 à 2025-12. Le titre des exports annonce la zone demandée 9,70–9,78°E / 4,05–4,14°N, mais leurs métadonnées indiquent que les données se limitent à la cellule MERRA‑2 10°E, 4°N; ce n’est donc pas une observation par quartier. Les dates de modification/traitement intégrées aux fichiers et rapportées au 2026-11-15 sont postérieures à la référence système du 2026-10-18; elles ne sont pas utilisées comme date vérifiée de récupération.

| Fichier / variable | Définition et contrôle du contenu | Empreinte SHA‑256 du fichier extrait |
|---|---|---|
| `M2TMNXSLV_5_12_4_T2M` (NetCDF) | T2M, température de l’air à 2 m, K; 132 valeurs finies, sans sentinelle, moyenne 299,496 K, min 297,721 K, max 301,446 K. Distinct du `M2IMNXASM` T2M versionné dans le dépôt; comparaison mensuelle appariée au NetCDF existant : MAE 0,052053 K, RMSE 0,064037 K, écart absolu maximal 0,240479 K, corrélation 0,998820. | `a4d5f1745ee246e48d68f546a5619573baa261210bc35f4ce1d077a21d9b2f59` |
| `M2TMNXFLX_5_12_4_TLML` (NetCDF) | Température de l’air de surface (`Surface air temperature`), K; ce n’est pas le T2M à 2 m. Comparaison appariée au T2M de cette même archive : MAE 0,153466 K, RMSE 0,172253 K, corrélation 0,993517; variables non substituables. | `09fdded18793ef0f89dcbaf98e7b2836738705ee96b46f53243cae11825d99d5` |
| `M2TMNXFLX_5_12_4_GHTSKIN` (NetCDF) | `Ground heating for skin temperature`, flux thermique en W m⁻² (min −1,445789; max 1,959651; moyenne 0,080820). Malgré le nom `GHTSKIN`, ce champ est un flux de chauffage du sol, pas une mesure de température de surface. | `9594776a5a8f9be34d401b8e211efb87e90fab6335197bbc5981295fede51739` |
| `M2TMNXSLV_5_12_4_U2M` (CSV) | Composante du vent vers l’est à 2 m, m s⁻¹; 132 dates, sans valeur manquante/sentinelle (min −0,085960; max 0,542630; moyenne 0,297283). | `4d7e1e2381a403ad02e23fc83f2a1c77ed6500b1d76f8e947cde6ae8ded4e8aa` |
| `M2TMNXSLV_5_12_4_V2M` (NetCDF) | Composante du vent vers le nord à 2 m, m s⁻¹; 132 valeurs, sans valeur manquante/sentinelle (min −0,047517; max 0,467659; moyenne 0,240256). Son calendrier mensuel correspond à celui du CSV U2M; aucune vitesse du vent résultante n’est ajoutée à l’archive. | `04ba8fa29d0c944defaf533de8210ce17b7ab661d5f87b33d1570fc58539792c` |

Ces produits mensuels ne sont pas ajoutés aux six séries du dashboard, ne sont pas convertis/interpolés en données quotidiennes et ne sont pas utilisés par le modèle J+1 à J+3. Les séries U2M et V2M ne sont pas fusionnées ni transformées en vitesse. L’archive ne fournit pas de données après 2025. Les six scripts CMR présents n’ont pas été exécutés.

Aucune humidité, aucun vent, aucun rayonnement ni aucun NDVI/EVI n’est fusionné avec les séries climatiques mensuelles. L’extraction AppEEARS `DV` est maintenant conservée sous `nasa-data/modis/DV/` et servie par une route d’observations séparée; elle ne devient ni une entrée du modèle T2M ni une série quotidienne. Les autres extractions Drive sont exclues lorsqu’elles sont mal géolocalisées ou sans résultats.

- **`DV` — export correctement géolocalisé** : [archive Drive `2ffb66b7-32f5-4861-b927-3be7c4ec0e35.zip`](https://drive.google.com/file/d/1dAQApz_nJjg5ram0Lt6DwQ2bB2GrZcJt/view?usp=drivesdk) (fichier Drive ID `1dAQApz_nJjg5ram0Lt6DwQ2bB2GrZcJt`, tâche AppEEARS `2ffb66b7-32f5-4861-b927-3be7c4ec0e35`; CSV, requête JSON et métadonnées XML versionnés sous `nasa-data/modis/DV/`). La métadonnée Drive rapporte une modification au 2026-11-14T10:32:30.738Z, date future par rapport à la référence d’audit du 2026-10-18; la date `readme_completed_at` rapportée, 2026-11-14T09:59:51.834149, est elle aussi future. Ces horodatages bruts sont à vérifier et ne valent ni date de récupération ni preuve d’achèvement ou de publication. Le ZIP fait 22 134 octets, SHA‑256 `52cc2d5ebc5d76897d3f1c9cef43afdbc019a6b12e1b96042eb4f2ff6b7e67e6`; l’heure réelle de téléchargement local n’est pas enregistrée. La requête et les lignes CSV indiquent le point 4,05°N, 9,70°E, MOD13Q1.061 (NDVI, EVI et couches QA), avec une fenêtre demandée du 2015-01-01 au 2025-12-31. Le CSV contient 254 dates composites uniques du 2014-12-19 au 2025-12-19, dont 253 dans la fenêtre demandée et une composite précédente retournée par l’extraction inclusive AppEEARS. Le résumé QA indique 230/254 rang 3 « cloudy » (90,6 %), 15/254 rang 0 « good » (5,9 %) et 9/254 rang 1 « marginal » (3,5 %). Pour 253/254 dates, le masque terre/eau est « Ocean coastlines and lake shorelines », à signaler comme limite de représentativité du pixel côtier. Le JSON conserve le statut `processing`, alors que le README annonce une date d’achèvement et que l’archive comprend un CSV de résultats : vérifier l’état de la tâche sur AppEEARS avant toute réutilisation. MOD13Q1.061 est un composite de 16 jours à 250 m, pas une mesure quotidienne; le NDVI/EVI de cette archive reste hors du modèle T2M et ne doit pas être interpolé en série quotidienne. [Documentation du produit MOD13Q1.061](https://lpdaac.usgs.gov/products/mod13q1v061/) · [Guide utilisateur MODIS VI Collection 6.1](https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf).
- **Exports à exclure pour géolocalisation incorrecte ou absence de résultats** : [`8b7c7e9d-20c6-4516-b205-6e5e05e1d24d.zip`](https://drive.google.com/file/d/1yhsYwMbSZ-FnQCuGOdKBxV2XyJ9Fn_Oq/view?usp=drivesdk) et [`Douala_NDVI`](https://drive.google.com/file/d/1vUXa_BM_dFwKm5UcOPqAiTZnvKBqqBuq/view?usp=drivesdk) indiquent tous deux 9,78°N, 4,14°E, pas Douala; [`DOUALAV.zip`](https://drive.google.com/file/d/1bFLujemt90dmjT6_OBJyzNcRKgIfQk5Z/view?usp=drivesdk) contient une requête lat. 9°, long. 70°, statut `processing`, sans CSV ni GeoTIFF de résultats. Ne pas les confondre avec l’export `DV` correctement géolocalisé.

Les recherches Drive `name contains 'cahier'`, `fullText contains 'cahier'` et `name contains 'prévision'` n’ont pas identifié de cahier des charges cloud distinct. La recherche de contenu « prevision » a notamment retrouvé [`Dashboard-Reproduction-source.zip`](https://drive.google.com/file/d/1NuzGfGbwumRHQb6hb2EQrZNtWYfq1fJA/view?usp=drivesdk); son README le décrit comme une archive de code frontend dont les KPI et la série temporelle sont des données de démonstration générées côté client, sans connexion à l’API FastAPI. Ce ZIP n’est ni une spécification ni une source de mesures réelles, et n’a pas été fusionné dans le dépôt.

Un nom de fichier contenant `_LST` dans l’export POWER désigne ici l’heure solaire locale, **pas** une température de surface MODIS.

## 2. Documentation officielle consultée et conséquences

- **NASA POWER Daily API :** fournit des séries quotidiennes et prend en charge notamment CSV, JSON et NetCDF. T2M quotidien est une moyenne issue des valeurs horaires; le service propose UTC et LST et utilise LST par défaut. La LST est définie par bandes de 15° et peut différer de l’heure civile légale. Le fichier existant est en LST; son étiquette de date ne doit pas être convertie ou renommée silencieusement en heure `Africa/Douala`. Pour le prochain pipeline, choisir explicitement UTC ou LST, conserver ce choix dans les métadonnées et comparer les frontières de journée avant tout changement de série. [Documentation API quotidienne](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) · [FAQ sur les standards horaires](https://power.larc.nasa.gov/docs/faqs/other/) · [Traitement temporel POWER](https://power.larc.nasa.gov/docs/methodology/data/processing/)
- **NASA POWER, sources météorologiques :** la FAQ officielle identifie MERRA‑2 et GEOS‑IT comme sources météorologiques, indique que les données restent à la résolution native des produits et donne une latence d’archive de 2–3 jours pour les paramètres météorologiques. Le fichier local étiquette ses paramètres MERRA‑2, mais ne fournit ni date de récupération, ni version d’API/émission, ni provenance amont par date; on ne peut donc pas reconstruire l’état « tel que publié » pour chaque date à partir de ce seul CSV. Il s’agit de données d’assimilation/réanalyse et d’une extension à faible latence, pas d’une prévision météo. [FAQ POWER : données, sources, résolution et latence](https://power.larc.nasa.gov/docs/faqs/data/)
- **MERRA‑2 mensuel :** la documentation GES DISC classe M2IMNXASM comme diagnostics mensuels sur grille 0,625° × 0,5°; T2M est une température de l’air, en K. M2TMNXFLX est un produit mensuel de flux de surface, PRECTOT en kg m⁻² s⁻¹, avec une latence annoncée d’environ trois semaines après la fin du mois. Ces unités justifient de garder les conversions archivées distinctes et tracées. [M2IMNXASM](https://www.earthdata.nasa.gov/data/catalog/ges-disc-m2imnxasm-5.12.4) · [M2TMNXFLX](https://www.earthdata.nasa.gov/data/catalog/ges-disc-m2tmnxflx-5.12.4)
- **GPM IMERG Late Daily V07 :** produit quotidien à 0,1° (environ 10 km), valeur `precipitation` en mm/jour représentant un taux moyen journalier, disponible après réception des granules du jour UTC (latence cible d’environ 14 h). Il s’agit d’une estimation satellitaire, avec une réserve de performance côtière; ce n’est ni une pluie de station, ni une prévision de pluie ou d’inondation. [Catalogue GES DISC IMERG](https://www.earthdata.nasa.gov/data/catalog/ges-disc-gpm-3imergdl-07)

**Point ouvert sur l’heure :** la documentation clarifie la définition générale du LST, mais aucun test côte à côte UTC/LST aux dates de bord n’a été fait dans cet audit. Conserver l’étiquette LST actuelle et fixer explicitement la norme avant l’évaluation; ne pas supposer une équivalence civile sans contrôle de la réponse source.

## 3. Code existant et lacunes pour la prévision

| Fichier / groupe | Rôle actuel | Limites restantes |
|---|---|---|
| `backend/nasa_data.py` | Catalogue statique et chargement/contrôle des six CSV mensuels; expose unités, périodes, nombres de lignes et provenance déclarée. | Ne fournit pas de date de récupération/version d’émission pour l’archive POWER quotidienne. |
| `backend/api/main.py` | FastAPI pour catalogue, séries mensuelles, archive MODIS distincte, backtest, statut du forecast, seuils exploratoires et exports CSV/JSON. | Le forecast actuel renvoie volontairement `insufficient_data` et aucune valeur future; aucun flux d’alertes officiel n’est connecté. |
| `backend/daily_forecast.py` | Valide l’archive POWER quotidienne, construit les caractéristiques sans fuite à chaque origine, produit le backtest chronologique, vérifie les empreintes et sérialise les seuils/exports. | Les scores évaluent seulement la version archivée du produit; l’historique des révisions NASA et les mesures de station locale ne sont pas disponibles. |
| `scripts/build_t2m_daily_backtest.py` | Commande hors ligne explicite qui génère l’artefact JSON versionné; elle n’est pas exécutée par les routes/pages. | Une régénération est nécessaire si la source ou le code de backtest change; l’API refuse un artefact dont les empreintes ne concordent pas. |
| `backend/climate_ml.py` | Outil mensuel indépendant sur CSV téléversé : candidats forêt aléatoire/Ridge, origines glissantes, validation sans fuite comparée aux baselines et scénario récursif traçable. | Le calcul démarre uniquement sur POST; les résultats n’ont pas de validation station et ne sont ni un forecast actuel de Douala, ni un avis officiel, ni une entrée du backtest quotidien. |
| `scripts/convert_nasa_power_daily.py` | Vérifie le CSV POWER quotidien et régénère les deux séries mensuelles POWER distinctes. | Ce pipeline ne récupère pas de nouvelles réponses NASA et ne versionne pas les millésimes quotidiens. |
| `scripts/convert_merra2_precipitation.py`, `scripts/README.md`, `scripts/README_GPM.md` | Convertisseurs et notes d’unités/provenance pour MERRA‑2, POWER et GPM. | Ne sont pas un pipeline de forecast quotidien. |
| `frontend/src/routes/index.tsx`, `components/ChartPanel.tsx`, `components/MetricCard.tsx`, `components/MapPanel.tsx`, `components/VegetationPanel.tsx`, `lib/api.ts`, `styles.css` | Tableau de bord mensuel, carte indicative et produit MODIS `DV` autonome. | Aucun produit n’est extrapolé aux quartiers; les composites `DV` gardent leurs dates/QA natives et sont exclus du forecast T2M. |
| `frontend/src/routes/previsions.tsx`, `frontend/src/components/MonthlyMlLab.tsx`, `frontend/src/routes/validation-scientifique.tsx` | Page `/previsions` avec upload ML mensuel explicite, scores/baselines/exports et statut de forecast/seuil; page dédiée au backtest T2M quotidien. | L’expérience mensuelle, le backtest historique et le statut du forecast actuel restent séparés; aucune alerte officielle n’est émise. |
| `frontend/src/routes/sources.tsx` | Page `/sources`: catalogue, contrôles structurels, provenance et archive MODIS séparée. | Les contrôles structurels ne sont pas une validation indépendante des observations. |
| `backend/tests/test_daily_forecast.py`, `backend/tests/test_climate_ml.py` | Quinze tests backend couvrant source quotidienne, métriques/N, statut officiel, upload ML réel, protocoles chronologiques, baselines, horizons, modèles et empreintes. | Aucun test ne peut établir la validité météorologique indépendante sans données de station adaptées. |
| Tests frontend (`climate.test.ts`, `interactive-map.test.ts`, `ThemeToggle.test.tsx`, `MonthlyMlLab.test.tsx`) | Quatorze tests frontend couvrant transformations climatiques, géométrie indicative, thème et soumission explicite d’un CSV réel. | Pas de navigateur E2E dédié dans ce dépôt. |

## 4. Protocole appliqué et limites opérationnelles restantes

1. **Cible historique réalisée :** T2M quotidien en °C, produit NASA POWER/MERRA‑2 au point de requête 4,05°N, 9,70°E et à la résolution native de la grille; le résultat n’est pas une température de station ou de quartier. Les horizons sont J+1 à J+3. PRECTOTCORR reste exclu de l’évaluation et aucun forecast de pluie/inondation n’est calculé.
2. **Validation chronologique réalisée :** test terminal 2025 à origines glissantes, entraînement expansif à partir des observations connues jusqu’à chaque origine, prédictions récursives à J+1/J+2/J+3, sans observation future ni split aléatoire. Les mêmes dates valides sont comparées au candidat Ridge, à la persistance et à la valeur observée à la date cible moins 365 jours. MAE, RMSE, N, périodes, configuration et empreintes figurent dans l’artefact versionné et dans le tableau des scores plus haut.
3. **Résultats interprétés prudemment :** le candidat Ridge bat les deux baselines en MAE et RMSE sur ce test du produit archivé; il reste expérimental et n’est pas promu en forecast opérationnel. Le rejeu utilise l’archive actuellement présente, pas des millésimes historiques « tels que publiés » à chaque origine. La comparaison par dates est temporelle, mais ne constitue pas une évaluation indépendante de la météo observée en station.
4. **Forecast actuel distingué du backtest :** l’archive se termine le 2025-12-31, ne fournit pas `retrieved_at`, et les validités de l’année test ne sont plus des prochains jours. L’API `/api/forecasts/t2m-daily` répond avec `insufficient_data`, un `forecast` vide, la date source et des motifs explicites. Une source quotidienne fraîche et archivée, son URL/paramètres/version/standard temporel, `fetched_at` UTC et son SHA‑256 sont nécessaires avant d’afficher une valeur actuelle.
5. **Alertes distinguées des indicateurs :** aucun flux officiel n’est raccordé. `/api/alerts/exploratory` compare uniquement le seuil fourni par l’utilisateur avec l’observation archivée du 2025-12-31; aucun seuil normatif par défaut, notification ou risque de pluie/inondation n’est créé.
6. **Limites spatiales et d’incertitude :** aucun intervalle artificiel n’est tracé, aucune validation par station n’est disponible et aucune valeur par quartier, carte de chaleur ou interpolation spatiale n’est produite. L’archive MODIS `DV` reste indépendante; `NewD.zip` et ses séries mensuelles MERRA‑2 inspectées ne sont pas fusionnés au dashboard ou au modèle quotidien.
7. **Calcul et exports :** le backtest est généré avec la commande locale explicite `scripts/build_t2m_daily_backtest.py`; les pages lisent l’artefact pré-calculé. La page, l’API JSON et les exports CSV/JSON s’appuient sur le même run, les mêmes 1 089 lignes et les mêmes empreintes. Aucun apprentissage n’est lancé à l’ouverture d’une route.

### Décision de passage

La validation historique demandée est calculée et documentée; elle peut être consultée comme **backtest expérimental du produit NASA POWER archivé**, pas comme prévision météo mesurée ou validée pour Douala. Le développement ne rend pas possible un forecast actuel tant que le dépôt ne contient pas de nouvelles observations fraîches et traçables. Une station indépendante locale et une source d’alertes officielle restent nécessaires pour revendiquer respectivement l’exactitude météorologique locale et la diffusion d’avis institutionnels.
