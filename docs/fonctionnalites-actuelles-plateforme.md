# Inventaire fonctionnel actuel — Douala Earth Watchers

**Objet :** décrire l’existant (« as built ») pour préparer le cahier des charges. Ce document recense les fonctions visibles dans l’interface et les fonctions disponibles dans l’API; il ne transforme pas les pistes futures en fonctions déjà livrées.

> **À retenir :** le style graphique inspiré des interfaces d’IA reste visuel; il existe désormais un laboratoire distinct de modèles mensuels, déclenché uniquement par soumission d’un CSV utilisateur. La plateforme fournit aussi un backtest quotidien T2M pré-calculé et des indicateurs historiques à seuil défini par l’utilisateur. Elle ne fournit toujours ni forecast météorologique actuel (snapshot terminé le 2025-12-31, date de récupération absente), ni flux d’alerte officiel, ni agent conversationnel.

## 1. Fonctionnalités de l’interface

### 1.1 Tableau de bord — route `/`

1. **Chargement des sources locales** : récupère auprès de FastAPI les six séries climatiques du catalogue CSV; l’archive MODIS est chargée depuis sa route dédiée. L’interface n’interroge pas NASA pour récupérer de nouvelles observations.
2. **Sélecteur « Série / produit »** : propose les six identifiants climatiques (`temperature`, `temperature_power`, `precipitation`, `precipitation_rate`, `precipitation_merra2`, `precipitation_power`) et l’option supplémentaire « Végétation observée · MODIS DV ». MODIS n’est pas ajouté au catalogue climatique; la sélection active son affichage dédié et garde sa structure indépendante.
3. **Filtre de secteur** : filtre sur les secteurs réellement fournis par les CSV climatiques. Dans les séries actuelles, le secteur est l’agrégat « Douala »; il ne s’agit pas d’un filtre entre quartiers. Ce filtre est masqué pour MODIS DV.
4. **Filtre mensuel** : sélection des bornes début/fin au mois près, bornes inclusives, pour les produits climatiques. Raccourcis disponibles : 12 mois, 3 ans, 5 ans et toute la période source. En sélection MODIS, les contrôles mensuels sont masqués et la fréquence native de 16 jours est conservée.
5. **Indicateurs descriptifs synchronisés aux filtres** :
   - moyenne des valeurs présentes;
   - minimum observé et mois correspondant;
   - maximum observé et mois correspondant;
   - nombre de mois renseignés, avec comparaison au nombre de mois attendus dans la période choisie.

   Les mois absents restent absents; ils ne sont ni transformés en zéro ni interpolés. Si plusieurs mois ont le même minimum ou maximum, l’interface signale les mois ex æquo.
6. **Graphique historique mensuel** : graphique en aires Recharts, synchronisé avec le produit, le secteur et la période; infobulle au survol avec date, valeur formatée et unité. Un état vide est affiché quand aucun mois ne correspond aux filtres.
7. **Carte temporelle interactive Plotly** : fond OpenStreetMap, zoom/déplacement et affichage du point de référence du catalogue. Une seule valeur ponctuelle est placée au point fourni; la carte propose une échelle de couleur et, lorsque plusieurs observations mensuelles sont présentes, une glissière temporelle ainsi que les commandes « Lecture » et « Pause ».
   - T2M utilise une palette jaune-orange-rouge;
   - les autres variables utilisent une palette bleue;
   - la carte ne produit ni raster, ni heatmap, ni valeur au clic, ni interpolation entre quartiers.
8. **Produit Végétation MODIS sélectionnable** : le choix « Végétation observée · MODIS DV » remplace les métriques et graphiques mensuels par le nuage de points NDVI/EVI de l’archive `DV`. Chaque point utilise la date réelle du composite de 16 jours; les points ne sont pas reliés et aucun jour n’est ajouté. Le survol fournit les valeurs, les libellés QA et le masque terre/eau; le panneau montre aussi les comptes QA, le point, la période, la résolution et l’avertissement de statut de l’archive. Tous les composites, y compris les nuageux, restent affichés avec cette limite indiquée. La navigation vers la section Végétation et son panneau dédié restent disponibles.
9. **Export CSV local** : télécharge uniquement les lignes climatiques actuellement filtrées/affichées, avec date, zone, indicateur, variable, valeur, unité et source. Les cellules susceptibles d’être interprétées comme des formules par un tableur sont protégées.
10. **Navigation par sections** : accès aux sections de vue d’ensemble, carte, graphique et végétation; les pages Sources et Prévisions sont des routes distinctes. Le bloc et le lien « À propos » ont été retirés du tableau de bord.
11. **États de chargement et d’erreur** : messages explicites, bouton de nouvelle tentative et absence de valeurs de remplacement simulées si l’API ou un jeu de données manque.

