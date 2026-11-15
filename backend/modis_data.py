"""Charge l’archive MODIS AppEEARS séparément du catalogue climatique mensuel."""

# Les chemins et le JSON permettent de vérifier la provenance sans dépendre du dossier courant.
import json  # Lit la requête AppEEARS et le manifeste versionné.
from datetime import datetime  # Convertit les dates AppEEARS sans modifier leurs heures.
from pathlib import Path  # Construit des chemins portables vers les données du dépôt.
from typing import Any  # Type le payload riche renvoyé séparément de l’API mensuelle.

# NumPy vérifie la finitude de chaque valeur numérique du CSV.
import numpy as np  # Les valeurs infinies ne doivent pas atteindre l’API.
# Pandas lit les colonnes du CSV AppEEARS en conservant les valeurs exportées.
import pandas as pd  # Les composites restent des observations de 16 jours, sans interpolation.

# La racine du dépôt est déterminée depuis le fichier source de ce module.
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]  # Aucun chemin machine absolu n’est nécessaire.
# Les exports MODIS occupent un sous-dossier distinct des CSV climatiques mensuels.
MODIS_DIRECTORY = REPOSITORY_ROOT / "nasa-data" / "modis" / "DV"  # Le catalogue T2M/GPM ne charge pas cette fréquence.
# Le CSV est le résultat ponctuel original fourni par AppEEARS.
RESULTS_PATH = MODIS_DIRECTORY / "DV-MOD13Q1-061-results.csv"  # Les colonnes QA du produit restent disponibles.
# Le JSON donne le point et la période réellement demandés à AppEEARS.
REQUEST_PATH = MODIS_DIRECTORY / "DV-request.json"  # Les coordonnées sont contrôlées avant de servir les valeurs.
# Le manifeste conserve le lien Drive, le hash et les limites de l’extraction.
MANIFEST_PATH = MODIS_DIRECTORY / "manifest.json"  # Les champs de provenance ne sont pas inférés depuis les valeurs.

# Ces noms de champs sont ceux de l’export MOD13Q1.061 conservé sans renommage.
CSV_COLUMNS = {  # Le chargeur échoue explicitement si l’export ne respecte pas son schéma.
    "date": "Date",  # La date correspond au début du composite AppEEARS.
    "latitude": "Latitude",  # La latitude du point doit correspondre à la requête DV.
    "longitude": "Longitude",  # La longitude du point doit correspondre à la requête DV.
    "ndvi": "MOD13Q1_061__250m_16_days_NDVI",  # NDVI est livré à la fréquence native de 16 jours.
    "evi": "MOD13Q1_061__250m_16_days_EVI",  # EVI reste distinct de NDVI et conserve son champ d’origine.
    "qa_rank": "MOD13Q1_061__250m_16_days_pixel_reliability",  # Le rang QA résumé reste attaché à chaque composite.
    "qa_label": "MOD13Q1_061__250m_16_days_pixel_reliability_MODLAND_Description",  # La description lisible est fournie par l’export.
    "vi_quality": "MOD13Q1_061__250m_16_days_VI_Quality_MODLAND_Description",  # La qualité détaillée du produit reste visible.
    "land_water_mask": "MOD13Q1_061__250m_16_days_VI_Quality_Land/Water_Mask_Description",  # Le contexte côtier n’est pas masqué.
}  # Aucun indice végétal n’est mélangé aux mesures T2M ou aux précipitations.

# Convertit les dates de la requête AppEEARS au format ISO utilisé par l’API.
def _appeears_date(value: str) -> str:  # Le format source est mois-jour-année.
    # datetime valide le texte et rend explicite la convention source.
    return datetime.strptime(value, "%m-%d-%Y").date().isoformat()  # La fonction ne convertit pas le jour du composite.

