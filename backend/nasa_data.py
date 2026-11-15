# Ce module charge et contrôle les séries mensuelles CSV fournies avec le dépôt.
"""Chargeur de séries climatiques locales, avec provenance et limites explicites."""

# Le lecteur CSV utilise pandas déjà déclaré parmi les dépendances du backend.
import numpy as np  # Vérifie que toutes les valeurs numériques sont finies.
# pandas lit les colonnes de date, secteur et mesure des séries mensuelles.
import pandas as pd  # Conserve les données dans un tableau filtrable en mémoire.
# Path construit des chemins relatifs au dépôt, indépendants du dossier courant.
from pathlib import Path  # Évite les anciens chemins absolus propres à une machine.
# Any décrit les métadonnées JSON hétérogènes renvoyées par l’API.
from typing import Any  # Maintient des annotations compatibles avec les structures du catalogue.

# Le parent du répertoire backend correspond à la racine du dépôt.
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]  # Rend le lancement local indépendant de l’emplacement du terminal.
# Les CSV prétraités et versionnés restent la source tabulaire unique du dashboard.
CSV_DIRECTORY = REPOSITORY_ROOT / "nasa-data" / "csv"  # Ne modifie ni ne duplique les fichiers source.

# Ce catalogue liste les séries mensuelles canoniques, y compris les dérivations quotidiennes documentées.
DATA_CATALOG: dict[str, dict[str, Any]] = {  # Les clés servent d’identifiants stables dans l’API et le frontend.
    # Le CSV température est associé au produit MERRA‑2 T2M selon les noms et notes du dépôt.
    "temperature": {  # Cette série concerne l’air à deux mètres, pas une température de surface.
        # Le nom du fichier identifie l’export local retenu pour cette variable.
        "filename": "temperature_Douala.csv",  # Le contrat attendu est date,value,sector.
        # Ce titre distingue T2M de la température de surface LST.
        "label": "Température de l’air à 2 m",  # Ne pas présenter T2M comme une mesure directe au sol.
        # Le produit MERRA‑2 est un produit de réanalyse, pas une observation directe par satellite.
        "source": "NASA MERRA‑2 · T2M mensuel (vérifié contre le NetCDF archivé)",  # La source et la conversion sont maintenant contrôlées sur les 132 mois.
        # La variable T2M désigne la température de l’air à deux mètres dans la documentation du dépôt.
        "variable": "T2M",  # Les attributs d’unité du NetCDF doivent confirmer la conversion stockée en CSV.
        # Les nombres du CSV sont conservés tels quels et affichés selon l’unité documentée par le dépôt.
        "unit": "°C",  # Les valeurs du CSV égalent le NetCDF T2M en kelvins moins 273,15.
        # La granularité mensuelle correspond aux 132 dates enregistrées dans le CSV.
        "aggregation": "Moyenne mensuelle; conversion NetCDF de K en °C",  # Le CSV reproduit la moyenne mensuelle du produit source.
        # La résolution MERRA‑2 est trop grossière pour interpréter des contrastes de quartier.
        "spatial_resolution": "Grille MERRA‑2 d’environ 0,5° × 0,625° (ordre de grandeur 55–70 km)",  # Cette résolution reste une indication produit.
        # Le nom et les scripts du dépôt déclarent une série de température sur Douala.
        "provenance_note": "Les 132 valeurs sont égales au NetCDF MERRA‑2 T2M moins 273,15 K (écart numérique < 1e-12 °C). Produit de réanalyse, pas mesures de station.",  # La comparaison a été faite ligne par ligne sur toute la période.
        # Les coordonnées représentent le point de référence agrégé fourni par le projet.
        "latitude": 4.05,  # Elles ne représentent pas un polygone de quartier.
        # Cette longitude est utilisée uniquement pour centrer le marqueur agrégé sur Douala.
        "longitude": 9.75,  # Le CSV ne contient pas de coordonnées par observation.
        # Le thème colore la variable sans encoder sa valeur dans une fausse rasterisation.
        "color": "#e48a21",  # La carte affiche un marqueur agrégé, pas une couche continue.
        # Une décimale reflète la présentation des séries en degrés Celsius.
        "precision": 1,  # Les valeurs originales ne sont pas arrondies par l’API.
    },  # La source température reste distincte de celle des précipitations.
    # Les statistiques et scripts du dépôt identifient le CSV principal de pluie comme une conversion GPM corrigée.
    "precipitation": {  # Cette attribution explique la conversion mensuelle appliquée au taux quotidien.
        # Le fichier principal contient l’export mensuel retenu par le frontend.
        "filename": "precipitation_Douala.csv",  # Les valeurs correspondent aux statistiques du GPM corrigé documenté.
        # Ce libellé décrit la mesure et l’unité d’accumulation mensuelle.
        "label": "Précipitations mensuelles",  # L’agrégat ne fournit pas de mesures par quartier.
        # Le nom du fichier et les statistiques du dépôt identifient le CSV comme cumul GPM corrigé.
        "source": "NASA GPM IMERG · cumul mensuel dérivé du taux journalier",  # Les valeurs correspondent au taux GPM multiplié par les jours du mois.
        # La série dérive d’un taux de précipitation journalier agrégé à l’échelle mensuelle.
        "variable": "Précipitations",  # Le CSV ne conserve pas le nom original de la variable NetCDF.
        # Le fichier principal contient des accumulations mensuelles corrigées, en millimètres.
        "unit": "mm/mois",  # Le CSV GPM séparé reste en mm/jour et n’est pas utilisé ici.
        # La conversion du dépôt multiplie le taux moyen mensuel par le nombre de jours du mois.
        "aggregation": "Taux journalier moyen × jours du mois, selon fix_gpm_units.py",  # Ce n’est pas une somme de mesures journalières indépendantes.
        # La documentation GPM indique une maille d’environ un dixième de degré.
        "spatial_resolution": "Grille GPM IMERG d’environ 0,1° (ordre de grandeur 11 km)",  # La série du CSV demeure un agrégat unique pour Douala.
        # Les documents du dépôt associent le fichier de pluie corrigé à GPM, malgré un nom de fichier générique.
        "provenance_note": "Les 132 valeurs correspondent à precipitation_Douala_GPM.csv × jours du mois (écart numérique < 1e-12). Cette série GPM n’est pas le PRECTOT MERRA‑2 du NetCDF.",  # La comparaison confirme la conversion sans confondre les produits.
        # Le point d’affichage est un repère de ville, pas le centroïde certifié d’un pixel GPM.
        "latitude": 4.05,  # La valeur mensuelle ne localise pas un quartier précis.
        # Le point d’affichage est un repère de ville, pas une coordonnée observée dans chaque ligne CSV.
        "longitude": 9.75,  # Le marqueur est explicitement présenté comme indicatif.
        # Le bleu distingue visuellement les précipitations de la température.
        "color": "#0876b9",  # La couleur ne remplace pas la légende et l’unité.
        # Les millimètres mensuels sont affichés sans décimales dans les cartes métriques.
        "precision": 0,  # La valeur numérique source reste conservée dans les réponses API.
    },  # La série GPM cumulée reste distincte des autres produits de pluie.
    # Le NetCDF MERRA-2 PRECTOT est publié comme une série indépendante.
    "precipitation_merra2": {  # Le dataset ne remplace aucune entrée GPM ou POWER.
        # Le nom désigne le CSV converti depuis le fichier NetCDF versionné.
        "filename": "precipitation_Douala_MERRA2_monthly.csv",  # Le fichier suit le contrat date,value,sector.
        # Le libellé identifie la source dans le sélecteur d’indicateurs du frontend.
        "label": "Précipitations mensuelles MERRA-2",  # Le cumul est exprimé en équivalent d’eau par mois.
        # La source identifie l’export Giovanni et le produit de réanalyse versionné.
        "source": "NASA Giovanni · MERRA-2 M2TMNXFLX v5.12.4",  # La réanalyse ne constitue pas une mesure de station.
        # Le code de variable vient des attributs NetCDF source.
        "variable": "PRECTOT · total surface precipitation",  # Il s’agit d’un flux moyen converti, pas de PRECTOTCORR.
        # La série convertie exprime un cumul équivalent à l’échelle du mois.
        "unit": "mm/mois",  # 1 kg m-2 d’eau correspond à 1 mm d’épaisseur.
        # Les moyennes de flux sont intégrées sur la durée exacte de chaque intervalle mensuel.
        "aggregation": "Flux moyen mensuel × secondes du mois; 1 kg m⁻² d’eau = 1 mm",  # Le convertisseur utilise les bornes time_bnds.
        # Les coordonnées du NetCDF correspondent à une grille MERRA-2 beaucoup plus grossière que des quartiers.
        "spatial_resolution": "Grille MERRA-2 0,5° × 0,625° (≈55–70 km); cellule analysée à 10°E, 4°N",  # L’export est agrégé et ne distingue aucun quartier.
        # La note documente la conversion, la période et la limite spatiale exacte de la source.
        "provenance_note": "NetCDF MERRA-2 M2TMNXFLX v5.12.4, PRECTOT (132 mois, 2015–2025). Flux moyen mensuel multiplié par les secondes exactes des bornes puis arrondi à 6 décimales. Zone demandée 9,70–9,78°E / 4,05–4,14°N; métadonnées: analyse limitée à la cellule 10°E, 4°N. Produit de réanalyse, distinct de GPM et PRECTOTCORR POWER.",  # Le repère cartographique ne représente pas une mesure de quartier.
        # Le point analysé indiqué par les métadonnées du produit est utilisé pour positionner le marqueur.
        "latitude": 4.0,  # Ce point est un repère de cellule, pas un centroïde administratif de Douala.
        # La longitude correspond au point de grille retenu par l’export.
        "longitude": 10.0,  # La résolution reste indiquée pour éviter une fausse précision locale.
        # Une couleur indépendante distingue ce produit des séries GPM et POWER.
        "color": "#3b7d92",  # La couleur ne code pas une anomalie ou un niveau de risque.
        # Une décimale suffit pour la comparaison mensuelle à l’échelle de la cellule MERRA-2.
        "precision": 1,  # Le CSV conserve six décimales et l’API retourne ces valeurs sans arrondi.
    },  # La série MERRA-2 est exposée sans toucher aux mesures GPM/POWER.
    # Le second export GPM conserve un taux moyen journalier et reste distinct du cumul mensuel corrigé.
    "precipitation_rate": {  # Comparer ce taux avec un cumul mensuel serait une erreur d’unité.
        # Le nom du fichier identifie l’export mensuel du taux quotidien moyen GPM.
        "filename": "precipitation_Douala_GPM.csv",  # Ce fichier contient 132 moyennes mensuelles du taux journalier.
        # Le titre rappelle qu’il s’agit d’un taux et non d’une accumulation mensuelle.
        "label": "Taux moyen de précipitation",  # La série est utile pour inspecter le CSV GPM séparé.
        # La documentation locale identifie cet export comme taux moyen GPM en mm/jour.
        "source": "NASA GPM IMERG · moyenne mensuelle du taux journalier (dépôt)",  # La période et la zone proviennent de l’export source.
        # Le fichier ne contient pas de code de variable NetCDF réutilisable.
        "variable": "mean_GPM_3IMERGDL_07_precipitation",  # Le nom d’export reste documenté sans prétendre à un cumul.
        # L’export GPM correspondant a une moyenne journalière, pas mm/mois.
        "unit": "mm/jour",  # Garder l’unité évite de confondre ce taux avec la série corrigée.
        # Le convertisseur local agrège les valeurs quotidiennes par mois en moyenne.
        "aggregation": "Moyenne des taux journaliers par mois, CSV fourni",  # La conversion en cumul n’est pas appliquée dans cette série.
        # La grille GPM IMERG est plus fine que le produit MERRA‑2.
        "spatial_resolution": "Grille GPM IMERG d’environ 0,1° (ordre de grandeur 11 km)",  # La série reste un agrégat de zone.
        # La documentation distingue ce CSV en mm/jour du CSV mensuel corrigé.
        "provenance_note": "Taux GPM moyen exprimé en mm/jour; ne pas l’interpréter comme cumul mensuel ni le comparer directement à la série corrigée.",  # La réserve d’unité est affichée dans l’interface.
        # Les coordonnées indiquent le centre de référence Douala du projet.
        "latitude": 4.05,  # Le point sert uniquement au repère cartographique.
        # La longitude indique le même repère de ville.
        "longitude": 9.75,  # Aucun pixel ou quartier n’est déterminé par cette coordonnée.
        # Le violet permet de distinguer le taux journalier des précipitations cumulées.
        "color": "#6745ca",  # La teinte ne code ni incertitude ni qualité.
        # Trois décimales sont utiles pour préserver l’échelle numérique des taux journaliers.
        "precision": 3,  # Les nombres CSV originaux sont conservés par l’API.
    },  # Le jeu distinct est soumis aux mêmes contrôles que les autres CSV.
    # Le premier produit du CSV NASA POWER ajoute une série T2M quotidienne à la source régionale NetCDF existante.
    "temperature_power": {  # Cette série NASA POWER ponctuelle est distinguée de l’agrégat régional précédent.
        # Le fichier normalisé est recréé depuis le CSV quotidien par le script de conversion documenté.
        "filename": "temperature_Douala_POWER_monthly.csv",  # Le fichier brut reste conservé à côté des séries canoniques.
        # Le libellé indique le produit et le niveau de mesure.
        "label": "Température de l’air à 2 m (NASA POWER)",  # T2M désigne l’air, pas une température de surface.
        # Le fichier source identifie le champ quotidien comme MERRA-2 T2M via NASA POWER.
        "source": "NASA POWER · MERRA‑2 T2M quotidien",  # Le produit de réanalyse n’est pas une observation de station.
        # Le nom de variable suit exactement l’en-tête du CSV téléchargé.
        "variable": "T2M",  # La mesure source est donnée en degrés Celsius.
        # La température conserve l’unité annoncée dans l’en-tête NASA POWER.
        "unit": "°C",  # La conversion en kelvins n’est pas nécessaire pour cette source.
        # La série mensuelle est la moyenne des observations T2M quotidiennes du même mois.
        "aggregation": "Moyenne des valeurs quotidiennes T2M par mois",  # Le script refuse les jours manquants.
        # Le fichier précise la maille MERRA-2 qui sous-tend le point NASA POWER.
        "spatial_resolution": "Grille MERRA‑2 0,5° × 0,625°; point 4,05°N, 9,70°E",  # Cette maille ne distingue pas les quartiers.
        # La note relie la sortie mensuelle au fichier brut et à sa couverture validée.
        "provenance_note": "Dérivé de POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv : 4 018 jours complets, 2015–2025; heure solaire locale. MERRA‑2 est une réanalyse, pas une mesure de station.",  # Aucun jour manquant ni code -999 n’a été détecté.
        # Le marqueur affiche le point de requête NASA POWER indiqué dans son en-tête.
        "latitude": 4.05,  # Il reste un repère et non une mesure par quartier.
        # La longitude reprend le point de requête déclaré dans le fichier source.
        "longitude": 9.70,  # La maille MERRA‑2 demeure beaucoup plus large que la ville.
        # Le turquoise distingue la série POWER de la série T2M régionale.
        "color": "#118c89",  # La teinte identifie la provenance sans coder une valeur.
        # Une décimale suit la précision d’affichage de la température.
        "precision": 1,  # Les valeurs plus précises restent disponibles dans la série CSV.
    },  # La série ponctuelle reste séparée de l’export régional précédent.
    # Le second produit du CSV NASA POWER expose le taux quotidien corrigé en cumul mensuel.
    "precipitation_power": {  # Cette série n’est pas assimilée au CSV GPM déjà présent.
        # Le fichier normalisé est généré par somme des précipitations quotidiennes.
        "filename": "precipitation_Douala_POWER_monthly.csv",  # Le CSV brut conserve PRECTOTCORR en mm/jour.
        # Le libellé précise le cumul mensuel et la provenance du produit.
        "label": "Précipitations mensuelles corrigées (NASA POWER)",  # L’indicateur reste distinct du taux journalier GPM.
        # L’en-tête NASA POWER attribue PRECTOTCORR au produit MERRA-2.
        "source": "NASA POWER · MERRA‑2 PRECTOTCORR",  # Cette variable corrigée diffère de PRECTOT du NetCDF archivé.
        # Le nom suit le code de variable utilisé dans le CSV téléchargé.
        "variable": "PRECTOTCORR",  # L’export brut indique une unité quotidienne en mm/jour.
        # Les valeurs mensuelles sont des accumulations exprimées en millimètres.
        "unit": "mm/mois",  # Le backend n’affiche pas ces valeurs comme des taux journaliers.
        # La somme mensuelle est construite à partir des valeurs quotidiennes en mm/jour.
        "aggregation": "Somme des valeurs quotidiennes PRECTOTCORR (mm/jour) par mois",  # Le script conserve les mois sans interpolation.
        # Le fichier précise la maille MERRA-2 qui sous-tend le point NASA POWER.
        "spatial_resolution": "Grille MERRA‑2 0,5° × 0,625°; point 4,05°N, 9,70°E",  # Aucune précision intra-urbaine n’est disponible.
        # La note donne le fichier de départ, le nombre de jours et la différence de produit.
        "provenance_note": "Dérivé de POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv : 4 018 jours complets, 2015–2025; somme des valeurs mm/jour par mois. Distinct de PRECTOT NetCDF et des séries GPM.",  # Le produit reste une réanalyse MERRA‑2.
        # Le marqueur reprend le point de requête NASA POWER documenté.
        "latitude": 4.05,  # Ce repère ne représente pas un pixel de quartier.
        # La longitude reprend l’emplacement déclaré dans l’en-tête POWER.
        "longitude": 9.70,  # La maille est plus grossière que les limites communales.
        # Le bordeaux différencie ce cumul des deux autres séries de précipitations.
        "color": "#a94f79",  # La couleur ne remplace ni la source ni l’unité affichées.
        # Une décimale permet de lire les cumuls sans prétendre à une précision instrumentale accrue.
        "precision": 1,  # Les six décimales du CSV dérivé restent conservées par l’API.
    },  # Le cumul POWER est soumis aux mêmes validations que les autres séries.
}  # Les composites MODIS NDVI/EVI sont servis à part, pas comme séries mensuelles climatiques.

