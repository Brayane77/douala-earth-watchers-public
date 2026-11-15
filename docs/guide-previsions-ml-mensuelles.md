# Guide — évaluation ML exploratoire sur une série mensuelle

## Portée

La page `/previsions` propose un laboratoire d'évaluation sur un fichier CSV fourni manuellement. Il s'agit d'un scénario de modèle relatif à la dernière date de ce fichier. Il ne constitue pas un forecast météorologique actuel de Douala, ne complète pas le backtest quotidien T2M et ne produit aucun avis officiel.

L'API ne crée aucune observation historique et ne vérifie pas indépendamment la provenance du fichier. L'utilisateur déclare la source et le contexte; le rapport enregistre le nom du CSV et son empreinte SHA-256. L'application ne conserve pas le CSV, le modèle entraîné ni le rapport de run après la requête; le contenu peut être traité temporairement par le parseur multipart du serveur.

## Parcours dans l'interface

1. Ouvrir **Prévisions et alertes** et choisir un fichier `.csv` de 5 Mio maximum. Le dépôt n'entraîne aucun modèle.
2. Le navigateur lit uniquement la première ligne pour proposer les colonnes. Choisir explicitement la colonne de dates et la variable numérique.
3. Cocher la confirmation que le CSV contient des observations réelles et non des valeurs synthétiques. Cette déclaration n'est pas vérifiée indépendamment par l'application.
4. Vérifier le séparateur de champs (virgule, point-virgule ou tabulation) et le séparateur décimal (point ou virgule). Ces choix sont transmis à l'API.
5. Si le fichier contient plusieurs séries, saisir la valeur exacte de la colonne `sector`; sans filtre, une série doit déjà contenir une seule ligne par mois.
6. Définir la provenance, l'unité, l'agrégation et la résolution si elles sont connues. Les champs laissés vides restent signalés comme non déclarés/non précisés.
7. Choisir un candidat (`random_forest` ou `ridge`), un horizon de 1 à 24 mois et 12, 24 ou 36 origines glissantes de validation.
8. Cliquer sur **Évaluer et produire le scénario**. Ce POST explicite entraîne les modèles, calcule les baselines et crée une projection récursive.
9. Examiner les scores par horizon, leurs N, périodes d'origine et périodes cibles, le graphique, les valeurs/dates projetées et les comparaisons détaillées. Télécharger le rapport JSON ou un CSV qui reprend métriques et lignes affichées.

## Contrat de données et contrôles

- Le CSV doit contenir au minimum 60 et au maximum 1 200 mois, continus, avec une valeur finie déjà agrégée par mois.
- Les dates doivent être valides; les mois sont normalisés au premier jour de leur mois calendaire. Les mois en double, absents ou sans mesure numérique sont refusés. Il n'y a ni dédoublonnage par moyenne, ni zéro, ni interpolation, ni imputation.
- Le plafond de taille côté API est de 5 Mio. Le téléversement est effectué en mémoire et limité avant le parsing.
- La période de données, le nombre d'enregistrements, la dernière observation, les colonnes, le filtre sectoriel, le modèle, ses paramètres, les versions numériques, les périodes de validation et les empreintes du CSV et du code sont conservés dans le rapport.
- Une série déclarée comme mensuelle ne garantit pas sa validité scientifique. L'origine, les méthodes d'agrégation, l'unité et l'échelle spatiale doivent être vérifiées par l'utilisateur.

## Protocole temporel

Pour une série de `n` mois, un horizon `H` et `K` origines terminales, les origines couvrent les `K` derniers mois qui disposent encore de toutes les cibles jusqu'à `H`. À chaque origine `t`, les caractéristiques et l'apprentissage sont limités aux lignes connues à `t`; le modèle prédit récursivement `t+1` à `t+H`. Une cible observée plus tard ne peut pas être utilisée dans les retards, l'entraînement ou la prédiction de cette origine. Il n'y a aucun mélange aléatoire des dates.

