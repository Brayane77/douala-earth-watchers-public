# Contrat et provenance des données

Le dashboard consomme les CSV mensuels validés par `backend/nasa_data.py`. Le backend ne crée aucune série de remplacement. Les cinq indicateurs visibles utilisent des fichiers canoniques au format `date,value,sector`.

## Séries consommées par l’application

| Identifiant API | CSV canonique | Variable / produit | Unité | Source et transformation |
|---|---|---|---|---|
| `temperature` | `temperature_Douala.csv` | MERRA‑2 T2M, air à 2 m | °C | Les 132 valeurs sont égales à la série mensuelle T2M du NetCDF MERRA‑2 moins 273,15 K; écart numérique maximal inférieur à 1e‑12 °C. |
| `precipitation` | `precipitation_Douala.csv` | Cumul mensuel correspondant au taux GPM | mm/mois | Les 132 valeurs correspondent au taux de `precipitation_Douala_GPM.csv` multiplié par les jours calendaires du mois; écart numérique maximal inférieur à 1e‑12 mm. |
| `precipitation_rate` | `precipitation_Douala_GPM.csv` | NASA GPM IMERG, taux moyen journalier agrégé par mois | mm/jour | Série de taux mensuels; elle n’est pas un cumul mensuel. |
| `temperature_power` | `temperature_Douala_POWER_monthly.csv` | NASA POWER / MERRA‑2 T2M | °C | Moyenne arithmétique mensuelle des valeurs quotidiennes T2M provenant du CSV POWER brut au point 4,05°N, 9,70°E. |
| `precipitation_power` | `precipitation_Douala_POWER_monthly.csv` | NASA POWER / MERRA‑2 PRECTOTCORR | mm/mois | Somme mensuelle des taux quotidiens PRECTOTCORR en mm/jour provenant du même export POWER. |

Toutes les séries canoniques couvrent 2015‑01 à 2025‑12 (132 mois) et utilisent le libellé de zone `Douala`. Les deux séries POWER sont distinctes des produits régionaux existants : le fichier POWER demande un point à 4,05°N, 9,70°E, tandis que le NetCDF T2M du dépôt est un agrégat régional MERRA‑2.

## CSV POWER quotidien et conversion

Le fichier brut `nasa-data/csv/POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv` conserve l’en-tête de provenance NASA POWER. Il contient 4 018 jours continus du 1er janvier 2015 au 31 décembre 2025, sans date dupliquée ni valeur de manque `-999`. L’en-tête décrit T2M en °C et PRECTOTCORR en mm/jour, pour le point demandé et en heure solaire locale.

Le script `scripts/convert_nasa_power_daily.py` valide les colonnes, les dates quotidiennes et les valeurs manquantes, puis produit les deux CSV mensuels canoniques. Il calcule la moyenne mensuelle de T2M et la somme mensuelle de PRECTOTCORR. La conversion ne remplace ni ne fusionne les fichiers préexistants.

## NetCDF MERRA‑2 archivés

| Variable du NetCDF | Métadonnées mesurées | Statut dans le dashboard |
|---|---|---|
| `M2IMNXASM_5_12_4_T2M` | Température de l’air à 2 m, moyenne mensuelle, K, 132 mois (2015‑01 à 2025‑12) | Utilisée indirectement par `temperature_Douala.csv` après conversion K → °C; concordance numérique vérifiée sur les 132 lignes. |
| `M2IMNXASM_5_12_4_T10M` | Température de l’air à 10 m, moyenne mensuelle, K, 132 mois | Archivée, mais non exposée comme indicateur. |
| `M2TMNXFLX_5_12_4_PRECTOT` | Précipitations de surface, moyenne mensuelle du flux, kg m⁻² s⁻¹, 132 mois | Archivée, mais non exposée. Elle n’est pas équivalente aux variables GPM ou POWER PRECTOTCORR affichées. |

L’API ne lit pas directement ces fichiers binaires au démarrage : le CSV T2M existant porte les valeurs converties du NetCDF, alors que les NetCDF T10M et PRECTOT restent des archives non publiées. Aucune conversion PRECTOT vers un cumul en mm/mois n’est faite par le dashboard.

## Autres sources et limites

- `nasa-data/precipitation_Douala_GPM_raw.csv` est un export quotidien brut et ne constitue pas une série active directe de l’API.
- Le taux GPM exprimé en mm/jour et les cumuls en mm/mois doivent rester distingués dans les graphiques et les comparaisons.
- Le CSV mensuel `precipitation_Douala.csv` correspond mathématiquement au taux GPM multiplié par les jours du mois; cette concordance confirme la conversion numérique, pas toutes les étapes historiques de transfert du fichier.
- Les données MERRA‑2 et NASA POWER sont des produits de réanalyse/assimilation, pas des mesures directes effectuées par une station à chaque quartier.
- Le seul secteur fourni est `Douala`; le point de carte est indicatif et ne permet pas d’inférer des contrastes infra-urbains.
- Aucun fichier NDVI validé n’est publié par l’API.

Au chargement, le backend exige les colonnes `date`, `value`, `sector`, des valeurs numériques finies, des dates valides et l’absence de doublons mois/secteur. Les mois absents ne sont ni imputés ni prolongés. La couverture du tableau de bord exprime la proportion de mois présents dans la série sélectionnée, et non la disponibilité d’un instrument ou la qualité scientifique du produit.

## Module d’analyse exploratoire

Le endpoint `/api/ml/evaluate` accepte séparément un CSV envoyé en mémoire. Il attend une série mensuelle conforme aux contrôles du backend; le fichier importé n’est pas conservé. Les résultats restent exploratoires et ne sont pas des projections climatiques officielles.
