# Audit du dashboard — préparation au NASA Space Apps Challenge

- **Date :** 2026-11-15
- **Périmètre audité :** branche `arena/00f3c473-douala-earth-watchers-public`, commit `57944cf`
- **Méthode :** lecture du code, exécution réelle de la stack (FastAPI `:8000` + Vite `:5173`), appels aux 13 routes, `npm test`, `npm run typecheck`, `npm run build`, `unittest`, calculs de contrôle sur les CSV
- **Grille de lecture :** les cinq critères officiels du jury Space Apps — **Impact, Créativité, Validité, Pertinence, Présentation** (1 à 5)

> Compréhension du contexte : « NASA APP CHALLENGE » est interprété comme le **NASA Space Apps Challenge** (hackathon, évaluation locale puis globale sur ces cinq critères). Si votre format est un autre concours, la hiérarchie ci-dessous reste valable, seuls les poids changent.

---

## 1. Verdict en une page

Le produit est **techniquement sain et intellectuellement honnête**, mais il n'est **pas encore un projet de hackathon** : c'est un **catalogue de données bien documenté**, pas une **solution à un problème**.

| Critère jury | État actuel | Note | Commentaire synthétique |
|---|---|---:|---|
| **Impact** | Faible | **2 / 5** | Aucun problème utilisateur formulé, aucun bénéficiaire nommé, aucune action rendue possible. La conclusion visible du dashboard est « alertes indisponibles ». |
| **Créativité** | Faible-moyenne | **2,5 / 5** | Un dashboard climatique mono-ville, 6 séries de même nature, un Ridge/RandomForest sur 132 points mensuels. Rien qu'un autre concurrent ne fasse avec les mêmes données. |
| **Validité** | Bonne sur la méthode, fragile sur les données | **3 / 5** | Backtest chronologique propre, empreintes SHA-256, aucune valeur inventée : remarquable. Mais données arrêtées au 2025-12-31, sans date de récupération, biais pluie ~ −32 %, et **aucune vérité terrain**. |
| **Pertinence (challenge)** | Non démontrée | **2 / 5** | Aucun challenge NASA officiel n'est cité dans le dépôt, aucun parcours utilisateur, aucun lien avec la décision publique locale. |
| **Présentation** | Moyenne | **3 / 5** | Interface soignée et cohérente, mais 100 % francophone, démarrage en deux terminaux, **pas d'URL publique**, pas de vidéo/pitch, message dominant négatif. |

**Ce qui est déjà excellent (à garder absolument) :** distinction rigoureuse GPM / MERRA-2 / POWER, refus explicite des valeurs fictives, backtest à origines glissantes sans fuite temporelle, persistance + baseline saisonnière systématiques, exports reproductibles, messages de limite visibles dans l'UI.

**Ce qui bloque une qualification :** le dashboard ne répond à aucune des trois questions que se pose un utilisateur réel — *« Que se passe-t-il ? », « Est-ce anormal ? », « Que dois-je faire ? »* Il répond seulement à *« Quelles données existe-t-il, et quelles sont leurs limites ? »*

---

## 2. Ce que le dashboard fait réellement (constaté à l'exécution)