# La fonction charge et valide tous les fichiers de la configuration au démarrage de l’API.
def load_datasets() -> dict[str, pd.DataFrame]:  # Le dashboard échoue explicitement si une source canonique manque.
    # Le dictionnaire conserve un DataFrame en mémoire par variable publiée.
    datasets: dict[str, pd.DataFrame] = {}  # Les requêtes API ne relisent pas les fichiers disque à chaque appel.
    # Chaque entrée du catalogue est vérifiée indépendamment avant de servir le frontend.
    for kind, metadata in DATA_CATALOG.items():  # L’identifiant relie le CSV aux sélecteurs de l’interface.
        # Le chemin est construit depuis la racine du dépôt et non depuis /home/user.
        csv_path = CSV_DIRECTORY / str(metadata["filename"])  # Les mêmes chemins fonctionnent en local et dans le Sandbox.
        # Une source absente bloque le démarrage au lieu de substituer une simulation silencieuse.
        if not csv_path.is_file():  # Le dashboard n’a aucun repli local de données.
            # Le message mentionne le chemin attendu pour accélérer le diagnostic.
            raise FileNotFoundError(f"CSV requis absent pour {kind}: {csv_path}")  # La correction se fait sur les fichiers de données.
        # Le moteur CSV lit explicitement la série versionnée du dépôt.
        frame = pd.read_csv(csv_path)  # Les données ne sont ni générées ni enrichies artificiellement.
        # Les trois colonnes constituent le contrat minimum du dataset mensuel.
        required_columns = {"date", "value", "sector"}  # Une colonne manquante est une erreur de source.
        # La validation évite les réponses partielles dues à un CSV d’un autre format.
        missing_columns = required_columns.difference(frame.columns)  # L’API énonce la liste des colonnes non trouvées.
        # Un fichier incompatible doit être corrigé plutôt que deviné.
        if missing_columns:  # Le chargeur n’essaie pas de déduire un nom de champ alternatif.
            # La liste est triée pour rendre le message stable entre exécutions.
            raise ValueError(f"Colonnes requises absentes de {csv_path.name}: {sorted(missing_columns)}")  # Le chemin source reste visible dans l’erreur.
        # La conversion de date refuse les libellés qui ne sont pas interprétables.
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")  # Les NaT sont rejetés lors de la vérification suivante.
        # Les valeurs numériques illisibles deviennent NaN pour permettre une validation explicite.
        frame["value"] = pd.to_numeric(frame["value"], errors="coerce")  # Aucune ligne invalide n’est silencieusement supprimée.
        # Un secteur vide empêcherait le filtre de lieu partagé de fonctionner correctement.
        frame["sector"] = frame["sector"].astype("string").str.strip()  # Les libellés transmis à l’API sont normalisés sans fusion.
        # Les dates et valeurs doivent être présentes et toutes les mesures finies.
        valid = frame["date"].notna() & frame["value"].notna() & frame["sector"].notna() & frame["sector"].ne("") & np.isfinite(frame["value"])  # Cette règle empêche les NaN et les infinis d’atteindre les graphiques.
        # Les sources sont rejetées avec le nombre de lignes invalides afin de préserver leur traçabilité.
        if not bool(valid.all()):  # Le chargeur ne fait aucune imputation.
            # Le compte précise l’étendue du problème sans exposer les valeurs erronées.
            raise ValueError(f"{csv_path.name} contient {int((~valid).sum())} ligne(s) date/valeur/secteur invalide(s)")  # Une réparation doit être faite dans le CSV ou son pipeline.
        # Les observations doivent être mensuelles afin d’utiliser un filtre de dates cohérent.
        frame["date"] = frame["date"].dt.to_period("M").dt.to_timestamp()  # Les dates sont normalisées au premier jour du mois.
        # Un mois et un secteur ne peuvent identifier qu’une mesure dans la source agrégée.
        if bool(frame.duplicated(subset=["date", "sector"]).any()):  # Les doublons ne sont ni moyennés ni supprimés en cachette.
            # L’erreur précise le fichier qui doit être dédupliqué et documenté.
            raise ValueError(f"{csv_path.name} contient des mois dupliqués pour un même secteur")  # Le contrôle s’applique à chaque variable.
        # Le tri chronologique rend les réponses API et les exports reproductibles.
        datasets[kind] = frame.sort_values(["date", "sector"]).reset_index(drop=True)  # La source CSV reste la seule origine des valeurs.
    # Les DataFrames validés sont retournés sans altérer les fichiers d’origine.
    return datasets  # Les routes partagent exactement ce même cache de séries.

