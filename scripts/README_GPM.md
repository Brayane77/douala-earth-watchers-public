# Séries de précipitations GPM dans le dépôt

Cette note décrit les relations numériques vérifiées entre les CSV actuellement référencés par l’API. Elle ne transforme pas une comparaison statistique en validation indépendante du produit satellite.

## Fichiers et rôles

| Fichier | Contenu | Rôle actuel |
|---|---|---|
| `nasa-data/precipitation_Douala_GPM_raw.csv` | Export GPM brut à fréquence quotidienne | Archive d’entrée des outils de conversion; non chargé directement par le dashboard. |
| `nasa-data/csv/precipitation_Douala_GPM.csv` | 132 valeurs mensuelles de taux journalier moyen | Série `precipitation_rate` affichée en mm/jour. |
| `nasa-data/csv/precipitation_Douala.csv` | 132 valeurs mensuelles de cumul | Série `precipitation` affichée en mm/mois. |

## Conversion et contrôle numérique

`precipitation_Douala.csv` correspond à `precipitation_Douala_GPM.csv` multiplié mois par mois par le nombre de jours calendaires du mois. La comparaison des 132 lignes donne un écart numérique maximal inférieur à 1e‑12 mm. La transformation est documentée par `fix_gpm_units.py`; ce contrôle établit la relation numérique entre les deux fichiers actuels, sans reconstituer chaque étape historique de leur transfert.

Les unités ont des significations différentes : `mm/jour` est un taux moyen journalier, tandis que `mm/mois` est un cumul approximatif obtenu par multiplication du taux mensuel par la durée du mois. Ne pas tracer ces valeurs sur une même échelle ou les appeler toutes « cumul ».

Pour recréer l’export GPM agrégé ou le fichier corrigé, examiner les chemins et les fichiers de sortie définis par les scripts avant exécution; certains utilitaires historiques écrivent un fichier suffixé `_mm.csv` et ne remplacent pas automatiquement le CSV canonique chargé par l’API.

## Différence avec MERRA‑2 et NASA POWER

Le NetCDF MERRA‑2 `M2TMNXFLX_5_12_4_PRECTOT` contient une moyenne de flux en `kg m⁻² s⁻¹`; il n’est pas la source numérique du CSV GPM. La variable POWER `PRECTOTCORR` est un produit distinct, fourni quotidiennement en mm/jour puis agrégé mensuellement dans `precipitation_Douala_POWER_monthly.csv`. Aucun de ces produits ne doit être substitué silencieusement à un autre.

Le dashboard n’affiche ni risque d’inondation ni mesure par quartier à partir de ces séries de précipitation agrégées.
