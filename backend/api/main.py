# Routes FastAPI du catalogue climatique, de l’archive MODIS séparée et de l’évaluation exploratoire.
"""API FastAPI du tableau de bord Douala Earth Watchers.

Cette API sert les séries mensuelles CSV locales, l’archive MODIS et les artefacts
scientifiques pré-calculés :

- température MERRA-2 T2M et précipitations GPM IMERG, avec provenance qualifiée ;
- composites MODIS NDVI/EVI servis séparément à leur fréquence native de 16 jours ;
- backtest quotidien T2M versionné, calculé hors ligne et sans réentraînement HTTP ;
- statut sans forecast actuel et disponibilité des avis officiels explicitement absents ;
- seuils exploratoires sur la dernière observation et analyse mensuelle d’un CSV téléversé.

Aucune donnée téléversée n'est persistée : le fichier est traité en mémoire.
"""
# Importe les dépendances nécessaires à cette partie du programme.
from __future__ import annotations

# csv et io préparent des exports cohérents avec les lignes réellement servies.
import csv
import hashlib
import io
# Les types aident à garder les contrats d'API lisibles et validés.
from typing import Any, Literal

# pandas reste utilisé par les filtres temporels et l'évaluation exploratoire existante.
import pandas as pd
# Pydantic valide les requêtes de seuil avant toute évaluation.
from pydantic import BaseModel
# FastAPI expose les routes et les réponses CSV/JSON documentées.
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

# Importe les dépendances nécessaires à cette partie du programme.
from fastapi.middleware.cors import CORSMiddleware

# Importe les dépendances nécessaires à cette partie du programme.
# Importe les seules séries mensuelles du catalogue climatique.
from backend.nasa_data import DATASETS, SECTORS, public_catalog, records_for

# Charge l’archive MODIS ponctuelle à part, sans l’ajouter aux séries mensuelles T2M/GPM.
from backend.modis_data import MODIS_DV

# Les routes de forecast servent uniquement le backtest versionné pré-calculé.
from backend.daily_forecast import (
    current_forecast_status,
    evaluate_exploratory_threshold,
    load_backtest_artifact,
    official_alerts_status,
    validation_export_rows,
)

# L'artefact est vérifié une fois au démarrage; aucune page ne déclenche un entraînement.
DAILY_T2M_BACKTEST = load_backtest_artifact()

# Limite la taille du CSV traité en mémoire par la route d'expérimentation ML.
MAX_ML_UPLOAD_BYTES = 5 * 1024 * 1024

# Le module mensuel téléversé reste distinct du backtest quotidien NASA POWER.
from backend.climate_ml import evaluate_and_forecast, prepare_monthly_series


# Décrit un seuil explicitement choisi par l'utilisateur, sans valeur par défaut normative.
class ExploratoryThresholdRequest(BaseModel):
    """Contrat du test exploratoire sur la dernière observation archivée."""

    variable: Literal["T2M", "PRECTOTCORR"]
    operator: Literal["gt", "lt"]
    threshold: float

# Crée l'application FastAPI qui servira les données au frontend React.
app = FastAPI(title="Douala Earth Watchers API", version="1.0.0")

# Autorise les appels depuis d'autres origines, utile si le frontend est servi séparément.
app.add_middleware(
    # Autorise toutes les origines pour le développement local du MVP.
    CORSMiddleware,
    # Liste des origines autorisées : illimitée ici car la démo n'expose aucune donnée sensible.
    allow_origins=["*"],
    # Méthodes HTTP permises par l'API de démonstration.
    allow_methods=["*"],
    # En-têtes HTTP permis, sans restriction pour le prototype.
    allow_headers=["*"],
)  # Ferme la structure ouverte plus haut.

# Exécute la route de santé pour confirmer que le cache CSV réel a été chargé.
@app.get("/api/health")
# Retourne l’état et les sources disponibles sans résumer les valeurs scientifiques.
def health() -> dict[str, str]:
    # Indique que les CSV configurés ont été validés lors de l’import du module.
    return {"status": "ok", "source": "repository-csv", "datasets": ",".join(DATASETS)}