# Le cache réel est rempli à l’import afin que l’état API corresponde aux fichiers servis.
DATASETS = load_datasets()  # Une source manquante ou invalide empêche le backend de démarrer.

# Les zones publiées proviennent des secteurs réellement présents dans les séries chargées.
SECTORS = sorted({str(sector) for frame in DATASETS.values() for sector in frame["sector"].unique()})  # Aucun faux quartier n’est exposé par l’API.

# Cette fonction construit des métadonnées API enrichies des plages mesurées dans chaque fichier.
def public_catalog() -> dict[str, dict[str, Any]]:  # Le catalogue conserve la provenance au même niveau que la série.
    # Le dictionnaire de réponse est distinct de la configuration statique.
    result: dict[str, dict[str, Any]] = {}  # Une copie empêche une route de modifier le contrat global.
    # Chaque dataset expose son intervalle réellement disponible et son nombre de lignes.
    for kind, metadata in DATA_CATALOG.items():  # Les dates ne sont jamais prolongées au-delà du CSV.
        # Le DataFrame contient les valeurs validées par load_datasets.
        frame = DATASETS[kind]  # Une seule mesure par secteur et par mois a été vérifiée.
        # La série triée fournit ses dates minimale et maximale réelles.
        first_date = frame["date"].min()  # Une date vide est impossible après validation du chargement.
        # La dernière ligne détermine le dernier mois source disponible.
        last_date = frame["date"].max()  # Aucune date future extrapolée n’est ajoutée.
        # Les métadonnées publiques associent la source déclarée à sa période et à son nombre de lignes réels.
        result[kind] = {**metadata, "kind": kind, "sectors": sorted(frame["sector"].unique().tolist()), "start": first_date.strftime("%Y-%m"), "end": last_date.strftime("%Y-%m"), "record_count": int(len(frame))}  # Les mois présents sont comptés dans la période filtrée, sans score de couverture.
    # Le catalogue JSON final ne contient pas de chemins machine absolus.
    return result  # Le frontend affiche les noms de fichiers comme référence relative.