### 1.2 Sources et validation — route `/sources`

1. **Catalogue des six séries mensuelles** : affiche pour chaque série son identifiant API, fichier, source, variable, unité, agrégation, résolution, période et nombre de lignes.
2. **Contrôle structurel côté page** : nombre de lignes conforme au catalogue, dates valides et dans la période source, valeurs numériques finies, secteurs présents dans le catalogue, absence de doublons mois/secteur et comparaison des mois observés/attendus.
3. **Limites des contrôles** : l’interface précise que ces vérifications portent sur la structure/cohérence des CSV et ne constituent pas une validation scientifique indépendante des produits.
4. **Panneau MODIS distinct** : présente l’archive AppEEARS `DV` (MOD13Q1.061) avec ses métadonnées, dates effectives et demandées, nombre de composites, comptes QA et classes du masque terre/eau. L’avertissement relatif au statut AppEEARS (`processing` dans le JSON alors que le README annonce une fin de traitement) reste visible.
5. **Disponibilités et limites** : la page signale explicitement la température de surface LST exploitable, le forecast actuel, un flux d’alertes officielles et les valeurs par quartier comme indisponibles. Le backtest historique et les seuils exploratoires sont décrits séparément.
6. **Erreurs et reprise** : états de chargement, erreur de catalogue, explication qu’aucune donnée de remplacement n’est utilisée et possibilité de réessayer ou de revenir au tableau de bord.

L’archive Drive `ad8b74da-fcbf-422e-ab17-a9889a15740b.zip` n’est pas intégrée à la plateforme. L’unique archive MODIS exposée par l’application est `DV`, conservée séparément des six séries climatiques mensuelles.

### 1.3 Prévisions et alertes — routes `/previsions` et `/validation-scientifique`

1. **Forecast actuel** : `/previsions` sert le statut « données insuffisantes », la date source maximale du 2025-12-31 et l’absence de date de récupération. Aucun point futur n’est extrapolé à partir de l’archive périmée.
2. **Laboratoire ML mensuel** : `/previsions` permet de téléverser un CSV mensuel, de choisir date/variable, séparateur, unité/contexte, secteur, horizon et candidat (forêt aléatoire ou Ridge), et demande confirmation que les valeurs sont des observations réelles (déclaration non vérifiée par l’application). Après soumission seulement, l’API compare les modèles à la persistance et à la baseline saisonnière via des origines chronologiques sans fuite, puis affiche N, dates/périodes, MAE/RMSE, valeurs projetées et empreintes. Des exports JSON/CSV proviennent du même rapport. Ce scénario reste expérimental, utilisateur et distinct du forecast actuel, du backtest quotidien et des alertes officielles.
3. **Backtest historique** : `/validation-scientifique` présente un backtest pré-calculé des données quotidiennes NASA POWER T2M en °C, période terminale 2025, origines glissantes et horizons J+1/J+2/J+3. Chaque horizon donne N, période valide, MAE et RMSE pour un candidat Ridge, la persistance et la baseline saisonnière.
4. **Traçabilité du backtest quotidien** : le rapport indique source, identifiants de run, empreintes SHA-256 des données et du code, configuration, standard temporel LST, statut candidat expérimental et absence de validation par station. L’ouverture d’une page ne lance pas le backtest.
5. **Exports du backtest quotidien** : les exports CSV et JSON proviennent du même artefact que le tableau et le graphique; chaque ligne conserve date d’origine, date valide, horizon, observation, candidat, baselines, run ID et empreinte source.
6. **Avis officiels** : la route indique « indisponible » faute de flux officiel raccordé et ne simule aucun avis.
7. **Seuils exploratoires** : l’utilisateur peut saisir un seuil explicite pour T2M ou PRECTOTCORR; l’API le compare à la dernière ligne de l’archive quotidienne et renvoie la date, l’unité, l’opérateur et l’empreinte source. Aucun seuil par défaut n’est appliqué. Le résultat est un indicateur historique, non officiel et non actuel; il n’est pas une prévision de pluie ni un risque d’inondation.

### 1.4 Fonctions communes d’interface