# Exécute la route de catalogue pour fournir les secteurs présents dans les CSV.
@app.get("/api/sectors")
# Retourne les emplacements réellement renseignés, sans secteurs cartographiques fictifs.
def sectors() -> dict[str, Any]:
    return {"sectors": SECTORS}  # Renvoie le résultat de cette étape à son appelant.


# Exécute le point de terminaison statique du catalogue avant la route variable.
@app.get("/api/data/catalog")
# Retourne la provenance, l’unité, les limites et la couverture observées des CSV.
def data_catalog() -> dict[str, Any]:
    # Le catalogue décrit les fichiers présents, sans publier leur chemin local absolu.
    return {"source": "repository-csv", "datasets": public_catalog(), "sectors": SECTORS}


# Expose les composites MODIS AppEEARS comme observations de végétation distinctes.
@app.get("/api/observations/modis-vegetation")
# Retourne NDVI/EVI avec QA et provenance, sans les convertir en fréquence quotidienne.
def modis_vegetation() -> dict[str, Any]:
    # Les 254 composites ont été vérifiés au chargement du module et restent inchangés.
    return MODIS_DV


# Sert l'état d'indisponibilité d'un forecast actuel sans extrapoler le snapshot historique.
@app.get("/api/forecasts/t2m-daily")
def daily_t2m_forecast_status() -> dict[str, Any]:
    """Retourne une liste future vide tant qu'une source fraîche et traçable manque."""
    return current_forecast_status(DAILY_T2M_BACKTEST)


# Expose le rapport de validation produit hors ligne et identifié par son run et ses empreintes.
@app.get("/api/validation/t2m-daily")
def daily_t2m_validation() -> dict[str, Any]:
    """Retourne le backtest terminal quotidien, ses scores et ses prédictions historiques."""
    return DAILY_T2M_BACKTEST


# Indique l'absence de flux officiel et les possibilités d'indicateurs à seuil configuré.
@app.get("/api/alerts/status")
def alerts_status() -> dict[str, Any]:
    """Distingue les avis officiels indisponibles des seuils exploratoires utilisateur."""
    return official_alerts_status(DAILY_T2M_BACKTEST)


# Évalue uniquement un seuil fourni par le client sur la dernière ligne archivée.
@app.post("/api/alerts/exploratory")
def exploratory_alert(payload: ExploratoryThresholdRequest) -> dict[str, Any]:
    """Renvoie un indicateur daté; aucune notification ou alerte officielle n'est créée."""
    try:
        return evaluate_exploratory_threshold(
            DAILY_T2M_BACKTEST,
            variable=payload.variable,
            operator=payload.operator,
            threshold=payload.threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# Télécharge les mêmes prédictions historiques que la page de validation scientifique.
@app.get("/api/validation/t2m-daily/export.csv")
def export_daily_t2m_validation_csv() -> Response:
    """Exporte toutes les lignes de validation avec origine, horizon et empreinte."""
    rows = validation_export_rows(DAILY_T2M_BACKTEST)
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="t2m-daily-backtest.csv"'},
    )


# Télécharge le manifeste complet utilisé par la route de validation.
@app.get("/api/validation/t2m-daily/export.json")
def export_daily_t2m_validation_json() -> JSONResponse:
    """Exporte les mêmes scores, lignes et métadonnées que la réponse JSON affichée."""
    return JSONResponse(
        content=DAILY_T2M_BACKTEST,
        headers={"Content-Disposition": 'attachment; filename="t2m-daily-backtest.json"'},
    )


