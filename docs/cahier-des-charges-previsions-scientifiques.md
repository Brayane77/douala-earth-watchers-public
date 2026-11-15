# Cahier des charges — prévisions quotidiennes et validation scientifique

- **Version :** 1.1 — périmètre MVP inchangé; inventaire Drive complété le 2026-10-18. Les horodatages Drive/README rapportés au 2026-11-14 sont postérieurs à cette référence et restent à vérifier.
- **État :** MVP de prévision T2M, backtest et performances non réalisés; archive MODIS `DV` intégrée séparément comme observation exploratoire avec QA.
- **Inventaire de l’existant :** [`fonctionnalites-actuelles-plateforme.md`](fonctionnalites-actuelles-plateforme.md).
- **Référence d’audit :** [`audit-readiness-previsions-scientifiques.md`](audit-readiness-previsions-scientifiques.md)

## 1. Objet

Faire évoluer le tableau de bord Douala Earth Watchers **sans le reconstruire**. Le MVP doit ajouter, après validation temporelle effective, une page Prévisions et une page distincte Validation scientifique. Il doit s’appuyer sur des données réelles archivées, rendre les limites visibles et permettre de reproduire chaque graphique, métrique et export.

La cible scientifique initiale est la température moyenne quotidienne de l’air à 2 m (`T2M`) du produit NASA POWER, aux environs du point demandé 4,05°N, 9,70°E, pour les horizons J+1 à J+3. Une sortie du modèle est une **prévision statistique de la valeur de cette série de produit**, pas une prévision officielle de météo locale, une mesure de station ou une mesure par quartier.

## 2. Périmètre fonctionnel

### Inclus dans le MVP

- Réutiliser l’interface React/TanStack Router et FastAPI existante, les graphiques Recharts et les conventions visuelles et d’API déjà présentes.
- Conserver les séries mensuelles existantes et leurs identités séparées. Aucune série ne remplace silencieusement une autre.
- Étudier T2M quotidien réel à J+1, J+2 et J+3; comparer persistance, baseline saisonnière et un seul modèle candidat.
- Produire un backtest chronologique hors échantillon, des métriques par horizon et un résultat pré-calculé reproductible.
- Ajouter une page Prévisions, une page Validation scientifique distincte de `/sources`, une API de lecture des résultats et des exports CSV/JSON cohérents avec l’écran.
- Afficher une erreur ou **« Données insuffisantes »** si la fraîcheur, la couverture, les métadonnées ou le résultat validé ne permettent pas une réponse fiable; préciser ce qui manque.

### Hors périmètre

- Prévision des précipitations, d’inondation ou de risque d’inondation; probabilité d’inondation; alerte officielle (aucune source d’alerte officielle n’est fournie).
- Déclaration de canicule, anomalie sanitaire ou autre alerte non validée localement.
- Cartes de prévision par quartier à partir d’un point ou d’une maille régionale.
- Présentation de T2M comme température de surface, de GPM comme pluie de station, ou d’un produit NASA comme observation locale directe.
- NDVI en entrée du modèle : l’archive `DV` est géolocalisée et datée, mais sa qualité est majoritairement nuageuse, son pixel est côtier et aucun gain prédictif n’a été évalué. Elle demeure une observation exploratoire séparée tant qu’une sélection QA et une amélioration mesurée ne justifient pas son usage.

## 3. Données, provenance et règles de temps

### Sources disponibles au moment de l’audit

