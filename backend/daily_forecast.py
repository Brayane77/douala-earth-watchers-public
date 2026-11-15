"""Préparation hors ligne et service du backtest quotidien T2M de NASA POWER.

Le calcul du modèle est réservé au script explicite de pré-calcul. L'API ne
réentraîne jamais un modèle à l'ouverture d'une page et n'expose pas de
prévision actuelle tant que l'archive n'a ni date de récupération traçable,
ni observations fraîches, ni résultat opérationnel validé.
"""
from __future__ import annotations

# Les outils de hachage rendent chaque résultat reproductible depuis les fichiers locaux.
import hashlib
# JSON conserve les résultats pré-calculés dans un format léger et lisible.
import json
# math vérifie les seuils numériques fournis par l'utilisateur.
import math
# re valide les coordonnées déclarées dans l'en-tête NASA POWER.
import re
# Les chemins relatifs au dépôt ne dépendent pas du répertoire courant du serveur.
from pathlib import Path
# Les annotations décrivent les payloads et les variables acceptées par les routes.
from typing import Any, Literal

# numpy prépare les tableaux d'entraînement et agrège les erreurs hors échantillon.
import numpy as np
# pandas lit et valide l'archive NASA POWER en heure solaire locale.
import pandas as pd
# Ridge constitue un candidat simple, versionné et évalué uniquement hors ligne.
from sklearn.linear_model import Ridge
# Les versions de bibliothèques complètent la configuration du backtest.
import sklearn

# La racine du dépôt sert de base aux chemins de données et d'artefacts.
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
# Le fichier quotidien POWER contient T2M et PRECTOTCORR, conservés comme variables distinctes.
DAILY_POWER_FILE = REPOSITORY_ROOT / "nasa-data" / "csv" / "POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv"
# L'artefact JSON contient uniquement les résultats de validation calculés hors ligne.
BACKTEST_ARTIFACT_FILE = REPOSITORY_ROOT / "nasa-data" / "forecast" / "t2m_daily_backtest.json"
# Les exports de code entrent dans l'empreinte de pipeline du résultat pré-calculé.
BACKTEST_SCRIPT_FILE = REPOSITORY_ROOT / "scripts" / "build_t2m_daily_backtest.py"
# Les fichiers de modèle et de script identifient l'implémentation ayant produit l'artefact.
CODE_FILES = (Path(__file__).resolve(), BACKTEST_SCRIPT_FILE)
# Le nom stable distingue ce modèle expérimental de l'outil mensuel par téléversement.
MODEL_VERSION = "ridge-autoregressive-daily-v1"
# Le split terminal et les décalages sont figés avant le calcul du backtest.
TEST_START = "2025-01-01"
TEST_END = "2025-12-31"
# Le modèle utilise uniquement des retards observés avant la date cible.
FEATURE_LAGS_DAYS = (1, 2, 3, 7, 14, 30, 365)
# Les fenêtres mobiles n'emploient que les observations antérieures à la cible.
FEATURE_ROLLING_WINDOWS_DAYS = (7, 30)
# Les baselines sont définies avant toute comparaison au jeu terminal.
HORIZONS_DAYS = (1, 2, 3)
PERSISTENCE_BASELINE = "dernière observation disponible à l'origine"
SEASONAL_BASELINE = "valeur observée à la date cible moins 365 jours"


