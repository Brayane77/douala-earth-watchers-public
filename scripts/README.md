# Scripts de données

Les scripts documentent les transformations et outils du dépôt. Le backend ne les exécute pas automatiquement : il lit les CSV canoniques déclarés dans `backend/nasa_data.py`.

## Conversion MERRA-2 PRECTOT

Le NetCDF MERRA-2 PRECTOT déjà archivé dans le dépôt est le même fichier que le candidat le plus récent trouvé sur Google Drive (ID `1qjp5kifUcjj-I1eefRE5zmIplLHWyf5i`, SHA-256 `45fde845a96a915b7c5386cb3f16f71003b313af16efe284e013d6692d3f0d63`). Il se trouve ici : `nasa-data/Nasa/Nasa/g4.areaAvgTimeSeries.M2TMNXFLX_5_12_4_PRECTOT.20150101-20251231.9E_4N_9E_4N.nc`.

Pour générer la série CSV séparée, lancer depuis la racine du dépôt :

```bash
python3 scripts/convert_merra2_precipitation.py # Vérifie le NetCDF et génère le CSV PRECTOT MERRA-2.
```

Le convertisseur contrôle la variable `M2TMNXFLX_5_12_4_PRECTOT`, l’unité `kg m-2 s-1`, les 132 mois continus de 2015-01 à 2025-12, les valeurs manquantes et la durée de chaque borne mensuelle. Il transforme la moyenne du flux en cumul par multiplication par le nombre exact de secondes du mois (`1 kg/m² d’eau = 1 mm`) et écrit `nasa-data/csv/precipitation_Douala_MERRA2_monthly.csv` avec les colonnes `date,value,sector`, en `mm/mois` (six décimales, sans interpolation).

Le produit est une moyenne de zone MERRA-2, résolution nominale d’environ 0,5° × 0,625°. L’export indique une zone demandée de 9,70–9,78°E et 4,05–4,14°N, mais ses métadonnées précisent que la grille limite l’analyse au point 10°E, 4°N. Ce CSV est exposé par le catalogue API sous `precipitation_merra2`; il reste distinct des données GPM et NASA POWER, et ne remplace aucun fichier existant.

## Pipeline NASA POWER quotidien

Le fichier brut, avec son en-tête de source, se trouve ici : `nasa-data/csv/POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv`.

Pour recréer les séries mensuelles exploitées par le dashboard, lancer depuis la racine du dépôt :

```bash
python3 scripts/convert_nasa_power_daily.py # Valide le fichier brut et régénère les deux CSV mensuels POWER.
```

Le script vérifie les colonnes YEAR, DOY, T2M et PRECTOTCORR, les jours quotidiens continus et l’absence du code manquant `-999`. Il calcule :

- `nasa-data/csv/temperature_Douala_POWER_monthly.csv` : moyenne mensuelle de T2M en °C.
- `nasa-data/csv/precipitation_Douala_POWER_monthly.csv` : somme mensuelle de PRECTOTCORR en mm/mois, à partir de valeurs brutes en mm/jour.

Les fichiers de sortie ont les colonnes `date,value,sector`. La source brute n’est pas modifiée et les sorties ne fusionnent pas avec les séries antérieures.

## Autres outils présents

- `convert_nc_to_csv.py` : utilitaire historique de conversion NetCDF; il n’est pas appelé au démarrage du backend. Vérifier ses chemins et sorties avant usage, car le dashboard utilise des fichiers canoniques déclarés et versionnés.
- `convert_gpm_final.py`, `convert_gpm_to_csv.py`, `process_gpm_data.py` et `fix_gpm_units.py` : utilitaires de conversion GPM; leurs notes et unités sont détaillées dans `README_GPM.md`.
- `download_nasa_cmr.py` : utilitaire de téléchargement NASA CMR, distinct du pipeline d’exécution du dashboard.
- `export_environmental_report.py` : générateur de rapport descriptif à partir d’un CSV fourni; il n’est pas appelé par l’interface.

Consulter `README_GPM.md` et les métadonnées des fichiers sources avant de remplacer un CSV existant. Les NetCDF `T10M` et `PRECTOT` archivés ne sont pas publiés comme séries supplémentaires par l’API actuelle.