# Vérifie les bornes mois avant de filtrer une ou plusieurs séries.
def _validate_months(start: str | None, end: str | None) -> None:
    # Le parseur Pandas rejette les dates qui ne peuvent désigner un mois.
    try:
        # Convertit une borne complète ou YYYY-MM en mois calendaire.
        first = pd.Period(start[:7], freq="M") if start else None
        # Convertit la borne de fin avec la même convention inclusive.
        last = pd.Period(end[:7], freq="M") if end else None
    # Convertit toute date mal formée en erreur de requête lisible.
    except (TypeError, ValueError) as exc:
        # La réponse 400 empêche qu’une plage invalide retourne silencieusement une liste vide.
        raise HTTPException(status_code=400, detail="Les dates doivent être au format YYYY-MM ou YYYY-MM-DD.") from exc
    # Une plage décroissante doit être corrigée par les contrôles de l’interface.
    if first is not None and last is not None and first > last:
        # La réponse décrit explicitement l’inversion des bornes.
        raise HTTPException(status_code=400, detail="Le début de période doit précéder sa fin.")


# Construit une réponse commune pour les routes de série et les anciennes intégrations.
def _dataset_payload(kind: str, sector: str | None, start: str | None, end: str | None) -> dict[str, Any]:
    # Vérifie les dates avant le filtrage qui suit.
    _validate_months(start, end)
    # Convertit une absence de variable en erreur HTTP 404 compréhensible.
    try:
        # Sérialise les lignes réelles à partir du cache construit depuis le CSV.
        data = records_for(kind, sector, start, end)
    # Les identifiants NDVI et autres non présents ne sont pas simulés à la volée.
    except KeyError as exc:
        # Le 404 distingue une variable indisponible d’une série vide.
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    # Transforme un secteur inexistant en erreur client plutôt qu’en faux résultat.
    except ValueError as exc:
        # Le client peut alors consulter /api/sectors pour connaître les seuls choix valides.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    # Les valeurs retournées gardent le contrat date/sector/value et ajoutent leur contexte.
    return {"kind": kind, "column": "value", "source": "repository-csv", "metadata": public_catalog()[kind], "data": data}


# Expose en un seul appel le catalogue et toutes les séries réelles pour synchroniser les vues.
@app.get("/api/dashboard-data")
# Filtre la charge commune avec la même zone et les mêmes bornes que le reste de l’application.
def dashboard_data(sector: str | None = None, start: str | None = None, end: str | None = None) -> dict[str, Any]:
    # La réponse utilise le secteur de données réel s’il est demandé.
    _validate_months(start, end)
    # Construit une charge unifiée comprenant chaque variable réellement disponible.
    datasets = {kind: _dataset_payload(kind, sector, start, end) for kind in DATASETS}
    # Les mêmes choix de période et de zone pilotent les indicateurs, graphiques et carte.
    return {"source": "repository-csv", "catalog": public_catalog(), "sectors": SECTORS, "active_sector": sector or (SECTORS[0] if SECTORS else None), "datasets": datasets}


# Expose la lecture d’une seule série sous sa route de données explicite.
@app.get("/api/data/{kind}")
# Conserve l’ancienne route de démonstration comme alias compatible, désormais alimenté par CSV.
@app.get("/api/demo/{kind}", deprecated=True)
# Filtre le CSV choisi selon la zone et les mois inclusifs demandés.
def dataset(kind: str, sector: str | None = None, start: str | None = None, end: str | None = None) -> dict[str, Any]:
    # Retourne le contrat commun avec provenance en plus des anciens champs.
    return _dataset_payload(kind, sector, start, end)


