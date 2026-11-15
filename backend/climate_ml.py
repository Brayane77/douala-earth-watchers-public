"""Évalue des modèles mensuels sur un CSV utilisateur et produit une projection exploratoire.

Le calcul ne démarre qu'après une soumission explicite du fichier. L'évaluation
avance chronologiquement, n'utilise que les observations connues à chaque origine
et compare le candidat à la persistance et à une baseline saisonnière lorsqu'elle
est disponible. Les projections sont relatives à la dernière date du fichier :
elles ne sont ni un forecast actuel de Douala, ni une alerte officielle.
"""
from __future__ import annotations

# Hashlib relie le rapport au contenu exact du fichier et à cette version du code.
import hashlib
# JSON sérialise de manière stable les paramètres qui identifient un run.
import json
# Path permet de calculer l'empreinte du module exécuté.
from pathlib import Path
# Les types rendent explicites les modèles et la structure du rapport retourné.
from typing import Any, Literal

# NumPy construit les caractéristiques et calcule les métriques sans imputation.
import numpy as np
# Pandas valide l'index mensuel fourni par l'utilisateur.
import pandas as pd
# Expose la version logicielle du modèle dans le manifeste de chaque évaluation.
from sklearn import __version__ as sklearn_version
# Les deux candidats sont proposés comme modèles expérimentaux, pas comme gagnants garantis.
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error

# Les caractéristiques ne dépendent que de l'historique mensuel disponible à une origine.
FEATURE_NAMES = ["month_sin", "month_cos", "time_index", "lag_1", "lag_12", "mean_previous_3"]
# L'archive utilisateur est bornée pour éviter une demande de calcul disproportionnée.
MIN_MONTHS = 60
MAX_MONTHS = 1200
MAX_HORIZON_MONTHS = 24
MIN_VALIDATION_ORIGINS = 12
MAX_VALIDATION_ORIGINS = 36
MIN_TRAINING_EXAMPLES = 24

# Expose seulement les candidats dont la configuration est documentée et reproductible.
ModelName = Literal["random_forest", "ridge"]


# Valide le CSV et renvoie une unique série mensuelle, sans imputer de valeurs manquantes.
def prepare_monthly_series(frame: pd.DataFrame, date_column: str, value_column: str) -> pd.DataFrame:
    """Convertit deux colonnes utilisateur en dates de début de mois et valeurs finies."""
    if date_column not in frame or value_column not in frame:
        raise ValueError("La colonne de date ou la variable choisie est absente.")
    if date_column == value_column:
        raise ValueError("La date et la variable doivent être deux colonnes différentes.")

    # Convertit les colonnes sans masquer une valeur impossible ou une date invalide.
    dates = pd.to_datetime(frame[date_column], errors="coerce")
    values = pd.to_numeric(frame[value_column], errors="coerce")
    if dates.isna().any():
        raise ValueError("Certaines dates sont invalides. Vérifiez la colonne de date.")
    if values.isna().any() or not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError("La variable doit contenir des nombres finis, sans cellules vides.")

    # Normalise les étiquettes au premier du mois puis refuse toute agrégation implicite.
    data = pd.DataFrame({"date": dates.dt.to_period("M").dt.to_timestamp(), "value": values.astype(float)})
    if data["date"].duplicated().any():
        raise ValueError("Il faut une seule valeur déjà agrégée par mois : des mois sont dupliqués.")
    data = data.sort_values("date").reset_index(drop=True)

    # Vérifie la longueur et la continuité du calendrier sans interpolation.
    if len(data) < MIN_MONTHS:
        raise ValueError(f"Il faut au moins {MIN_MONTHS} mois consécutifs; {len(data)} mois reçus.")
    if len(data) > MAX_MONTHS:
        raise ValueError(f"La série dépasse la limite de {MAX_MONTHS} mois pour ce calcul interactif.")
    expected = pd.date_range(data.date.iloc[0], data.date.iloc[-1], freq="MS")
    if not data.date.reset_index(drop=True).equals(pd.Series(expected, name="date")):
        raise ValueError("La série contient des mois manquants; ils ne sont pas interpolés.")
    return data


# Crée une ligne de caractéristiques à partir des seules valeurs antérieures à la cible.
def _feature_row(target_date: pd.Timestamp, time_index: int, history: list[float] | np.ndarray) -> list[float]:
    """Encode le cycle annuel, la tendance et les retards d'une série mensuelle."""
    values = np.asarray(history, dtype=float)
    if len(values) < 12:
        raise ValueError("Au moins 12 observations mensuelles sont nécessaires aux retards saisonniers.")
    month_angle = 2.0 * np.pi * (target_date.month - 1) / 12.0
    return [
        float(np.sin(month_angle)),
        float(np.cos(month_angle)),
        float(time_index),
        float(values[-1]),
        float(values[-12]),
        float(np.mean(values[-3:])),
    ]