# La fonction sérialise la série sans convertir ni arrondir ses valeurs source.
def records_for(kind: str, sector: str | None = None, start: str | None = None, end: str | None = None) -> list[dict[str, Any]]:  # Les filtres temporels sont inclusifs au mois.
    # Le dataset inconnu déclenche une erreur que la couche API transforme en HTTP 404.
    if kind not in DATASETS:  # Les variables absentes comme NDVI ne sont pas reconstituées.
        # Une erreur nommée évite de renvoyer une série vide qui semble valide.
        raise KeyError(f"Dataset indisponible: {kind}")  # Le client ne doit pas deviner une variable manquante.
    # La copie isolée empêche les filtres de modifier le cache partagé.
    frame = DATASETS[kind].copy()  # L’API conserve l’ordre chronologique.
    # Le filtre zone doit correspondre à une valeur présente dans la source réelle.
    if sector and sector not in frame["sector"].unique():  # Les faux libellés de quartiers sont refusés.
        # Le message fournit les choix réels exposés par le catalogue.
        raise ValueError(f"Secteur indisponible: {sector}; choix réels: {sorted(frame['sector'].unique().tolist())}")  # Une valeur libre ne crée jamais une zone artificielle.
    # Le DataFrame est limité à la zone choisie lorsqu’elle est explicitement fournie.
    if sector:  # Le secteur Douala est unique dans les fichiers courants.
        # Le filtre conserve seulement les lignes portant le secteur réel demandé.
        frame = frame[frame["sector"] == sector]  # Les mesures urbaines agrégées restent distinctes de quartiers.
    # Une borne mensuelle est comparée à des libellés YYYY-MM du catalogue.
    if start:  # Une borne absente laisse intacte la partie ancienne de la série.
        # Le premier jour du mois garde la période complète inclusive.
        frame = frame[frame["date"].dt.strftime("%Y-%m") >= start[:7]]  # Les dates client peuvent être YYYY-MM ou YYYY-MM-DD.
    # La date de fin inclut tout le mois correspondant au filtre.
    if end:  # Une borne absente laisse intacte la partie récente de la série.
        # Le tri garantit que cette sélection ne dépend pas de l’ordre physique du CSV.
        frame = frame[frame["date"].dt.strftime("%Y-%m") <= end[:7]]  # Aucun décalage en UTC n’altère le mois sélectionné.
    # Les champs retournés sont les seules colonnes contractuelles du frontend.
    return [{"date": row.date.strftime("%Y-%m-%d"), "sector": str(row.sector), "value": float(row.value)} for row in frame.itertuples(index=False)]  # La conversion en float conserve la précision numérique stockée.