- Thème clair/sombre; **le mode clair (fond blanc) est le défaut permanent**, sans dépendre de la préférence système. Le choix explicite est conservé dans le stockage local du navigateur et appliqué par un script d’amorçage dans le `<head>`, avant le premier rendu, afin d’éviter tout éclair de fond blanc en mode sombre.
- Mise en page responsive, menu latéral repliable sur petit écran, formulaires et boutons accessibles avec libellés et états adaptés.
- Respect de la préférence de réduction des animations du système.
- Pages d’erreur de route et page 404 avec actions de reprise/navigation.
- Habillage visuel actuel inspiré des interfaces d’IA : trame discrète, panneaux translucides, accents cyan/indigo et fond noir en mode sombre. Les indicateurs du tableau de bord restent descriptifs; les modèles ne tournent que dans le laboratoire CSV explicitement soumis.
- **Interface resserrée sur l’usage** : les panneaux de synthèse « Données et usages indisponibles », « Données et fonctions absentes », « Repère spatial », « Portée et limites » et « Interprétation à ne pas dépasser » ont été retirés. Leurs informations non redondantes (masque côtier MODIS, rejeu sur version archivée, coordonnée de référence) sont conservées en une ligne contextualisée dans le panneau ou la carte concernés, et les limites détaillées restent dans les notes de provenance de `/sources`.

## 2. Données actuellement proposées dans le tableau de bord

Les six séries climatiques sont des CSV locaux mensuels. Le catalogue documente une couverture de 2015-01 à 2025-12 (132 mois par série contrôlée) et un secteur agrégé « Douala ». Le sélecteur propose en plus MODIS DV comme produit distinct, servi par une route d’observation séparée et non par le catalogue mensuel.

| Identifiant | Produit et variable | Unité / traitement actuellement déclaré |
|---|---|---|
| `temperature` | NASA MERRA-2 T2M, température de l’air à 2 m | °C; moyenne mensuelle issue du produit MERRA-2, conversion K → °C vérifiée contre le NetCDF archivé. |
| `temperature_power` | NASA POWER, MERRA-2 T2M quotidien | °C; moyenne mensuelle des valeurs quotidiennes, point de requête 4,05°N, 9,70°E. |
| `precipitation` | NASA GPM IMERG | mm/mois; cumul dérivé du taux moyen journalier multiplié par le nombre de jours du mois. |
| `precipitation_rate` | NASA GPM IMERG | mm/jour; moyenne mensuelle des taux quotidiens, distincte d’un cumul mensuel. |
| `precipitation_merra2` | NASA MERRA-2 M2TMNXFLX v5.12.4, PRECTOT | mm/mois; flux moyen converti en cumul sur la durée exacte du mois; cellule décrite dans le catalogue à 10°E, 4°N. |
| `precipitation_power` | NASA POWER, MERRA-2 PRECTOTCORR | mm/mois; somme mensuelle des taux quotidiens, point de requête 4,05°N, 9,70°E. |

Les résolutions, définitions et méthodes de conversion varient selon les produits : ils ne sont pas fusionnés ou substitués automatiquement. T2M est la température de l’air à 2 m, pas une température de surface. Les CSV sont des produits agrégés/ponctuels et ne décrivent pas des mesures par rue ou quartier.

### Archive Drive `NewD.zip` inspectée, mais non fusionnée

- Archive téléchargée puis extraite dans le dossier local ignoré `google_drive/NewD/`; Drive ID `1bWKAoOgZ7szQ7cdQIvu2oFl4L2NKLWwr`, taille 63 393 octets, SHA-256 `1a65045e544af0b8d2d403b46763d529547e962f8d1bfc47c36643b77b112156`.
- Le ZIP contient le T2M MERRA‑2 `M2TMNXSLV_5_12_4_T2M` (132 moyennes mensuelles en K, 2015-01–2025-12), ainsi que `TLML` (température de l’air de surface, K), `GHTSKIN` (flux de chauffage du sol, W/m²), `U2M` (composante est du vent, m/s) et `V2M` (composante nord du vent, m/s). Ces variables n’ont pas la même définition; notamment GHTSKIN n’est pas une température de surface.
- L’export annonce une fenêtre 9,70–9,78°E / 4,05–4,14°N, mais les métadonnées restreignent l’analyse à la cellule de grille 10°E, 4°N; il ne s’agit pas d’une mesure par quartier. Le CSV U2M et les NetCDF GHTSKIN, TLML, T2M et V2M sont conservés seulement dans le dossier local ignoré pour inspection.
- Ces produits mensuels ne sont pas ajoutés au sélecteur des six séries et ne sont pas utilisés pour construire le backtest quotidien J+1/J+2/J+3. Aucune interpolation ni fusion avec le POWER quotidien n’est faite; les composantes U2M/V2M ne sont pas dérivées en vitesse. Le CSV existant et le NetCDF `M2IMNXASM` restent des produits séparés.
- L’archive ne contient pas de dates postérieures à 2025; elle ne rend pas le snapshot actuel. Les horodatages Drive rapportés au 2026-11-15 sont postérieurs à la référence système du 2026-10-18 et ne sont pas pris comme date de récupération vérifiée. Les scripts NASA inclus n’ont pas été exécutés.