| Source | Usage autorisé dans le MVP | Limite à montrer |
|---|---|---|
| `nasa-data/csv/POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv` | Série historique candidate T2M, 4 018 jours continus du 2015-01-01 au 2025-12-31; T2M en °C. | Snapshot périmé au cadrage (dernière date 2025-12-31); date de récupération absente. Produit POWER d’assimilation/réanalyse, à résolution native MERRA‑2 d’environ 0,5° × 0,625°; pas une station. Le fichier porte la norme LST. |
| `nasa-data/precipitation_Douala_GPM_raw.csv` | Conserver comme série historique/produit de précipitation séparé; pas de forecast pluie dans cette version. | Estimation satellitaire GPM IMERG quotidienne en mm/jour, export agrégé sur une boîte régionale; pas une mesure de pluviomètre ni une donnée par quartier. |
| Six séries mensuelles de `nasa-data/csv/` et les NetCDF de `nasa-data/Nasa/Nasa/` | Maintenir les graphiques historiques existants et leur provenance indépendante. | Résolutions, fréquences et unités diffèrent; ne pas fusionner sans hypothèse et validation explicites. Voir l’inventaire dans le rapport d’audit. |
| `nasa-data/modis/DV/` — export AppEEARS `DV` ([Drive](https://drive.google.com/file/d/1dAQApz_nJjg5ram0Lt6DwQ2bB2GrZcJt/view?usp=drivesdk)) | Option sélectionnable « Végétation observée · MODIS DV » dans le menu Série/produit; chargée par `/api/observations/modis-vegetation` et aussi présentée dans `/sources`, toujours distincte des produits climatiques et du modèle MVP T2M. | Point 4,05°N, 9,70°E; 254 composites du 2014-12-19 au 2025-12-19. Le QA classe 230/254 dates (90,6 %) « cloudy », 15 (5,9 %) « good » et 9 (3,5 %) « marginal »; 253/254 masques indiquent « Ocean coastlines and lake shorelines ». Le JSON dit `processing`, malgré un README indiquant l’achèvement et un CSV présent. Fréquence 16 jours; le graphique n’ajoute ni interpolation quotidienne ni points intermédiaires. Détails dans l’[audit](audit-readiness-previsions-scientifiques.md). |
| Autres archives AppEEARS (`DOUALAV.zip`, `8b7c7e9d-20c6-4516-b205-6e5e05e1d24d.zip`, `Douala_NDVI`) | Exclues comme données de Douala. | `DOUALAV.zip` indique latitude 9 / longitude 70 et ne contient pas de résultats; les deux autres indiquent 9,78°N, 4,14°E, coordonnées qui ne sont pas celles de Douala. Détails et liens dans l’[audit](audit-readiness-previsions-scientifiques.md). |

Aucune série locale de station indépendante n’a été trouvée dans le dépôt. Les scores obtenus contre POWER mesureront la capacité à prévoir **le produit POWER**, non la justesse sur une mesure météo indépendante à Douala. Une validation indépendante nécessitera une source de station locale ou une autre référence indépendante explicitement documentée.

### Champs obligatoires de traçabilité

Pour chaque snapshot source, conserver si disponible :

- fournisseur, produit/collection, version, variable/code NASA, unité, format et URL exacte de requête;
- coordonnées demandées, emprise réelle, résolution native et type de support (point, maille, agrégat de zone);
- date de début/fin des données et convention de date/heure (`UTC`, `LST` ou autre);
- date d’observation/validité distincte de la date de téléchargement (`retrieved_at`), de publication/version source et de l’émission du forecast;
- valeurs sentinelles, contrôles qualité, transformations appliquées et version du convertisseur;
- nom de fichier immuable, taille et empreinte SHA‑256.

Les appels NASA et toute configuration confidentielle restent côté backend. Ne jamais placer de clé/secret NASA dans le navigateur. Si l’API publique n’exige pas de clé, ne pas en inventer une.

### Convention temporelle et fraîcheur

NASA POWER prend en charge UTC et LST; le CSV actuel est en LST. Le standard doit être fixé avant l’évaluation et conservé dans le manifeste. Ne pas mélanger les jours UTC et LST ni relabeller silencieusement les dates en `Africa/Douala`. Si la convention change, récupérer toute la série sur une base cohérente et recalculer les empreintes.

Distinguer dans toute réponse et tout écran :

- `source_date` : date du champ historique tel que daté par le produit;
- `retrieved_at` : instant réel de récupération du snapshot;
- `forecast_origin` : dernière date de donnée utilisée comme entrée;
- `issued_at` : instant où le forecast a été calculé/émis;
- `valid_date` : date visée par chaque horizon.

NASA indique une latence de quelques jours pour ses paramètres météorologiques POWER; cela ne transforme pas ces données en prévision météo. La règle de fraîcheur doit être configurée et documentée. Le forecast ne peut être qualifié d’actuel que si le snapshot est assez récent et que ses dates de validité sont encore futures au moment d’émission. Sinon, afficher un snapshot historique daté ou « Données insuffisantes », jamais « temps réel ».

## 4. Protocole de modélisation et d’évaluation

### Cible et horizons

- Variable cible unique : T2M quotidien en °C du snapshot POWER, à la résolution et au standard temporel documentés.
- Horizons à évaluer séparément : J+1, J+2 et J+3 depuis chaque origine de prévision.
- Toute caractéristique d’un forecast à l’origine `t` doit être connue à `t`. Aucune observation future ou donnée révisée postérieure à `t` ne peut entrer comme prédicteur.
- Pas d’imputation/interpolation des observations manquantes sans méthode préspécifiée; tout prétraitement, normalisation et sélection éventuels sont ajustés uniquement sur l’entraînement.

### Séparation temporelle

- Aucun split aléatoire.
- Protocole proposé : années 2015–2024 pour développement et réglage; année 2025 comme période terminale de test, sous réserve de vérification des dates et métadonnées avant calcul.
- Dans la période terminale, produire les forecasts par origine glissante : à chaque origine, l’entraînement ne voit que les données déjà disponibles à cette origine. Les choix d’algorithme et d’hyperparamètres sont figés avant le test; ne jamais ajuster un choix en fonction des erreurs de test.
- Le snapshot historique ne conserve pas les versions « telles que publiées » pour chaque jour. Le backtest sera donc un rejeu reproductible sur le fichier archivé, mais ne prétendra pas reconstituer exactement l’information opérationnelle disponible à chaque date passée.

### Baselines et candidat

Pour chaque horizon, comparer au minimum :

1. **Persistance :** prédire la dernière T2M connue à l’origine (`T(t+h) = T(t)`).
2. **Référence saisonnière naïve :** valeur réelle de la cible datée 365 jours avant la date cible (`T(date_cible − 365 jours)`), sans compléter les dates absentes.
3. **Un candidat statistique :** algorithme simple choisi et versionné avant le test final; il ne peut utiliser que les variables disponibles au moment de la prévision.

Si le candidat fait moins bien qu’une baseline, conserver la baseline ou présenter le candidat uniquement comme expérimental. Aucun pourcentage de « précision » arbitraire.

### Métriques et incertitude

- Calculer et publier **MAE** et **RMSE en °C**, le nombre de cas évalués `N`, la période, les origines et les résultats **par horizon** pour chaque modèle/baseline.
- Ne pas utiliser MAPE pour une température en °C.
- Ne pas afficher d’intervalle artificiel. Tant qu’une méthode d’incertitude n’a pas été calibrée et testée sur des cas indépendants, afficher **« Incertitude non quantifiée »**.
- Ne jamais annoncer de performance avant que le calcul ait été exécuté et vérifié sur les données réelles.

## 5. Parcours et écrans

### Page `/previsions`

- Présenter séparément les valeurs historiques du produit et les valeurs prédites; différencier visuellement la portion forecast (style/couleur/zone) et tracer l’origine.
- Afficher variable, unité, produit/source, point/résolution, origine de prévision, émission, dates de validité, fraîcheur, version du modèle, statut de validation et limites.
- Qualifier le résultat de prévision statistique expérimentale du produit, pas d’alerte officielle ou de météo de quartier.
- Si le forecast actuel n’est pas admissible, afficher **« Données insuffisantes »** avec la date source disponible et la raison (snapshot trop ancien, dates non futures, métadonnées absentes, test non réalisé, etc.). Ne pas substituer une valeur de démonstration.
- En mode hors ligne, ne montrer qu’un snapshot réel et daté, avec la mention **« archive historique — pas temps réel »**.

### Page `/validation-scientifique`

- Décrire source/dataset, période, empreinte, standard temporel, transformations, origines, partitionnement, baselines et modèle candidat/configuration.
- Afficher tableau et graphiques de MAE/RMSE, N et période test par horizon et modèle, plus la comparaison explicite aux baselines.
- Présenter les limites de validation produit-versus-produit et l’absence éventuelle de vérité terrain locale.
- Cette page est distincte de `/sources`, qui vérifie la structure/cohérence des CSV et ne constitue pas une validation indépendante du modèle.

## 6. API, calculs, stockage et exports

### Calcul et persistance

- Le modèle et le backtest sont exécutés par un script/commande contrôlée hors du chemin de requête utilisateur.
- Les résultats sont pré-calculés, versionnés et sérialisés en artefacts légers (JSON/CSV); l’ouverture ou le rafraîchissement d’une page ne lance pas d’entraînement.
- Le backend est l’unique couche qui lit les snapshots et métadonnées, calcule ou sert les données et contacte NASA. Le frontend ne contient pas de secrets et ne réentraîne pas de modèle.

### Contrat minimal d’un résultat

Chaque forecast doit identifier au minimum : `run_id`, source + SHA‑256, modèle/version/configuration, code et dépendances pertinentes, `forecast_origin`, `issued_at`, standard temporel, horizon, `valid_date`, valeur et unité, statut de fraîcheur/validation et mention d’incertitude. Chaque résultat de validation ajoute partition, période, `N`, MAE, RMSE et baselines par horizon.

Les routes proposées sont à confirmer lors de l’implémentation, par exemple :

- `GET /api/forecasts/t2m-daily` : forecast validé ou objet explicite « données insuffisantes »;
- `GET /api/validation/t2m-daily` : résultats de backtest et manifeste;
- `GET /api/forecasts/t2m-daily/export.csv` et `.../export.json` : export des mêmes valeurs exposées à l’écran.

### Exports

- CSV/JSON incluent les dates, horizons, valeurs prédites/observées, unité, provenance, origine/émission, métriques pertinentes et identifiants de run.
- Les exports et le graphique proviennent du **même objet de résultat**, avec le même filtre et la même précision de valeurs; un test vérifie leur concordance exacte.
- Toute transformation d’affichage (arrondi, date, série historique/forecast) est explicitée; l’API et les exports gardent la valeur scientifique non arrondie lorsque disponible.

## 7. Exigences qualité, sécurité et validation

- Données réelles uniquement. Toute donnée absente ou non conforme produit un statut d’indisponibilité compréhensible; aucune série synthétique ou valeur par défaut présentée comme mesure.
- Tests de continuité/date, sentinelles, unités, origine/horizon, non-fuite temporelle, baselines, agrégation des métriques, état de fraîcheur et `N` par horizon.
- Test API des contrats forecast/validation/erreur; test frontend des états chargement, succès, hors ligne, données insuffisantes et dates obsolètes.
- Test de parité graphique/export et test qu’aucun entraînement n’est déclenché par le chargement de page.
- Vérifier que le backend n’expose pas d’identifiants/secrets NASA au client.
- Les tests/rapports ne sont pas considérés comme une validation climatique indépendante; celle-ci exige une référence indépendante documentée.

## 8. Critères d’acceptation du MVP

Le MVP est accepté seulement si :

1. Le tableau de bord existant est conservé et ses séries déjà intégrées restent distinctes.
2. La cible, l’unité, la résolution, la période et le standard temporel sont visibles et cohérents entre écran, API et export.
3. Aucun forecast actuel n’est affiché depuis le snapshot du 2025-12-31; l’écran signale son ancienneté ou l’état « Données insuffisantes ».
4. Les résultats hors échantillon sont calculés chronologiquement, sans fuite, et chaque horizon est comparé aux deux baselines avec MAE/RMSE, `N` et période.
5. Le gagnant n’est pas présumé : un candidat moins performant reste expérimental ou est remplacé par la baseline.
6. Aucun intervalle, probabilité d’inondation, alerte officielle simulée ou précision arbitraire n’est affiché.
7. Les fichiers d’export reproduisent exactement les résultats servis et affichés et contiennent les empreintes/configurations nécessaires à la reproduction.
8. Les calculs sont hors ligne/pré-calculés; aucune ouverture de page ne lance un entraînement.
9. Aucune archive MOD13Q1 n’entre dans le modèle T2M sans validation de la géolocalisation, des couches QA et d’un gain prédictif mesuré. L’extraction `DV` correctement géolocalisée reste hors modèle : la grande majorité des composites sont classés nuageux, le masque est côtier et la fréquence est de 16 jours.

## 9. Phases de réalisation

1. **Audit des données/code et faisabilité — terminé.** Référence : [`audit-readiness-previsions-scientifiques.md`](audit-readiness-previsions-scientifiques.md).
2. **Baselines et protocole de validation temporelle — prochaine étape.** Vérifier d’abord le standard temporel retenu et figer le test avant tout calcul.
3. **Comparaison du candidat — après obtention des baselines.** Calculer les scores; retenir une baseline si elle gagne.
4. **API de forecast et page Prévisions.** Servir uniquement les runs validés/pré-calculés; états obsolètes et insuffisants inclus.
5. **Page Validation scientifique et exports reproductibles.** Les métriques et exports sont issus des mêmes artefacts.
6. **Tests, documentation et démonstration.** Inclure test de fuite temporelle, parité d’export et mode hors ligne daté.

## 10. Points ouverts et demandes en attente

- Verrouiller avant le backtest la convention UTC ou LST. Le fichier historique disponible est LST; ne pas mélanger les conventions.
- Vérifier la disponibilité d’un snapshot récent et fixer/se documenter le seuil de fraîcheur au regard de la latence publiée du produit.
- Toute validation de l’exactitude météo locale exige une station ou une référence indépendante absente du dépôt actuel.
- L’export AppEEARS `DV` aux coordonnées 4,05°N, 9,70°E est intégré sous `nasa-data/modis/DV/` et servi comme observation séparée. Avant tout usage scientifique supplémentaire, vérifier son état AppEEARS (JSON `processing` malgré le CSV et le README), définir le filtrage QA et traiter explicitement le masque côtier. Il reste hors du modèle T2M tant que sa qualité et un gain prédictif incrémental n’ont pas été évalués; conserver les composites de 16 jours et ne pas les convertir en série quotidienne.
- **Commentaires du code :** la demande active couvre l’ensemble des fichiers de code présents dans le dépôt, pas seulement les fichiers modifiés ni une archive Drive. Un commentaire de rôle est maintenant présent dans les 40 fichiers de code recensés; les fonctions et traitements non triviaux sont documentés. Ce balayage est documentaire et ne change pas le calcul des observations.