# Calcule l'empreinte SHA-256 d'un fichier en lecture par blocs.
def sha256_file(path: Path) -> str:
    """Retourne l'empreinte hexadécimale du contenu exact du fichier."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


# Calcule une empreinte déterministe du modèle et du script de pré-calcul.
def code_fingerprint() -> str:
    """Empreinte les fichiers qui définissent le backtest reproductible."""
    digest = hashlib.sha256()
    for path in CODE_FILES:
        if not path.is_file():
            raise FileNotFoundError(f"Fichier de calcul requis absent : {path}")
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


# Lit la table après l'en-tête NASA POWER et valide le calendrier et les valeurs.
def load_daily_power(path: Path = DAILY_POWER_FILE) -> pd.DataFrame:
    """Charge T2M et PRECTOTCORR sans imputer ni rééchantillonner les observations."""
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    if "-END HEADER-" not in lines:
        raise ValueError(f"En-tête NASA POWER introuvable dans {path.name}.")
    header_end = lines.index("-END HEADER-")
    source_header = "\n".join(lines[: header_end + 1])
    location = re.search(r"Location:\s*latitude\s+(-?\d+(?:\.\d+)?)\s+longitude\s+(-?\d+(?:\.\d+)?)", source_header)
    if "in LST" not in source_header or location is None:
        raise ValueError("Le fichier source ne déclare pas le standard temporel et le point de requête attendus.")
    if abs(float(location.group(1)) - 4.05) > 1e-6 or abs(float(location.group(2)) - 9.70) > 1e-6:
        raise ValueError("Le fichier NASA POWER n'est pas demandé au point attendu 4,05°N, 9,70°E.")

    frame = pd.read_csv(pd.io.common.StringIO("\n".join(lines[header_end + 1 :])))
    required_columns = {"YEAR", "DOY", "T2M", "PRECTOTCORR"}
    missing_columns = required_columns.difference(frame.columns)
    if missing_columns:
        raise ValueError(f"Colonnes NASA POWER absentes : {sorted(missing_columns)}")

    years = pd.to_numeric(frame["YEAR"], errors="coerce")
    days = pd.to_numeric(frame["DOY"], errors="coerce")
    if years.isna().any() or days.isna().any() or not years.eq(np.floor(years)).all() or not days.eq(np.floor(days)).all():
        raise ValueError("YEAR ou DOY contient une valeur absente, non numérique ou non entière.")
    dates = pd.to_datetime(years.astype(int).astype(str) + days.astype(int).astype(str).str.zfill(3), format="%Y%j", errors="coerce")
    if dates.isna().any():
        raise ValueError("Le CSV NASA POWER contient une date YEAR/DOY invalide.")

    result = pd.DataFrame({"date": dates})
    for column, output_column in (("T2M", "t2m_c"), ("PRECTOTCORR", "precipitation_mm_day")):
        values = pd.to_numeric(frame[column], errors="coerce")
        if values.isna().any() or values.eq(-999).any() or not np.isfinite(values.to_numpy(dtype=float)).all():
            raise ValueError(f"La colonne {column} contient une valeur manquante ou invalide.")
        result[output_column] = values.astype(float)

    result = result.sort_values("date").reset_index(drop=True)
    if result["date"].duplicated().any():
        raise ValueError("Le CSV NASA POWER contient des dates quotidiennes dupliquées.")
    expected = pd.date_range(result["date"].iloc[0], result["date"].iloc[-1], freq="D")
    if not result["date"].reset_index(drop=True).equals(pd.Series(expected, name="date")):
        raise ValueError("La série NASA POWER contient un jour manquant ou une période discontinue.")
    if (result["precipitation_mm_day"] < 0).any():
        raise ValueError("PRECTOTCORR contient une valeur négative inattendue.")
    return result


# Construit un vecteur de retards et de saisonnalité pour la date à prévoir.
def feature_row(history: list[float] | np.ndarray, target_date: pd.Timestamp) -> np.ndarray:
    """Crée les prédicteurs avec les seules valeurs présentes avant target_date."""
    values = np.asarray(history, dtype=float)
    if len(values) < 365:
        raise ValueError("Le modèle quotidien exige au moins 365 observations historiques.")
    lag_values = [float(values[-lag]) for lag in FEATURE_LAGS_DAYS]
    rolling_values = [float(np.mean(values[-window:])) for window in FEATURE_ROLLING_WINDOWS_DAYS]
    annual_phase = 2.0 * np.pi * (int(target_date.dayofyear) - 1) / 365.2425
    seasonal_values = [float(np.sin(annual_phase)), float(np.cos(annual_phase))]
    return np.asarray(lag_values + rolling_values + seasonal_values, dtype=float)


# Entraîne le candidat à une origine avec seulement les cibles déjà observées.
def fit_candidate(values: np.ndarray, dates: pd.Series, origin_index: int, alpha: float = 10.0) -> Ridge:
    """Ajuste une régression Ridge sur les exemples antérieurs ou égaux à l'origine."""
    first_target_index = 365
    if origin_index < first_target_index + 23:
        raise ValueError("L'historique est trop court pour entraîner le modèle quotidien.")
    features = [feature_row(values[:index], pd.Timestamp(dates.iloc[index])) for index in range(first_target_index, origin_index + 1)]
    targets = values[first_target_index : origin_index + 1]
    model = Ridge(alpha=alpha, fit_intercept=True)
    model.fit(np.vstack(features), targets)
    return model