# Évalue un CSV mensuel envoyé explicitement et ne persiste ni fichier ni modèle entraîné.
@app.post("/api/ml/evaluate")
async def ml_evaluate(
    # Le fichier est lu en mémoire et soumis à une limite stricte avant le parsing.
    file: UploadFile = File(...),
    # Les deux colonnes choisies par l'utilisateur identifient la série mensuelle.
    date_col: str = Form(...),
    value_col: str = Form(...),
    # Le séparateur et la notation décimale couvrent les exports CSV courants.
    delimiter: Literal[",", ";", "\t"] = Form(","),
    decimal_mark: Literal[".", ","] = Form("."),
    # Le client doit déclarer que les valeurs ne sont pas une série synthétique/fictive.
    confirm_real_observations: bool = Form(False),
    # Un filtre facultatif réduit un CSV multi-secteur à une seule série.
    sector_filter: str = Form(""),
    # Paramètres du candidat et de son protocole chronologique.
    horizon: int = Form(12),
    validation_origins: int = Form(12),
    model_type: Literal["random_forest", "ridge"] = Form("random_forest"),
    # Contexte déclaré, conservé dans le manifeste sans être présenté comme vérifié.
    source: str = Form(""),
    unit: str = Form(""),
    aggregation: str = Form(""),
    resolution: str = Form(""),
) -> dict[str, Any]:
    """Retourne un rapport par horizon et une projection relative à la dernière date du CSV."""
    if not 1 <= horizon <= 24:
        raise HTTPException(status_code=400, detail="L'horizon doit être compris entre 1 et 24 mois.")
    if not 12 <= validation_origins <= 36:
        raise HTTPException(status_code=400, detail="Le nombre d'origines de validation doit être compris entre 12 et 36.")
    if not confirm_real_observations:
        raise HTTPException(status_code=400, detail="Confirmez que le CSV contient des observations réelles, non synthétiques.")

    # Vérifie le nom et la taille avant d'ouvrir le contenu avec Pandas.
    filename = (file.filename or "user-upload.csv").replace("\\", "/").rsplit("/", 1)[-1]
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Le fichier téléversé doit être un CSV.")
    content = await file.read(MAX_ML_UPLOAD_BYTES + 1)
    if len(content) > MAX_ML_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Le CSV dépasse la limite de 5 Mio pour l'évaluation interactive.")
    if not content.strip():
        raise HTTPException(status_code=400, detail="Le CSV est vide.")

    # Parse le fichier sans l'écrire sur disque; les erreurs de format deviennent des réponses 400.
    try:
        csv_frame = pd.read_csv(io.BytesIO(content), sep=delimiter, decimal=decimal_mark)
    except (pd.errors.EmptyDataError, pd.errors.ParserError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Le fichier n'est pas un CSV lisible avec une ligne d'en-tête.") from exc
    if csv_frame.empty:
        raise HTTPException(status_code=400, detail="Le CSV ne contient aucune ligne de données.")
    csv_frame.columns = [str(column).strip() for column in csv_frame.columns]
    if csv_frame.columns.duplicated().any():
        raise HTTPException(status_code=400, detail="Les noms de colonnes du CSV doivent être uniques après suppression des espaces.")
    if sector_filter and "sector" not in csv_frame.columns:
        raise HTTPException(status_code=400, detail="Un filtre de secteur a été fourni mais la colonne sector est absente.")

    # N'entraîne le modèle qu'après sélection des colonnes et validation de la fréquence mensuelle.
    prepared = csv_frame
    if sector_filter:
        prepared = csv_frame[csv_frame["sector"].astype(str) == sector_filter.strip()]
    try:
        series = prepare_monthly_series(prepared, date_col.strip(), value_col.strip())
        source_sha256 = hashlib.sha256(content).hexdigest()
        context = {
            "source": source.strip(),
            "unit": unit.strip(),
            "aggregation": aggregation.strip(),
            "resolution": resolution.strip(),
            "delimiter": "tabulation" if delimiter == "\t" else delimiter,
            "decimal_mark": decimal_mark,
            "date_column": date_col.strip(),
            "value_column": value_col.strip(),
            "sector_filter": sector_filter.strip() or "Non filtré",
            "user_attested_real_observations": "true",
        }
        return evaluate_and_forecast(
            series,
            horizon=horizon,
            validation_origins=validation_origins,
            model_name=model_type,
            source_sha256=source_sha256,
            filename=filename,
            declared_context=context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