Toutes les origines sont évaluées sur les observations réelles déjà présentes dans le fichier. Le N est indiqué par horizon; les dates cibles et les dates d'origine sont aussi publiées par horizon, car elles ne sont pas identiques lorsque l'horizon change. Le modèle final est ensuite entraîné sur l'historique complet et produit exactement `H` valeurs futures; ces valeurs restent des prédictions et n'entrent jamais dans l'historique d'observations.

Le nombre de mois minimal réellement requis dépend de `H` et `K` (au moins `35 + H + K` pour garantir 24 exemples d'apprentissage après création des retards). Une série peut donc satisfaire le minimum général de 60 mois et être néanmoins trop courte pour la combinaison demandée.

## Métriques et comparateurs

Pour chaque horizon, le rapport affiche MAE, RMSE et N en unité déclarée; aucune MAPE en °C, précision arbitraire ou incertitude artificielle n'est calculée.

- **Candidat** : forêt aléatoire (100 arbres, profondeur maximale 5, feuille minimale 2, graine fixe) ou régression Ridge (`alpha=10`). Caractéristiques : mois cyclique, index temporel, retards 1 et 12 et moyenne des trois derniers mois.
- **Persistance** : conserve à chaque échéance la dernière observation connue à l'origine.
- **Saisonnière** : reprend la dernière observation passée du même mois calendaire, disponible à l'origine. Si une série ne rend pas ce comparateur calculable, le N, la période et la raison sont signalés sans inventer de valeur.

Les scores n'établissent pas une supériorité générale du candidat. Les origines proviennent d'un même CSV et ne sont pas une validation indépendante par station ou par produit officiel.

## Interprétation et limites

- La projection commence après la dernière date fournie, pas après la date du jour. Si le CSV est ancien, certaines dates projetées peuvent déjà être passées; son calendrier ne la rend pas actuelle. Les coordonnées éventuelles du CSV ne sont pas extrapolées aux quartiers.
- T2M, lorsqu'elle est la variable choisie, désigne la température de l'air à 2 m seulement si la source du CSV le documente; le nom de colonne ne suffit pas à l'établir. Aucune fusion avec MODIS/DV, T2M quotidien ou backtest existant n'est réalisée.
- Aucune plage ou probabilité d'incertitude n'est fournie. Une projection récursive peut accumuler des erreurs, en particulier pour les horizons longs.
- Les modèles ne sont pas réglés automatiquement par recherche d'hyperparamètres; deux candidats, fixés et versionnés, sont proposés comme outils exploratoires.
- Les fichiers fournis par l'utilisateur ne sont pas gardés dans une base, un cache partagé ou une archive du dépôt. Les téléchargements sont produits localement à partir du rapport rendu à l'écran.
- Aucun calcul de modèle n'a lieu au chargement de page; les routes d'état des prévisions actuelles et des alertes restent séparées.

## API

`POST /api/ml/evaluate` accepte un multipart/form-data contenant `file`, `date_col`, `value_col`, `delimiter`, `decimal_mark`, `confirm_real_observations`, `sector_filter`, `horizon`, `validation_origins`, `model_type`, `source`, `unit`, `aggregation` et `resolution`. Le booléen obligatoire est une attestation utilisateur; il ne constitue pas une vérification automatique de la provenance.

La réponse de schéma 2 comprend `status`, `is_current=false`, `is_official=false`, `source`, `target`, `configuration`, `code_sha256`, `run_id`, `history`, `latest_observation`, `validation.metrics_by_horizon`, `validation.predictions`, `forecast_origin` et `forecast`. Chaque comparaison de validation conserve l'origine, la date cible, l'horizon, la valeur observée, le candidat, les deux baselines et le nombre d'exemples d'apprentissage. L'empreinte source porte sur les octets du fichier transmis; le contexte déclaré est informatif et n'est pas une vérification de provenance.

## Vérifications

Depuis la racine du dépôt :

```bash
.venv/bin/python -m unittest backend.tests.test_climate_ml -v
cd frontend && npm test -- --run src/components/MonthlyMlLab.test.tsx
cd frontend && npm run typecheck
```

Les tests d'intégration utilisent le CSV réel `nasa-data/csv/temperature_Douala.csv`; le test d'interface vérifie qu'un dépôt seul ne déclenche aucun POST et que la soumission transmet les choix de date, variable, horizon et modèle.