# Produit une prévision récursive de trois jours pour une seule origine temporelle.
def predict_from_origin(model: Ridge, history: np.ndarray, origin_date: pd.Timestamp) -> list[float]:
    """Projette J+1 à J+3 en remplaçant les retards futurs par les prédictions."""
    forecast_history = history.astype(float).tolist()
    predictions: list[float] = []
    for horizon in HORIZONS_DAYS:
        target_date = pd.Timestamp(origin_date) + pd.Timedelta(days=horizon)
        row = feature_row(forecast_history, target_date)
        prediction = float(model.predict(row.reshape(1, -1))[0])
        predictions.append(prediction)
        forecast_history.append(prediction)
    return predictions


# Agrège MAE et RMSE sans arrondir les valeurs de validation.
def _error_metrics(observed: list[float], predicted: list[float]) -> dict[str, float]:
    errors = np.asarray(predicted, dtype=float) - np.asarray(observed, dtype=float)
    return {"mae": float(np.mean(np.abs(errors))), "rmse": float(np.sqrt(np.mean(np.square(errors))))}


# Évalue le modèle par origine glissante et compare les deux baselines requises.
def rolling_origin_backtest(frame: pd.DataFrame, alpha: float = 10.0) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Évalue chaque horizon sur 2025 sans accéder aux valeurs futures à une origine."""
    dates = frame["date"].reset_index(drop=True)
    values = frame["t2m_c"].to_numpy(dtype=float)
    test_start = pd.Timestamp(TEST_START)
    test_end = pd.Timestamp(TEST_END)
    start_index = int(dates[dates.eq(test_start)].index[0]) if dates.eq(test_start).any() else -1
    end_index = int(dates[dates.eq(test_end)].index[0]) if dates.eq(test_end).any() else -1
    if start_index < 365 or end_index <= start_index:
        raise ValueError(f"La série doit couvrir la période de test complète {TEST_START} à {TEST_END}.")

    predictions: list[dict[str, Any]] = []
    for origin_index in range(start_index, end_index):
        model = fit_candidate(values[: origin_index + 1], dates.iloc[: origin_index + 1], origin_index, alpha=alpha)
        origin_date = pd.Timestamp(dates.iloc[origin_index])
        candidate_values = predict_from_origin(model, values[: origin_index + 1], origin_date)
        for horizon in HORIZONS_DAYS:
            target_index = origin_index + horizon
            if target_index > end_index:
                continue
            seasonal_index = target_index - 365
            if seasonal_index > origin_index or seasonal_index < 0:
                raise ValueError("La baseline saisonnière utiliserait une donnée future ou absente.")
            predictions.append(
                {
                    "origin_date": origin_date.strftime("%Y-%m-%d"),
                    "valid_date": pd.Timestamp(dates.iloc[target_index]).strftime("%Y-%m-%d"),
                    "horizon_days": horizon,
                    "observed_c": float(values[target_index]),
                    "ridge_candidate_c": float(candidate_values[horizon - 1]),
                    "persistence_c": float(values[origin_index]),
                    "seasonal_baseline_c": float(values[seasonal_index]),
                }
            )

    metrics: dict[str, Any] = {}
    for horizon in HORIZONS_DAYS:
        rows = [row for row in predictions if row["horizon_days"] == horizon]
        if not rows:
            raise ValueError(f"Aucun cas de validation disponible pour J+{horizon}.")
        observed = [row["observed_c"] for row in rows]
        origin_dates = [row["origin_date"] for row in rows]
        valid_dates = [row["valid_date"] for row in rows]
        train_counts = [
            int(pd.Timestamp(row["origin_date"]).toordinal() - dates.iloc[0].to_pydatetime().date().toordinal() + 1 - 365)
            for row in rows
        ]
        metrics[str(horizon)] = {
            "horizon_days": horizon,
            "n": len(rows),
            "origin_period": {"start": min(origin_dates), "end": max(origin_dates)},
            "validation_period": {"start": min(valid_dates), "end": max(valid_dates)},
            "training_examples": {"min": min(train_counts), "max": max(train_counts)},
            "models": {
                "ridge_candidate": _error_metrics(observed, [row["ridge_candidate_c"] for row in rows]),
                "persistence": _error_metrics(observed, [row["persistence_c"] for row in rows]),
                "seasonal_baseline": _error_metrics(observed, [row["seasonal_baseline_c"] for row in rows]),
            },
        }
    return predictions, metrics


# Génère un artefact immuable de validation, sans calcul dans les routes HTTP.
def build_backtest_artifact() -> dict[str, Any]:
    """Prépare la validation terminale et son manifeste de provenance/configuration."""
    frame = load_daily_power()
    source_sha = sha256_file(DAILY_POWER_FILE)
    code_sha = code_fingerprint()
    model_config: dict[str, Any] = {
        "model": MODEL_VERSION,
        "estimator": "sklearn.linear_model.Ridge",
        "alpha": 10.0,
        "fit_intercept": True,
        "feature_lags_days": list(FEATURE_LAGS_DAYS),
        "rolling_mean_windows_days": list(FEATURE_ROLLING_WINDOWS_DAYS),
        "annual_cycle": "sin/cos du jour de l'année, période 365.2425 jours",
        "training_scheme": "fenêtre croissante, observations connues jusqu'à l'origine incluse",
        "test_period": {"start": TEST_START, "end": TEST_END},
        "horizons_days": list(HORIZONS_DAYS),
        "baseline_persistence": PERSISTENCE_BASELINE,
        "baseline_seasonal": SEASONAL_BASELINE,
        "random_split": False,
        "future_observations_used": False,
        "recursive_multi_step": True,
    }
    identity = json.dumps({"source_sha256": source_sha, "code_sha256": code_sha, "config": model_config}, sort_keys=True, separators=(",", ":"))
    run_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    predictions, metrics = rolling_origin_backtest(frame, alpha=model_config["alpha"])
    latest = frame.iloc[-1]
    return {
        "schema_version": 1,
        "run_id": run_id,
        "status": "historical_backtest_only",
        "target": {"variable": "T2M", "description": "température moyenne quotidienne de l'air à 2 m", "unit": "°C"},
        "source": {
            "provider": "NASA POWER",
            "upstream_product": "MERRA-2 T2M",
            "filename": DAILY_POWER_FILE.name,
            "sha256": source_sha,
            "retrieved_at": None,
            "retrieved_at_note": "Non fourni dans l'en-tête de l'archive; ne pas le déduire du nom ou de la date du fichier.",
            "coordinates_requested": {"latitude": 4.05, "longitude": 9.70},
            "native_grid_resolution": "MERRA-2 environ 0,5° × 0,625°; produit de grille, pas une station.",
            "time_standard": "LST — Local Solar Time (heure solaire locale), telle que déclarée par le CSV.",
            "source_period": {"start": frame["date"].iloc[0].strftime("%Y-%m-%d"), "end": frame["date"].iloc[-1].strftime("%Y-%m-%d")},
            "source_rows": int(len(frame)),
            "missing_values": 0,
            "precipitation_variable_excluded_from_model": "PRECTOTCORR (mm/jour); aucun modèle de pluie ou risque d'inondation.",
        },
        "configuration": model_config,
        "software": {"python": f"{__import__('platform').python_version()}", "numpy": np.__version__, "pandas": pd.__version__, "scikit_learn": sklearn.__version__},
        "code_sha256": code_sha,
        "validation": {
            "method": "Backtest chronologique à origines glissantes, période terminale 2025; apprentissage limité aux valeurs disponibles à chaque origine.",
            "period": {"start": TEST_START, "end": TEST_END},
            "metrics_by_horizon": metrics,
            "uncertainty": "Non quantifiée; aucun intervalle artificiel n'est fourni.",
            "candidate_status": "Comparateur expérimental uniquement; aucune promotion en prévision actuelle.",
            "station_validation": "Aucune référence de station indépendante n'est incluse.",
            "predictions": predictions,
        },
        "latest_observation": {
            "date": latest["date"].strftime("%Y-%m-%d"),
            "t2m_c": float(latest["t2m_c"]),
            "precipitation_mm_day": float(latest["precipitation_mm_day"]),
        },
    }


# Charge l'artefact pré-calculé et refuse une source ou un code dont l'empreinte a changé.
def load_backtest_artifact() -> dict[str, Any]:
    """Lit le rapport versionné sans entraîner ni évaluer de modèle à la requête."""
    if not BACKTEST_ARTIFACT_FILE.is_file():
        raise FileNotFoundError(f"Artefact de backtest absent : {BACKTEST_ARTIFACT_FILE}")
    artifact = json.loads(BACKTEST_ARTIFACT_FILE.read_text(encoding="utf-8"))
    if artifact.get("source", {}).get("sha256") != sha256_file(DAILY_POWER_FILE):
        raise RuntimeError("L'empreinte de la source POWER diffère de l'artefact de backtest; régénérez-le hors ligne.")
    if artifact.get("code_sha256") != code_fingerprint():
        raise RuntimeError("L'empreinte du code de backtest diffère de l'artefact; régénérez-le hors ligne.")
    if artifact.get("status") != "historical_backtest_only" or not artifact.get("validation", {}).get("predictions"):
        raise RuntimeError("L'artefact de validation est incomplet ou ne correspond pas au contrat attendu.")
    return artifact


# Décrit l'absence d'un forecast actuel sans extrapoler l'archive historique.
def current_forecast_status(artifact: dict[str, Any]) -> dict[str, Any]:
    """Retourne un état insuffisant explicite et aucune valeur future inventée."""
    source_end = artifact["source"]["source_period"]["end"]
    latest = artifact["latest_observation"]
    return {
        "status": "insufficient_data",
        "forecast": [],
        "forecast_origin": None,
        "issued_at": None,
        "valid_period": None,
        "retrieved_at": artifact["source"]["retrieved_at"],
        "source_end_date": source_end,
        "latest_observation": latest,
        "source": artifact["source"],
        "model_version": artifact["configuration"]["model"],
        "validation_run_id": artifact["run_id"],
        "uncertainty": "Non quantifiée.",
        "reasons": [
            f"L'archive quotidienne se termine le {source_end} et ne couvre pas les prochains jours.",
            "La date de récupération de ce snapshot n'est pas enregistrée.",
            "Le backtest historique ne constitue pas un forecast opérationnel ni une alerte météo officielle.",
        ],
    }


# Déclare l'absence d'un flux d'alertes d'autorité sans en simuler le contenu.
def official_alerts_status(artifact: dict[str, Any]) -> dict[str, Any]:
    """Renvoie l'état des alertes officielles et la dernière observation archivée."""
    return {
        "official_alerts": {
            "status": "unavailable",
            "available": False,
            "source": None,
            "notices": [],
            "reason": "Aucune source officielle d'alerte n'est connectée à cette application.",
        },
        "exploratory_thresholds": {
            "available": True,
            "defaults_configured": False,
            "description": "Un seuil explicite fourni par l'utilisateur peut être comparé à la dernière observation archivée; il ne constitue pas un seuil officiel.",
        },
        "latest_observation": artifact["latest_observation"],
        "source_sha256": artifact["source"]["sha256"],
        "is_current": False,
    }