# Prépare les exemples supervisés en excluant toujours la valeur de la date cible.
def _training_matrix(values: np.ndarray, dates: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    """Construit les features et cibles à partir des seuls mois inclus dans values."""
    rows: list[list[float]] = []
    targets: list[float] = []
    for target_index in range(12, len(values)):
        rows.append(_feature_row(pd.Timestamp(dates.iloc[target_index]), target_index, values[:target_index]))
        targets.append(float(values[target_index]))
    if not rows:
        return np.empty((0, len(FEATURE_NAMES))), np.empty((0,))
    return np.asarray(rows, dtype=float), np.asarray(targets, dtype=float)


# Retourne le modèle demandé et sa configuration publique pour le manifeste.
def _new_model(model_name: ModelName) -> tuple[Any, dict[str, Any]]:
    """Crée une forêt aléatoire ou une Ridge avec paramètres fixés pour ce run."""
    if model_name == "random_forest":
        configuration = {
            "model_version": "random-forest-monthly-v2",
            "estimator": "sklearn.ensemble.RandomForestRegressor",
            "n_estimators": 100,
            "max_depth": 5,
            "min_samples_leaf": 2,
            "random_state": 2026,
            "n_jobs": 1,
        }
        return RandomForestRegressor(
            n_estimators=configuration["n_estimators"],
            max_depth=configuration["max_depth"],
            min_samples_leaf=configuration["min_samples_leaf"],
            random_state=configuration["random_state"],
            n_jobs=configuration["n_jobs"],
        ), configuration

    if model_name == "ridge":
        configuration = {
            "model_version": "ridge-monthly-v2",
            "estimator": "sklearn.linear_model.Ridge",
            "alpha": 10.0,
            "fit_intercept": True,
        }
        return Ridge(alpha=configuration["alpha"], fit_intercept=configuration["fit_intercept"]), configuration

    raise ValueError("Le modèle doit être random_forest ou ridge.")


# Ajuste un modèle sur un préfixe de série qui s'arrête à l'origine de prévision.
def _fit_at_origin(values: np.ndarray, dates: pd.Series, model_name: ModelName) -> tuple[Any, int]:
    """Entraîne sur l'historique disponible et renvoie le nombre réel d'exemples."""
    features, targets = _training_matrix(values, dates)
    if len(targets) < MIN_TRAINING_EXAMPLES:
        raise ValueError(
            f"Il faut au moins {MIN_TRAINING_EXAMPLES} exemples d'entraînement après création des retards; "
            f"{len(targets)} reçus à une origine."
        )
    model, _ = _new_model(model_name)
    return model.fit(features, targets), len(targets)


# Produit une projection récursive depuis une seule origine chronologique.
def _recursive_forecast(
    model: Any,
    history: np.ndarray,
    origin_index: int,
    origin_date: pd.Timestamp,
    horizon: int,
) -> list[float]:
    """Remplace les valeurs futures par les sorties du candidat, jamais par les cibles observées."""
    forecast_history = history.astype(float).tolist()
    predictions: list[float] = []
    future_dates = pd.date_range(origin_date + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")
    for step, target_date in enumerate(future_dates, start=1):
        target_index = origin_index + step
        features = _feature_row(pd.Timestamp(target_date), target_index, forecast_history)
        prediction = float(model.predict(np.asarray(features, dtype=float).reshape(1, -1))[0])
        predictions.append(prediction)
        forecast_history.append(prediction)
    return predictions


# Calcule les erreurs dans l'unité de la série sans inventer de pourcentage ou d'intervalle.
def _error_metrics(observed: list[float], predicted: list[float]) -> dict[str, float]:
    """Retourne MAE et RMSE pour des listes alignées de valeurs réelles et prédites."""
    return {
        "mae": float(mean_absolute_error(observed, predicted)),
        "rmse": float(np.sqrt(mean_squared_error(observed, predicted))),
    }


# Évalue les candidats par origines glissantes et produit une projection depuis le dernier mois.
def evaluate_and_forecast(
    series: pd.DataFrame,
    horizon: int = 12,
    validation_origins: int = 12,
    model_name: ModelName = "random_forest",
    source_sha256: str = "",
    filename: str = "user-upload.csv",
    declared_context: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Construit un rapport traçable, limité aux données mensuelles téléversées."""
    if not 1 <= horizon <= MAX_HORIZON_MONTHS:
        raise ValueError(f"L'horizon doit être compris entre 1 et {MAX_HORIZON_MONTHS} mois.")
    if not MIN_VALIDATION_ORIGINS <= validation_origins <= MAX_VALIDATION_ORIGINS:
        raise ValueError(
            f"Le nombre d'origines doit être compris entre {MIN_VALIDATION_ORIGINS} et {MAX_VALIDATION_ORIGINS}."
        )
    if model_name not in ("random_forest", "ridge"):
        raise ValueError("Le modèle doit être random_forest ou ridge.")
    minimum_records = MIN_TRAINING_EXAMPLES + 12 + horizon + validation_origins - 1
    if len(series) < minimum_records:
        raise ValueError(
            f"Il faut au moins {minimum_records} mois pour entraîner le modèle puis évaluer "
            f"{horizon} horizon(s) sur {validation_origins} origines sans fuite temporelle; {len(series)} reçus."
        )
    if not source_sha256 or len(source_sha256) != 64:
        raise ValueError("L'empreinte SHA-256 du CSV est obligatoire pour identifier le run.")

    dates = series["date"].reset_index(drop=True)
    values = series["value"].to_numpy(dtype=float)
    first_origin_index = len(values) - horizon - validation_origins
    last_origin_index = len(values) - horizon - 1
    validation_rows: list[dict[str, Any]] = []

    # Chaque origine ne voit que son préfixe connu; tous les horizons ont K cibles réelles observées.
    for origin_index in range(first_origin_index, last_origin_index + 1):
        available_values = values[: origin_index + 1]
        available_dates = dates.iloc[: origin_index + 1].reset_index(drop=True)
        model, training_count = _fit_at_origin(available_values, available_dates, model_name)
        origin_date = pd.Timestamp(dates.iloc[origin_index])
        candidate_predictions = _recursive_forecast(
            model,
            available_values,
            origin_index,
            origin_date,
            horizon,
        )

        for lead, candidate_value in enumerate(candidate_predictions, start=1):
            target_index = origin_index + lead
            target_date = pd.Timestamp(dates.iloc[target_index])
            seasonal_indices = [
                index
                for index in range(origin_index + 1)
                if pd.Timestamp(dates.iloc[index]).month == target_date.month
            ]
            seasonal_value = float(values[seasonal_indices[-1]]) if seasonal_indices else None
            validation_rows.append(
                {
                    "origin_date": origin_date.strftime("%Y-%m-%d"),
                    "valid_date": target_date.strftime("%Y-%m-%d"),
                    "horizon_months": lead,
                    "observed": float(values[target_index]),
                    "model": candidate_value,
                    "persistence": float(values[origin_index]),
                    "seasonal_baseline": seasonal_value,
                    "training_examples": training_count,
                }
            )

    if not validation_rows:
        raise ValueError("Aucun cas de validation n'est disponible pour ces dates et cet horizon.")

    # Publie N et les périodes propres à chaque horizon; toute baseline utilise l'historique connu à l'origine.
    metrics_by_horizon: dict[str, Any] = {}
    for lead in range(1, horizon + 1):
        rows = [row for row in validation_rows if row["horizon_months"] == lead]
        if not rows:
            raise ValueError(f"Aucun cas de validation disponible pour l'horizon {lead} mois.")
        observed = [row["observed"] for row in rows]
        candidate = [row["model"] for row in rows]
        persistence = [row["persistence"] for row in rows]
        seasonal_rows = [row for row in rows if row["seasonal_baseline"] is not None]
        seasonal_available = len(seasonal_rows) == len(rows)
        seasonal_metrics = _error_metrics(
            [row["observed"] for row in seasonal_rows],
            [row["seasonal_baseline"] for row in seasonal_rows],
        ) if seasonal_rows else None
        valid_dates = [row["valid_date"] for row in rows]
        origin_dates = [row["origin_date"] for row in rows]
        seasonal_dates = [row["valid_date"] for row in seasonal_rows]

        metrics_by_horizon[str(lead)] = {
            "horizon_months": lead,
            "n": len(rows),
            "origin_period": {"start": min(origin_dates), "end": max(origin_dates)},
            "validation_period": {"start": min(valid_dates), "end": max(valid_dates)},
            "training_examples": {"min": min(row["training_examples"] for row in rows), "max": max(row["training_examples"] for row in rows)},
            "models": {
                "candidate": {"n": len(rows), **_error_metrics(observed, candidate)},
                "persistence": {"n": len(rows), **_error_metrics(observed, persistence)},
                "seasonal_baseline": {
                    "available": seasonal_available,
                    "n": len(seasonal_rows),
                    "period": {"start": min(seasonal_dates), "end": max(seasonal_dates)} if seasonal_dates else None,
                    "mae": seasonal_metrics["mae"] if seasonal_metrics else None,
                    "rmse": seasonal_metrics["rmse"] if seasonal_metrics else None,
                    "reason": None if seasonal_available else "Aucune observation antérieure du même mois calendaire n'était disponible à l'origine."
                },
            },
        }

    # Entraîne un dernier candidat sur toute la série puis projette uniquement des valeurs calculées.
    final_model, final_training_examples = _fit_at_origin(values, dates, model_name)
    latest_index = len(values) - 1
    latest_date = pd.Timestamp(dates.iloc[latest_index])
    forecast_values = _recursive_forecast(final_model, values, latest_index, latest_date, horizon)
    future_dates = pd.date_range(latest_date + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")
    forecast_rows = [
        {
            "date": pd.Timestamp(future_date).strftime("%Y-%m-%d"),
            "horizon_months": step,
            "prediction": prediction,
        }
        for step, (future_date, prediction) in enumerate(zip(future_dates, forecast_values, strict=True), start=1)
    ]

    # Empreinte le code, les versions logicielles et la configuration avec la source du run.
    _, model_parameters = _new_model(model_name)
    code_sha256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    configuration = {
        "model_name": model_name,
        "model_version": model_parameters["model_version"],
        "estimator": model_parameters["estimator"],
        "parameters": model_parameters,
        "feature_names": FEATURE_NAMES,
        "horizon_months": horizon,
        "validation_origins": validation_origins,
        "validation_method": "origines terminales glissantes; à chaque origine, entraînement expansif et prévision récursive jusqu'à l'horizon demandé",
        "baseline_persistence": "dernière observation connue à l'origine, maintenue sur tout l'horizon",
        "baseline_seasonal": "dernière observation passée du même mois calendaire, connue à l'origine",
        "software_versions": {"numpy": np.__version__, "pandas": pd.__version__, "scikit_learn": sklearn_version},
        "future_observations_used": False,
        "random_split": False,
        "final_training_examples": final_training_examples,
    }
    context = declared_context or {}
    identity = json.dumps(
        {"source_sha256": source_sha256, "code_sha256": code_sha256, "configuration": configuration, "context": context},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    run_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    source_period = {"start": pd.Timestamp(dates.iloc[0]).strftime("%Y-%m-%d"), "end": latest_date.strftime("%Y-%m-%d")}
    origin_dates = [row["origin_date"] for row in validation_rows]
    origin_period = {"start": min(origin_dates), "end": max(origin_dates)}
    reported_context = {
        "source": context.get("source") or "Non déclarée",
        "unit": context.get("unit") or "Non précisée",
        "aggregation": context.get("aggregation") or "Non précisée",
        "resolution": context.get("resolution") or "Non précisée",
    }
    reported_context.update({key: value for key, value in context.items() if key not in reported_context})

    return {
        "schema_version": 2,
        "run_id": run_id,
        "status": "exploratory_user_uploaded_data",
        "is_current": False,
        "is_official": False,
        "target": {"column": context.get("value_column") or "Non précisée", "unit": context.get("unit") or "Non précisée"},
        "source": {
            "type": "user_uploaded_csv",
            "filename": Path(filename).name or "user-upload.csv",
            "sha256": source_sha256,
            "retrieved_at": None,
            "record_count": int(len(series)),
            "source_period": source_period,
            "declared_context": reported_context,
        },
        "configuration": configuration,
        "code_sha256": code_sha256,
        "uncertainty": "Non quantifiée; aucun intervalle artificiel n'est fourni.",
        "history": [
            {"date": pd.Timestamp(date).strftime("%Y-%m-%d"), "value": float(value)}
            for date, value in zip(dates, values, strict=True)
        ],
        "latest_observation": {"date": latest_date.strftime("%Y-%m-%d"), "value": float(values[-1])},
        "validation": {
            "method": "Origines terminales glissantes; à chaque origine, le modèle ne voit que les observations antérieures, puis prédit récursivement sans accès aux cibles futures.",
            "origin_period": origin_period,
            "metrics_by_horizon": metrics_by_horizon,
            "predictions": validation_rows,
            "uncertainty": "Non quantifiée.",
        },
        "forecast_origin": latest_date.strftime("%Y-%m-%d"),
        "forecast": forecast_rows,
    }