| Élément vérifié | Résultat observé |
|---|---|
| API FastAPI | Démarre, `/api/health` → 6 jeux chargés, 13 routes actives |
| Frontend | Vite 8.1.5 démarre, proxy `/api` → `:8000` OK, page servie |
| Tests frontend | 14 tests / 4 fichiers, **tous verts** |
| `npm run typecheck` | Aucune erreur |
| `npm run build` | Succès (client 5,7 Mo) |
| Tests backend | 15 tests `unittest`, **tous verts** |
| Portée des tests backend | `climate_ml` + `daily_forecast` uniquement — **aucun test de route HTTP** |
| Données | 6 séries × 132 mois (2015-01 → 2025-12), 1 seul secteur « Douala », 0 valeur manquante, puces incohérentes détectées (voir §3.3) |
| Backtest J+1→J+3 | Ridge MAE 0,496 / 0,551 / 0,568 °C, meilleur que persistance et baseline saisonnière sur 2025 |
| Forecast actuel | `insufficient_data`, liste vide (correct, mais c'est **le** message que voit le visiteur) |
| MODIS DV | 254 composites ; **253/254 portent le masque « Ocean coastlines and lake shorelines »** ; 230/254 classés nuageux |
| Laboratoire ML | Fonctionne (Ridge sur CSV test, 2,5 s) ; ne donne **aucun jeu d'exemple** — le visiteur doit fournir son propre CSV |

---

## 3. Limites bloquantes pour le Space Apps

### 3.1 Impact : le produit ne raconte aucune histoire

1. **Aucun problème énoncé.** Le README décrit un pipeline, pas un enjeu. À Douala : inondations récurrentes, étiage du Wouri, chaleur humide, santé publique, agriculture périurbaine — aucun n'est nommé, mesuré, ni relié à une donnée affichée.
2. **Aucun utilisateur cible.** Pas de persona, pas d'entretien utilisateur, pas d'organisation partenaire (CUD, MINEPDED, Croix-Rouge camerounaise, universités). Le jury Space Apps valorise explicitement la recherche utilisateur et le potentiel de réplication.
3. **Aucune action possible.** Le dashboard permet de visualiser, filtrer, exporter. Il ne permet pas de décider. La seule fonction « décisionnelle » — les seuils exploratoires — est présentée comme non officielle et porte sur **une observation datée du 2025-12-31**.
4. **Le message dominant est négatif.** Sur la page d'accueil : « Données et usages indisponibles — aucune valeur simulée ». Sur `/previsions` : « Aucune valeur future n'est publiée », « alertes officielles : indisponibles ». Cette honnêteté est admirable scientifiquement, mais un jury retient d'abord l'impression d'un produit inachevé.
5. **Aucune preuve d'usage.** Pas d'analytics, pas de retours utilisateurs, pas de scénario d'utilisation documenté, pas d'étude de cas (ex. « épisode pluvieux de 2022-09 reconstitué dans l'outil »).

### 3.2 Créativité : le périmètre est celui d'un catalogue

1. **Six séries, quatre quasi redondantes.** `temperature` et `temperature_power` sont deux MERRA-2 T2M au même point (r = 1,00 ; écart moyen 0,05 °C). `precipitation` et `precipitation_rate` sortent du **même** fichier GPM (vérifié : `rate × jours = cumul`, écart max 0,0). En pratique : **2 informations température + 3 informations pluie**, présentées comme 6 produits.
2. **Aucune vue comparative.** Impossible d'afficher deux séries sur le même graphique, ni un climatogramme, ni un cumul annuel, ni un classement des années. Or c'est ce qu'un décideur regarde.
3. **Aucune analyse climatique minimale.** Pas de normales (1991-2020), pas d'anomalie, pas de tendance ni de test statistique, pas de détection de rupture, pas d'indice d'intensité pluvieuse. Le seul chiffre « dérivé » est une moyenne/min/max de la sélection.
4. **La carte n'apporte rien.** Un point unique à 4,05 °N / 9,75 °E, sans raster ni polygone ; elle est explicitement bridée quand plusieurs secteurs sont sélectionnés. Elle consomme **4,5 Mo de JavaScript (Plotly)** pour afficher un marqueur.
5. **L'IA est un comparateur, pas un atout.** Ridge et forêt aléatoire sur 6 features (`sin/cos`, tendance, 3 retards) et 132 points ; validation sur 12 à 36 origines. Sur la température mensuelle de Douala, **la persistance et la saisonnière sont des concurrents difficiles** : l'apport démontré est marginal et honnêtement signalé comme exploratoire. Aucun recours à un modèle géospatial, à de l'imagerie, à du traitement du signal, ni à une donnée réellement nouvelle.

### 3.3 Validité : la plus grosse réserve du projet

**a) Les données ne sont pas actuelles, et ce n'est pas daté.**
- Dernière observation : **2025-12-31** — soit ~11 mois avant cet audit ; ~320 jours au moment de l'audit interne du 2026-10-18.
- `retrieved_at` vaut `None` dans **tous** les artefacts (`daily_forecast.py`, `climate_ml.py`). Aucun `fetched_at` nulle part.
- Conséquence : l'application est, par construction, **incapable de dire si elle est à jour**. En hackathon, un produit qui affiche « données insuffisantes » au premier écran sera pénalisé même si c'est rigoureux.

**b) Les produits de pluie divergent fortement, sans arbitrage.**
Calcul de contrôle sur les 132 mois :

| Série | Cumul annuel moyen | Min / max annuel | Écart au climat observé (~3 600 mm/an) |
|---|---:|---:|---|
| MERRA-2 PRECTOT | **3 542 mm** | 3 206 – 4 312 | cohérent |
| GPM IMERG (cumul dérivé) | **2 451 mm** | 2 073 – 2 970 | **−32 %** |
| POWER PRECTOTCORR | **2 408 mm** | 1 726 – 3 246 | **−33 %** |