# Charge, contrôle et sérialise l’archive MODIS comme une source d’observation distincte.
def load_douala_modis() -> dict[str, Any]:  # Cette fonction n’ajoute aucune valeur à la série quotidienne T2M.
    # Vérifie la présence des trois artefacts nécessaires à l’intégration.
    for required_path in (RESULTS_PATH, REQUEST_PATH, MANIFEST_PATH):  # Le XML original est conservé pour consultation humaine.
        # Une source absente est signalée plutôt que remplacée par des données simulées.
        if not required_path.is_file():  # L’API ne fabrique pas un catalogue MODIS incomplet.
            # Le message fournit le chemin exact attendu dans le dépôt.
            raise FileNotFoundError(f"Fichier MODIS requis absent : {required_path}")  # La réparation porte sur l’archive versionnée.

    # Lit les métadonnées de requête et le manifeste de provenance en UTF-8.
    request = json.loads(REQUEST_PATH.read_text(encoding="utf-8"))  # Les coordonnées sont vérifiées avant le CSV.
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))  # Le hash et l’état de la requête sont conservés.
    # Lit le CSV original sans convertir les valeurs NDVI/EVI une seconde fois.
    frame = pd.read_csv(RESULTS_PATH)  # Les champs d’index restent ceux de l’export AppEEARS.

    # Vérifie que la requête décrit bien une seule extraction ponctuelle.
    coordinates = request.get("params", {}).get("coordinates", [])  # Une extraction de zone nécessiterait un autre traitement.
    # Le manifeste et la requête doivent identifier l’export archivé comme DV.
    if request.get("task_name") != "DV" or manifest.get("task_name") != "DV":  # Une autre tâche ne doit pas être servie par cette route.
        # Une identité discordante rend l’association source/CSV non fiable.
        raise ValueError("Le manifeste et la requête ne désignent pas tous deux la tâche AppEEARS DV.")  # Aucun nom de fichier seul ne suffit comme provenance.
    # Le point doit être exactement celui demandé près de Douala.
    if len(coordinates) != 1 or float(coordinates[0].get("latitude", float("nan"))) != 4.05 or float(coordinates[0].get("longitude", float("nan"))) != 9.70:  # Les coordonnées du JSON sont la référence de contrôle.
        # Refuse de publier comme Douala un export mal géolocalisé.
        raise ValueError("L’extraction MODIS DV ne correspond pas au point demandé 4,05°N, 9,70°E.")  # Les archives mal géolocalisées restent exclues.
    # Vérifie que les empreintes géographiques du manifeste correspondent à la requête.
    if float(manifest.get("latitude", float("nan"))) != 4.05 or float(manifest.get("longitude", float("nan"))) != 9.70:  # Un manifeste divergent bloque le chargement.
        # Le contrôle empêche une modification silencieuse du point de mesure.
        raise ValueError("Les coordonnées du manifeste MODIS ne concordent pas avec la requête AppEEARS.")  # La résolution du point reste un seul pixel.

    # Liste les colonnes indispensables aux valeurs, à la période et aux contrôles qualité.
    required_columns = set(CSV_COLUMNS.values())  # Les autres colonnes originales sont conservées dans le CSV archivé.
    # Compare les champs attendus aux en-têtes réellement reçus.
    missing_columns = required_columns.difference(frame.columns)  # Aucun alias n’est déduit automatiquement.
    # Refuse l’export si une couche qualité ou valeur principale est absente.
    if missing_columns:  # NDVI/EVI sans QA ne seraient pas présentés comme validés.
        # Le message liste les en-têtes attendus mais manquants.
        raise ValueError(f"Colonnes MODIS absentes : {sorted(missing_columns)}")  # La correction doit se faire à la source.

    # Convertit les dates puis les mesures numériques avec des erreurs explicites.
    frame[CSV_COLUMNS["date"]] = pd.to_datetime(frame[CSV_COLUMNS["date"]], errors="coerce")  # Une date illisible n’est pas supprimée.
    # Convertit latitude, longitude, indices et rang QA en nombres contrôlables.
    for key in ("latitude", "longitude", "ndvi", "evi", "qa_rank"):  # Les colonnes texte de QA restent inchangées.
        # La conversion non valide devient une valeur manquante détectable.
        frame[CSV_COLUMNS[key]] = pd.to_numeric(frame[CSV_COLUMNS[key]], errors="coerce")  # Aucun facteur d’échelle n’est appliqué ici.
    # Rassemble les colonnes numériques dont chaque observation doit disposer.
    numeric_columns = [CSV_COLUMNS[key] for key in ("latitude", "longitude", "ndvi", "evi", "qa_rank")]  # Les valeurs originales sont servies telles qu’exportées.
    # Refuse une ligne incomplète, une date invalide ou une valeur non finie.
    numeric_valid = frame[numeric_columns].notna().all(axis=1) & np.isfinite(frame[numeric_columns].to_numpy(dtype=float)).all(axis=1)  # Les indicateurs QA ne sont pas imputés.
    # Les dates et textes QA doivent aussi être présents avant sérialisation.
    text_valid = frame[CSV_COLUMNS["date"]].notna() & frame[CSV_COLUMNS["qa_label"]].notna() & frame[CSV_COLUMNS["land_water_mask"]].notna()  # Les étiquettes proviennent du fichier source.
    # Le rang de fiabilité doit être un entier reconnu par MOD13Q1.
    rank = frame[CSV_COLUMNS["qa_rank"]]  # Les rangs manquants et hors domaine sont rejetés.
    # Les valeurs admises incluent -1 pour no-data et 0 à 3 pour les états QA du produit.
    rank_valid = rank.isin([-1, 0, 1, 2, 3]) & (rank % 1 == 0)  # Les classes qualité ne sont pas reclassées arbitrairement.
    # Chaque ligne doit correspondre au point demandé dans le JSON AppEEARS.
    location_valid = frame[CSV_COLUMNS["latitude"]].eq(4.05) & frame[CSV_COLUMNS["longitude"]].eq(9.70)  # L’API ne prétend pas couvrir les quartiers.
    # Les quatre contrôles sont combinés sans retirer silencieusement de lignes.
    valid_rows = numeric_valid & text_valid & rank_valid & location_valid  # Une ligne invalide bloque la source complète.
    # Une ligne incorrecte doit être réparée ou explicitement exclue avant toute publication.
    if not bool(valid_rows.all()):  # Le chargement ne masque aucune anomalie du CSV brut.
        # Le compte d’erreurs aide à corriger l’archive sans exposer une trace complète.
        raise ValueError(f"Le CSV MODIS contient {int((~valid_rows).sum())} ligne(s) invalide(s).")  # L’utilisateur peut retrouver le fichier source.
    # Trie les composites pour que l’API et les exports soient reproductibles.
    frame = frame.sort_values(CSV_COLUMNS["date"]).reset_index(drop=True)  # Le tri ne change pas les dates de validité.
    # Chaque date ne doit identifier qu’un seul composite pour le point.
    if bool(frame[CSV_COLUMNS["date"]].duplicated().any()):  # Les doublons ne sont ni moyennés ni dédupliqués en cachette.
        # Le message indique précisément le problème temporel détecté.
        raise ValueError("Le CSV MODIS contient plusieurs lignes pour une même date composite.")  # Une nouvelle extraction doit être contrôlée.

    # Lit la fenêtre demandée dans la requête originale AppEEARS.
    requested_period = request.get("params", {}).get("dates", [])  # La période de demande est distincte de la couverture exportée.
    # Refuse une requête qui ne décrit pas exactement une période.
    if len(requested_period) != 1:  # La route est conçue pour le fichier DV actuel.
        # Une requête récurrente ou multi-période nécessite un manifeste séparé.
        raise ValueError("La requête AppEEARS DV doit contenir une seule fenêtre de dates.")  # Les fenêtres sont documentées explicitement.
    # Convertit les bornes de requête depuis le format AppEEARS.
    requested_start = _appeears_date(requested_period[0]["startDate"])  # Le début demandé n’est pas la première composite retournée.
    # Convertit la borne finale demandée au format ISO.
    requested_end = _appeears_date(requested_period[0]["endDate"])  # La fin demandée n’est pas nécessairement une date de composite.
    # Compte les rangs QA en utilisant le CSV plutôt qu’une valeur codée dans l’interface.
    rank_counts = {  # L’ensemble complet des classes du produit reste visible.
        "no_data": int(rank.eq(-1).sum()),  # Le rang -1 est conservé comme absence de donnée si présent.
        "good": int(rank.eq(0).sum()),  # Le rang 0 désigne les données de bonne qualité.
        "marginal": int(rank.eq(1).sum()),  # Le rang 1 demande de consulter les autres QA.
        "snow_ice": int(rank.eq(2).sum()),  # Le rang 2 signale neige ou glace selon le produit.
        "cloudy": int(rank.eq(3).sum()),  # Le rang 3 indique une cible couverte ou non visible.
    }  # Ces effectifs décrivent la QA, pas une performance de prévision.
    # Compte chaque classe de masque terre/eau sans fusionner les libellés AppEEARS.
    mask_counts = {str(label): int(count) for label, count in frame[CSV_COLUMNS["land_water_mask"]].value_counts(dropna=False).items()}  # Le masque côtier reste une limite de représentativité.

    # Construit une ligne API par composite et garde NDVI, EVI et QA ensemble.
    observations = [  # Aucune interpolation ni resampling quotidien n’est effectué.
        {  # Chaque enregistrement représente une observation composite ponctuelle.
            "date": row[CSV_COLUMNS["date"]].strftime("%Y-%m-%d"),  # La date du produit est le début de la période composite.
            "ndvi": float(row[CSV_COLUMNS["ndvi"]]),  # La valeur reste telle qu’exportée par AppEEARS.
            "evi": float(row[CSV_COLUMNS["evi"]]),  # EVI est servi séparément de NDVI.
            "qa_rank": int(row[CSV_COLUMNS["qa_rank"]]),  # Le rang numérique permet un filtrage ultérieur explicite.
            "qa_label": str(row[CSV_COLUMNS["qa_label"]]),  # La description humaine vient de la couche QA.
            "vi_quality": str(row[CSV_COLUMNS["vi_quality"]]),  # La qualité détaillée MODLAND accompagne le pixel.
            "land_water_mask": str(row[CSV_COLUMNS["land_water_mask"]]),  # La classe côtière n’est pas cachée à l’interface.
        }  # Les coordonnées partagées sont décrites une seule fois dans les métadonnées.
        for row in frame.to_dict(orient="records")  # L’ordre chronologique est déjà imposé par le tri.
    ]  # L’API ne convertit pas les composites en série quotidienne.

    # Vérifie que le nombre réel de lignes concorde avec le manifeste archivé.
    if len(observations) != int(manifest.get("record_count", -1)):  # Le nombre ne peut pas être remplacé par un compte attendu.
        # Une différence entre CSV et manifeste bloque la publication.
        raise ValueError("Le nombre de composites MODIS ne concorde pas avec le manifeste.")  # La source et son empreinte doivent rester cohérentes.
    # Construit les métadonnées de cette observation séparée du catalogue mensuel.
    metadata = {  # Les valeurs de fraîcheur et les limites restent accessibles au client.
        "dataset_id": "DV",  # Le nom est celui de la tâche AppEEARS, pas un code de forecast.
        "product": str(request.get("params", {}).get("layers", [{}])[0].get("product", "MOD13Q1.061")),  # Le produit est conservé avec sa version.
        "source": "NASA AppEEARS · MODIS/Terra MOD13Q1.061",  # Ce produit n’est pas une mesure de station.
        "latitude": 4.05,  # Le point de l’extraction est situé près de Douala.
        "longitude": 9.70,  # La valeur ne décrit pas les autres pixels ou quartiers.
        "requested_start": requested_start,  # La période demandée est distincte des dates exportées.
        "requested_end": requested_end,  # Une composite antérieure peut être incluse par AppEEARS.
        "start": observations[0]["date"],  # La première date effective provient du CSV trié.
        "end": observations[-1]["date"],  # La dernière date effective provient du CSV trié.
        "record_count": len(observations),  # Le nombre de dates composites réelles est exposé.
        "spatial_resolution_m": 250,  # Le produit MOD13Q1 a une résolution nominale de 250 m.
        "temporal_resolution_days": 16,  # Les composites ne sont pas des observations quotidiennes.
        "value_units": "indices sans unité",  # NDVI/EVI ne sont pas des températures ou des précipitations.
        "values_as_exported": True,  # Aucune seconde mise à l’échelle n’est effectuée par le backend.
        "quality_counts": rank_counts,  # Les comptes sont calculés à partir du CSV brut.
        "land_water_mask_counts": mask_counts,  # Le masque de l’eau et du littoral reste traçable.
        "request_status": str(request.get("status", "unknown")),  # Le JSON d’origine conserve le statut processing.
        "readme_completed_at": manifest.get("readme_completed_at"),  # Le README et le JSON de requête donnent des statuts discordants.
        "status_warning": "Le JSON indique processing tandis que le README signale une fin de traitement et que le CSV existe; confirmer dans AppEEARS avant réutilisation.",  # Aucune validation externe du statut n’est prétendue.
        "model_eligible": False,  # Le produit reste exclu du MVP T2M tant que QA et gain prédictif ne sont pas évalués.
        "limitations": [  # Les avertissements sont servis avec les valeurs dans chaque réponse.
            "Observation ponctuelle MODIS en composite de 16 jours, pas une donnée quotidienne.",  # Ne pas interpoler entre composites.
            "La majorité des composites ont un rang QA cloudy et le masque identifie un pixel côtier.",  # Les valeurs faibles en qualité ne deviennent pas des observations fiables.
            "Aucune validation de performance ou de valeur prédictive additionnelle n’a été exécutée.",  # Les QA ne sont pas des métriques de forecast.
        ],  # Le frontend doit distinguer ces observations des prévisions T2M.
    }  # La réponse reste indépendante des séries mensuelles du dashboard.
    # Retourne la provenance, la couverture, les contrôles QA et les observations brutes.
    return {"source": "repository-modis-csv", "metadata": metadata, "observations": observations}  # Aucun score ou forecast n’est calculé.

# Charge le petit export au démarrage pour éviter tout travail à l’ouverture d’une page.
MODIS_DV = load_douala_modis()  # Les requêtes ne téléchargent rien et ne déclenchent aucun traitement lourd.