### Option de produit végétation MODIS `DV`

- Produit : MODIS/Terra MOD13Q1.061, NDVI, EVI et couches QA associées.
- Point de l’extraction : 4,05°N, 9,70°E; résolution nominale 250 m; composites de 16 jours.
- Couverture présente dans le CSV : 254 composites, du 2014-12-19 au 2025-12-19. La fenêtre demandée est du 2015-01-01 au 2025-12-31.
- Valeurs servies telles qu’exportées, avec rang QA, libellés QA, qualité MODLAND et masque terre/eau.
- La source est exclue du catalogue climatique mensuel, du résumé T2M/précipitations et de tout usage comme prédicteur; aucune conversion en série quotidienne n’est faite.
- Le chargement restitue l’avertissement de statut discordant entre le JSON AppEEARS et le README; l’achèvement n’est pas vérifié indépendamment.

## 3. Fonctionnalités backend et API

FastAPI lit les CSV versionnés au démarrage, les valide et les garde en mémoire. L’API n’effectue pas d’acquisition NASA à la demande. Les filtres de date des séries mensuelles sont au mois, avec bornes inclusives.

| Méthode et route | Fonction actuellement disponible |
|---|---|
| `GET /api/health` | État de l’API, source locale et identifiants des jeux climatiques chargés. |
| `GET /api/sectors` | Secteurs réellement présents dans les CSV. |
| `GET /api/data/catalog` | Métadonnées publiques, secteurs, période réelle et nombre de lignes. |
| `GET /api/dashboard-data` | Catalogue et séries utilisées par le tableau de bord; accepte les filtres facultatifs de secteur et de dates. |
| `GET /api/data/{kind}` | Lecture d’une série par identifiant, avec filtres facultatifs `sector`, `start` et `end`. |
| `GET /api/demo/{kind}` | Alias historique déprécié de `/api/data/{kind}`. |
| `GET /api/observations/modis-vegetation` | NDVI/EVI et QA de l’archive `DV`, avec provenance et fréquence native. Route séparée du catalogue climatique mensuel. |
| `GET /api/forecasts/t2m-daily` | Retourne le statut « données insuffisantes », la source et la dernière observation; aucune prévision actuelle n’est fournie. |
| `GET /api/validation/t2m-daily` | Retourne le backtest JSON pré-calculé, les métriques par horizon et les 1 089 lignes d’évaluation historique. |
| `GET /api/validation/t2m-daily/export.csv` / `export.json` | Exporte exactement l’artefact de validation servi par l’API. |
| `GET /api/alerts/status` | Signale l’absence d’un flux officiel et décrit la disponibilité des seuils exploratoires. |
| `POST /api/alerts/exploratory` | Compare un seuil fourni par l’utilisateur à la dernière observation POWER archivée; renvoie un indicateur historique non officiel. |
| `POST /api/ml/evaluate` | Évaluation exploratoire d’un CSV téléversé par l’utilisateur, puis réponse de validation et scénario de prévision mensuelle; indépendante du backtest quotidien. |

### Détail de l’évaluation exploratoire (`POST /api/ml/evaluate`)