Un utilisateur peut lire, dans la même interface, **2 400 mm et 3 540 mm pour la même ville et la même année**. Le dashboard documente que les produits sont distincts — mais **ne signale pas que deux d'entre eux sous-estiment massivement** le cumul, et n'indique pas lequel croire. Pour un jury « Best Use of Science », c'est la première question posée.

Aggravant : la conversion `PRECTOTCORR (mm/jour, moyenne journalière) × jours du mois` **lisse les événements intenses**. Le pic à **1 000,7 mm en 2022-09** (série POWER) contre **342,5 mm** en GPM illustre un artefact de moyenne quotidienne, pas une pluie réelle de 1 m en un mois.

**c) Aucune vérité terrain.** Aucune station (Douala Aéroport, société météo nationale, pluviomètres universitaires) n'est comparée aux produits. Le backtest mesure la *prévisibilité d'un produit*, pas *l'exactitude sur Douala*. L'incertitude est explicitement « non quantifiée » — donc aucun intervalle, aucune calibration, aucun test de significativité sur les écarts de MAE.

**d) Le backtest repose sur une seule saison de test.** Test terminal = 2025 uniquement, soit N = 364 / 363 / 362 jours. Aucun second millésime, aucune moyenne sur plusieurs années : un résultat favorable sur 12 mois peut être un hasard. Le gain vs persistance (0,496 vs 0,562 °C) est réel mais modeste et non testé statistiquement.

**e) L'archive MODIS est inutilisable comme indicateur de végétation.** Contrôle direct : **253 des 254 composites** ont le statut `Ocean coastlines and lake shorelines`, et seulement 1 porte `Land`. Le pixel d'extraction est donc en grande partie sur l'eau ; les NDVI plafonnent à 0,25 (végétation tropicale attendue : 0,6 – 0,9). Présenter cette archive comme « végétation observée » invite le jury à la question piège « pourquoi votre NDVI est-il celui de l'estuaire ? ».

**f) Le laboratoire ML est un test technique, pas une fonctionnalité.**
- Aucun fichier d'exemple → le visiteur qui veut essayer doit fabriquer un CSV de ≥ 60 mois consécutifs. Friction maximale en démo.
- L'utilisateur doit **attester lui-même** que ses données sont réelles (case à cocher) : la provenance n'est pas vérifiable, donc les résultats ne sont pas opposables.
- Les projections démarrent au-delà de la dernière date du CSV : sur les CSV fournis, elles sont **dans le passé**.

**g) Le seuil exploratoire porte sur une donnée périmée** et renvoie « non officiel / non actuel ». En l'état, cet outil ne peut déclencher aucune action.

### 3.4 Pertinence : pas de lien avec un challenge NASA

1. **Aucun challenge officiel n'est cité.** Ni dans le README, ni dans `docs/`. Le jury évalue pourtant « pertinence par rapport au challenge choisi ».
2. **Écosystème NASA sous-exploité.** L'app n'interroge **jamais** une API NASA en direct : tout passe par des scripts `requests` lancés à la main, puis des CSV versionnés. Aucun Earthdata, aucune CMR temps réel, aucun GIBS, aucune Worldview, aucun SMAP/GEDI/VIIRS/Landsat/Sentinel exploité — alors que le hackathon est précisément un exercice d'« open data NASA ».
3. **Pas d'articulation locale.** Douala n'a **aucun découpage administratif** dans le dépôt (aucun GeoJSON). Impossible de dire « quartier X », alors que les inondations à Douala sont très localisées (Bonabéri, Bépanda, Nkololoun…).
4. **Le parcours central est un audit de données**, pas une réponse. Un juge doit lire 2 onglets et un `docs/` de 544 lignes pour comprendre l'intérêt.

### 3.5 Présentation : bonne facture, obstacles concrets à la démo

