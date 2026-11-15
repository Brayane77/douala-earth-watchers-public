# Douala Earth Watchers — Frontend

Frontend React 19 + TypeScript avec TanStack Start/Router, TanStack Query, Vite, Recharts et Plotly. Les routes `/`, `/sources`, `/previsions` et `/validation-scientifique` lisent le catalogue et les artefacts servis par FastAPI; le laboratoire mensuel accepte aussi un CSV fourni et une confirmation utilisateur explicite. Aucun modèle ne s’entraîne au chargement de la page et le frontend ne lance pas d’appel NASA.

## Lancement

Démarrer FastAPI à la racine du dépôt :

```bash
.venv/bin/uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000
```

Puis dans `frontend/` :

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

Vite relaie `/api` vers FastAPI sur `127.0.0.1:8000` par défaut. Pour un autre backend de développement, définir `API_PROXY_TARGET`, par exemple `API_PROXY_TARGET=http://127.0.0.1:8001 npm run dev -- --host 0.0.0.0`. Si l’API ou une série manque, l’interface affiche l’erreur au lieu d’utiliser une simulation. La carte Plotly affiche un seul point de référence sur fond OpenStreetMap, sans raster, valeur au clic ni interpolation spatiale.

## Fonctionnalités

- Le sélecteur « Série / produit » propose les six produits climatiques et l’archive MODIS `DV` comme option distincte.
- Pour les produits climatiques : filtres de secteur/période, au plus quatre indicateurs, graphique historique et export CSV synchronisés.
- Pour MODIS `DV` : affichage NDVI/EVI aux dates composites réelles; les filtres mensuels et indicateurs climatiques ne s’appliquent pas.
- Mode clair/sombre mémorisé dans le navigateur.
- Route `/sources` : métadonnées, provenance, période, unité, résolution et vérifications de cohérence.
- Route `/validation-scientifique` : rapport T2M pré-calculé, MAE/RMSE/N par horizon, comparaison à la persistance et à la baseline saisonnière, graphique 2025 et exports CSV/JSON.
- Route `/previsions` : laboratoire ML mensuel par dépôt CSV (confirmation observations réelles, choix des colonnes, séparateur, secteur, horizon 1–24 mois et modèle), validation chronologique sans fuite comparée aux baselines, scores MAE/RMSE/N/périodes, projection datée et exports JSON/CSV.
- Le laboratoire mensuel reste expérimental, non vérifié pour la provenance, sans incertitude artificielle, forecast actuel ou statut officiel; son calcul est déclenché uniquement par soumission.
- La même route conserve le statut explicite d’indisponibilité du forecast quotidien, l’état des alertes officielles et un formulaire de seuil exploratoire sans valeur par défaut.
- Les seuils exploratoires évaluent uniquement la dernière observation réelle archivée; l’interface indique sa date et précise que le résultat n’est pas actuel ni officiel.
- Section Végétation : nuage de points NDVI/EVI de l’archive `DV`, fréquences composites natives de 16 jours, QA affichée au survol et comptes qualité visibles.
- LST exploitable, forecast actuel, source officielle d’alertes et valeurs par quartier restent indisponibles; l’archive MODIS demeure séparée des séries climatiques.

L’export CSV du tableau de bord contient les lignes climatiques visibles après filtre; les exports ML JSON/CSV reprennent le rapport du calcul soumis; les exports scientifiques contiennent les lignes historiques du même backtest affiché. Les mois manquants restent absents; T2M désigne l’air à 2 m, pas la surface.

## Architecture

- `src/routes/index.tsx` : tableau de bord, filtres et indicateurs.
- `src/routes/sources.tsx` : page de traçabilité et de contrôles structurels.
- `src/routes/previsions.tsx` : laboratoire ML mensuel et statuts distincts du forecast actuel/alertes.
- `src/components/MonthlyMlLab.tsx` : formulaire CSV, résultats comparatifs, projection et exports du run.
- `src/lib/monthly-ml.ts` : contrat et envoi du formulaire d’évaluation exploratoire.
- `src/routes/validation-scientifique.tsx` : backtest quotidien historique, métriques par horizon, graphique et exports.
- `src/components/MapPanel.tsx` : carte Plotly et limites spatiales explicites.
- `src/components/VegetationPanel.tsx` : composites MODIS `DV` en nuage de points NDVI/EVI, sans ajout de dates.
- `src/components/ThemeToggle.tsx` : préférence de thème persistée.
- `src/lib/api.ts` : types, contrôle du contrat et chargement FastAPI.
- `src/lib/climate.ts` : filtres, statistiques, formatage et export CSV.
- `src/styles.css` : thème clair/sombre et mise en page responsive.