# Évalue un seuil explicite sur l'observation archivée la plus récente, sans en faire une alerte officielle.
def evaluate_exploratory_threshold(
    artifact: dict[str, Any],
    variable: Literal["T2M", "PRECTOTCORR"],
    operator: Literal["gt", "lt"],
    threshold: float,
) -> dict[str, Any]:
    """Retourne un indicateur historique daté, déclenché ou non déclenché."""
    if not math.isfinite(threshold):
        raise ValueError("Le seuil doit être une valeur numérique finie.")
    latest = artifact["latest_observation"]
    if variable == "T2M":
        value = float(latest["t2m_c"])
        unit = "°C"
        display_name = "Température de l'air à 2 m"
    elif variable == "PRECTOTCORR":
        value = float(latest["precipitation_mm_day"])
        unit = "mm/jour"
        display_name = "Précipitations corrigées NASA POWER"
    else:
        raise ValueError("La variable doit être T2M ou PRECTOTCORR.")
    if operator not in ("gt", "lt"):
        raise ValueError("L'opérateur doit être gt ou lt.")
    crossed = value > threshold if operator == "gt" else value < threshold
    symbol = ">" if operator == "gt" else "<"
    return {
        "kind": "exploratory_threshold_indicator",
        "status": "historical_threshold_crossed" if crossed else "historical_threshold_not_crossed",
        "triggered": crossed,
        "is_current": False,
        "is_official": False,
        "observation": {"date": latest["date"], "variable": variable, "label": display_name, "value": value, "unit": unit},
        "rule": {"operator": operator, "symbol": symbol, "threshold": float(threshold), "unit": unit},
        "source": artifact["source"],
        "message": "Résultat historique sur l'archive; il ne décrit pas une situation actuelle et ne constitue ni une alerte officielle, ni une prévision de pluie ou d'inondation.",
    }


# Formate les mêmes lignes de validation que la page scientifique et l'API JSON.
def validation_export_rows(artifact: dict[str, Any]) -> list[dict[str, Any]]:
    """Ajoute les identifiants de run et d'archive à chaque résultat affichable."""
    run_id = artifact["run_id"]
    source_hash = artifact["source"]["sha256"]
    return [
        {
            "run_id": run_id,
            "source_sha256": source_hash,
            "origin_date": row["origin_date"],
            "valid_date": row["valid_date"],
            "horizon_days": row["horizon_days"],
            "observed_c": row["observed_c"],
            "ridge_candidate_c": row["ridge_candidate_c"],
            "persistence_c": row["persistence_c"],
            "seasonal_baseline_c": row["seasonal_baseline_c"],
        }
        for row in artifact["validation"]["predictions"]
    ]