1. **Langue unique : français.** Ni le README, ni l'UI, ni les messages d'erreur ne sont traduits — barrière directe pour des juges internationaux et pour la phase de jugement global.
2. **Pas d'URL publique.** L'application exige **deux processus** (`uvicorn` + `vite`), un venv Python et Node 20+. Aucun Dockerfile, aucun `docker-compose`, aucun déploiement (Vercel/Netlify/Fly.io), aucune GitHub Action. Un jury qui veut « cliquer sur la démo » ne le peut pas.
3. **Pas de livrables de pitch.** Aucune vidéo, aucun script de 2 minutes, aucune capture, aucun `pitch.md`, aucune présentation.
4. **Le ton du texte nuit.** Métadonnées visibles à l'écran du type « vérifié contre le NetCDF archivé », « ne pas déduire du nom ou de la date du fichier » : c'est un ton de note d'audit, pas de produit.
5. **Densité visuelle et charge.** Plotly 4,5 Mo + Recharts + 200 Ko d'image en barre latérale ; 5,7 Mo de JS client pour **792 points de données** (6 × 132). L'indicateur « professionnalisme/performance » peut être interrogé sur mobile.
6. **Rendu serveur vide.** La page renvoyée par le serveur ne contient que l'écran « Chargement des observations » → aucun contenu pour un crawler, un aperçu de lien, un screenshot automatique.
7. **Accessibilité partielle mais non auditée** : pas de test axe, contrastes non mesurés, une palette unique pour la carte (jaune–rouge) sans alternative daltonienne.

### 3.6 Technique et « readiness » (impressionnent un jury technique)

| Constat | Preuve / impact |
|---|---|
| **`app.py` à la racine est cassé** | `python3 app.py` → `FileNotFoundError: frontend/app.py`. Le point d'entrée historique est mort. |
| **Licence incohérente** | `frontend/LICENSE` = MIT **« Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) »**, héritée d'un template. Aucune licence racine. Juridiquement faux pour ce dépôt. |
| **CORS ouvert à tous** | `allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]` en production. |
| **Aucun test des routes HTTP** | 15 tests backend couvrent ML et backtest ; `main.py` (323 lignes, 13 routes) n'a aucun test. |
| **Aucune CI** | Pas de `.github/workflows`. Les 4 commandes de vérification du README sont manuelles. |
| **Aucune conteneurisation** | Pas de Dockerfile ; `LANCER.bat` ne lance que le frontend (et suppose le backend déjà démarré sur `:8000`). |
| **Dépendances externes non maîtrisées** | Google Fonts en CDN, fond OSM, Plotly chargé à la demande : 3 points de rupture en démo hors ligne/instable. |
| **Pas de persistance / pas de comptes** | Aucun historique de seuils, aucun utilisateur, aucun partage. L'état des filtres **n'est pas dans l'URL** → impossible d'envoyer un lien « Douala, pluie, 2022 ». |
| **Pas d'export image** | Seul CSV. Un journaliste ne peut pas récupérer une figure propre. |
| **Poids de dépôt** | 5,7 Mo de build + ~1 Mo de NetCDF + 292 Ko de backtest, sans Git LFS ni stockage externe déclaré (le dossier `google_drive/` est ignoré). |
| **Documentation trop dense pour un jury** | `README` de 14 Ko + `docs/` de 544 lignes : excellent pour un audit, dissuasif pour une évaluation en 10 minutes. |

---

## 4. Les 5 corrections à plus fort effet jury (effort / gain)

| Priorité | Action | Effet attendu | Effort |
|---|---|---|---|
| **1** | **Rendre les données actuelles.** Automatiser une récupération NASA POWER / GPM (script déjà présent, à brancher sur un `cron` ou une GitHub Action quotidienne), enregistrer `retrieved_at`, et faire afficher « données au JJ/MM/AAAA » sur chaque écran. Le forecast J+1→J+3 devient alors publiable. | Débloque **Validité + Impact** ; supprime le message « données insuffisantes » qui domine l'accueil. | 1 à 2 j |
| **2** | **Ajouter la couche décision.** Anomalie vs normales, classement des années, cumul annuel, saisonnalité, et 2–3 indicateurs d'action (jours de pluie > seuil, cumul 3 jours, épisode sec/chaud) reliés à un bénéficiaire nommé. | Débloque **Impact + Créativité + Pertinence** ; le dashboard devient une réponse, pas un catalogue. | 2 à 3 j |
| **3** | **Trancher la question des produits.** Afficher la comparaison inter-produits (déjà calculable) et signaler explicitement le biais GPM/POWER vs MERRA-2, ou masquer les séries redondantes derrière un mode « expert ». | Répond à la question piège du jury **Validité** et transforme une faiblesse en démonstration de rigueur. | 0,5 à 1 j |
| **4** | **Mettre le produit en ligne en anglais.** Dockerfile unique servant frontend + API, déploiement public, `i18n` FR/EN, vidéo de 2 min + `pitch.md`, suppression de la licence Expo et du `app.py` mort. | Débloque **Présentation** ; conditionne l'accès au jugement. | 1 à 2 j |
| **5** | **Réparer la végétation ou l'assumer.** Changer le point d'extraction MODIS vers un pixel intérieur des terres, ou requalifier l'archive en « test de faisabilité » et la retirer de la navigation principale. | Neutralise une objection majeure de **Validité**. | 0,5 j |