- L’interface charge manuellement un fichier `.csv` (maximum 5 Mio); le navigateur lit l’en-tête pour proposer les colonnes. L’API traite le contenu pour cette requête sans l’archiver, ne persiste pas le modèle/run et ne lance aucun calcul à l’ouverture d’une page.
- L’utilisateur indique date, variable, séparateur/notation décimale, éventuellement le secteur, l’horizon (1 à 24 mois), 12 à 36 origines terminales et le modèle (`random_forest` ou `ridge`); source, unité, agrégation et résolution sont déclarées ou signalées comme inconnues.
- La série doit contenir au moins 60 et au plus 1 200 mois consécutifs, une valeur numérique finie par mois, sans doublon ni mois manquant. Aucun remplissage, interpolation ou agrégation des doublons n’est réalisé. Le volume minimal précis dépend de l’horizon et du nombre d’origines.
- Le candidat utilise calendrier cyclique, tendance et retards issus du seul passé connu; les origines glissantes utilisent un entraînement expansif et des projections récursives, sans split aléatoire ni accès aux cibles futures. Les MAE/RMSE et N sont reportés par horizon et période, avec la baseline de persistance et la dernière observation passée du même mois calendaire.
- Le rapport contient historique, dernière observation, dates et valeurs du scénario, périodes, scores, configuration, versions logicielles, hash SHA-256 du CSV et du code, run ID, features et raison d’indisponibilité éventuelle d’une baseline. Aucune MAPE, précision arbitraire ou incertitude artificielle n’est ajoutée.
- Des exports JSON et CSV sont construits à partir du rapport affiché. Le scénario est une expérimentation sur le CSV choisi, sans validation externe, sans statut de forecast météorologique actuel, sans alerte officielle et sans fusion avec le backtest quotidien T2M.
- Le détail du parcours, des contrats et des limites est décrit dans `docs/guide-previsions-ml-mensuelles.md`.

## 4. Validation, intégrité et comportement en cas d’erreur

- **Au chargement backend :** vérification des colonnes `date`, `value`, `sector`; conversion/validation des dates et nombres; valeurs finies; secteur non vide; unicité mois/secteur. Les fichiers absents ou invalides provoquent une erreur explicite, pas un remplacement simulé.
- **Dans l’API :** validation du format des bornes de période et de leur ordre; refus d’un secteur inconnu et d’un identifiant de jeu indisponible.
- **Dans le client :** contrôle du contrat de réponse, des métadonnées, des dates, valeurs, secteurs, nombres de lignes et unicité avant affichage.
- **Pour MODIS :** contrôle de l’identité de la tâche `DV`, du produit, des coordonnées, des colonnes/valeurs QA, des dates uniques et de l’accord du nombre de composites avec le manifeste.
- **Aucune interpolation des mois/composites manquants** et aucun ajout de valeurs synthétiques.

## 5. Fonctionnalités non disponibles à ce jour

Ces éléments ne doivent pas figurer dans le cahier des charges comme fonctions livrées :

- acquisition en temps réel ou rafraîchissement automatique des produits NASA;
- forecast actuel: le snapshot POWER se termine au 2025-12-31 et n’a pas de date de récupération documentée; l’API ne renvoie aucune valeur future;
- validation indépendante par une station météo locale; le backtest publié mesure seulement la capacité à prévoir le produit POWER archivé;
- flux d’alertes officielles, alertes sanitaires/chaleur validées localement, probabilité de pluie ou risque d’inondation; le seuil exploratoire n’est pas un avis d’autorité;
- couche raster, heatmap, limites de quartiers ou valeurs climatiques par clic/quartier;
- température de surface LST exploitable;
- agent conversationnel ou modèle opérationnel de forecast actuel; les modèles mensuels utilisateur et le candidat Ridge du backtest quotidien restent des outils distincts et expérimentaux;
- comptes utilisateurs, rôles, notifications et persistance d’un historique des seuils configurés ou des fichiers téléversés.

## 6. Références fonctionnelles dans le dépôt

- Interface du tableau de bord : `frontend/src/routes/index.tsx`.
- Interface Sources et archive MODIS : `frontend/src/routes/sources.tsx`.
- Laboratoire d’évaluation mensuelle : `frontend/src/components/MonthlyMlLab.tsx` et `frontend/src/lib/monthly-ml.ts`.
- Carte temporelle : `frontend/src/components/MapPanel.tsx`, `frontend/src/lib/interactive-map.ts`.
- Graphique climatique : `frontend/src/components/ChartPanel.tsx`.
- Panneau de végétation MODIS `DV` : `frontend/src/components/VegetationPanel.tsx`.
- Filtres, statistiques descriptives et export CSV : `frontend/src/lib/climate.ts`.
- Contrats et validations côté navigateur : `frontend/src/lib/api.ts`.
- API : `backend/api/main.py`.
- Catalogue et contrôles des CSV climatiques : `backend/nasa_data.py`.
- Chargeur MODIS `DV` : `backend/modis_data.py`.
- Évaluation exploratoire téléversée : `backend/climate_ml.py`.