**Ce qu'il ne faut pas faire :** ajouter d'autres séries, d'autres modèles ou d'autres pages. Le déficit est un déficit de **récit et de fraîcheur**, pas de volume.

---

## 5. Questions auxquelles le dashboard ne répond pas (test utilisateur rapide)

| Question d'un décideur / journaliste | Réponse possible aujourd'hui ? |
|---|---|
| « 2025 a-t-elle été plus chaude que la normale à Douala ? » | **Non** — aucune normale de référence, aucun calcul d'anomalie. |
| « Quelle a été l'année la plus pluvieuse ? » | **Non** — pas de cumul annuel, pas de classement. |
| « Combien de jours de pluie intense en août 2024 ? » | **Non** — seules des valeurs mensuelles sont exposées. |
| « Où, dans la ville, a-t-il le plus plu ? » | **Non** — un seul secteur agrégé, aucun découpage. |
| « Le niveau de crue est-il dangereux ? » | **Non** — aucune donnée hydrologique (Wouri, nappe, altitude). |
| « Que faire demain ? » | **Non** — forecast vide par construction. |
| « Puis-je partager cette analyse ? » | **Partiellement** — export CSV, mais pas d'URL d'état ni d'image. |
| « Qui suis-je censé être ? » | **Non documenté** — aucun persona. |

---

## 6. Conclusion

**Le socle est bon ; la démonstration ne l'est pas encore.**

Ce dépôt a deux qualités rares dans un hackathon : il **ne fabrique aucune donnée** et il **expose ses propres limites**. C'est exactement ce qu'un jury « Best Use of Science » veut vérifier — mais seulement **après** avoir compris pourquoi le projet existe. Aujourd'hui, le visiteur rencontre d'abord un écran de chargement, puis « alertes indisponibles », puis des séries arrêtées au 2025-12-31, et enfin un avertissement sur le biais spatial. La rigueur, qui devrait être l'argument final, arrive à la place de l'argument initial.

Trois chantiers suffisent à changer la trajectoire : **des données fraîches et datées**, **une couche d'analyse qui répond à une question réelle**, **un accès public en anglais avec un pitch de 2 minutes**. Sans eux, le projet restera un excellent audit technique ; avec eux, il devient un candidat crédible.

---

## Annexe — chiffres et preuves mesurés pendant cet audit

- Série : 132 mois × 6 fichiers, `2015-01 → 2025-12`, secteur unique `Douala`, 0 valeur manquante.
- `temperature` vs `temperature_power` : r = 1,00 ; écart moyen 0,046 °C (std 0,044), max 0,241 °C.
- `precipitation_rate × jours_du_mois − precipitation` : écart absolu max **0,0 mm** (même source).
- Cumuls annuels moyens : GPM 2 451 mm · POWER 2 408 mm · MERRA-2 PRECTOT 3 542 mm (climatologie de référence ≈ 3 600 mm).
- Valeur quotidienne maximale PRECTOTCORR : **229,49 mm le 2015-11-01** ; mois maximal : **1 000,74 mm en 2022-09** (GPM même mois : 342,5 mm).
- Backtest T2M : N = 364/363/362 ; Ridge MAE 0,4955 / 0,5505 / 0,5685 °C ; persistance 0,5616 / 0,6837 / 0,7322 ; saisonnière 0,7574 / 0,7569 / 0,7567. Test unique : 2025.
- MODIS DV : 254 composites (2014-12-19 → 2025-12-19) ; QA = 230 nuageux / 15 bons / 9 marginaux ; **masque = 253 océan, 1 terre** ; NDVI max 0,2483.
- Build frontend : 5,7 Mo (dont Plotly 4,5 Mo, Recharts ≈ 0,38 Mo, image 204 Ko).
- Tests : 14 frontend (Vitest) + 15 backend (unittest) verts ; 0 test de route API ; typecheck et build sans erreur.
- Points d'entrée/écueils : `app.py` → `FileNotFoundError` ; `frontend/LICENSE` = MIT Expo ; pas de `.github/`, pas de Dockerfile, `CORS allow_origins=["*"]`, état des filtres absent de l'URL, `retrieved_at = None` partout.
