"""Tests du parcours de validation mensuelle sur le CSV réel conservé dans le dépôt."""
from __future__ import annotations

# asyncio exécute la route multipart dans les tests sans serveur HTTP ni réseau.
import asyncio
# Hashlib calcule les empreintes d'entrée requises par le manifeste.
import hashlib
# BytesIO construit un upload mémoire du CSV réel, sans fichier temporaire.
from io import BytesIO
# pathlib localise le CSV de température versionné dans le dépôt.
from pathlib import Path
# unittest couvre les contrats backend sans fixture de valeurs inventées.
import unittest

# FastAPI décrit l'upload traité par la route de l'application.
from fastapi import UploadFile
# pandas lit les dates réelles et vérifie les périodes de validation/forecast.
import pandas as pd

# Importe uniquement les fonctions qui ne lancent aucun calcul à l'import du module.
from backend.climate_ml import evaluate_and_forecast, prepare_monthly_series
from backend.api.main import ml_evaluate

# Racine du dépôt utilisée pour lire l'archive mensuelle versionnée.
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
# Source d'observations mensuelles utilisée seulement comme fixture d'intégration.
TEMPERATURE_CSV = REPOSITORY_ROOT / "nasa-data" / "csv" / "temperature_Douala.csv"


# Vérifie préparation stricte, protocole chronologique, métriques et forecast pour une source réelle.
class MonthlyClimateMlTests(unittest.TestCase):
    """Couvre l'évaluation explicite d'une série fournie et l'absence d'imputation temporelle."""

    @classmethod
    def setUpClass(cls) -> None:
        """Charge le CSV réel une fois sans le modifier ni appeler l'API réseau."""
        cls.csv_bytes = TEMPERATURE_CSV.read_bytes()
        cls.frame = pd.read_csv(TEMPERATURE_CSV)
        cls.series = prepare_monthly_series(cls.frame, "date", "value")
        cls.source_sha256 = hashlib.sha256(cls.csv_bytes).hexdigest()

    # La série du dépôt doit rester mensuelle, finie, continue et attachée à ses vraies dates.
    def test_prepares_real_monthly_archive_without_filling_or_resampling(self) -> None:
        self.assertEqual(len(self.series), 132)
        self.assertEqual(self.series["date"].iloc[0].strftime("%Y-%m-%d"), "2015-01-01")
        self.assertEqual(self.series["date"].iloc[-1].strftime("%Y-%m-%d"), "2025-12-01")
        self.assertTrue(self.series["value"].map(pd.notna).all())
        self.assertEqual(self.series["date"].diff().dropna().dt.days.min(), 28)
        self.assertEqual(self.series["date"].diff().dropna().dt.days.max(), 31)

    # Le contrat refuse valeurs manquantes, doublons de mois et périodes non continues.
    def test_rejects_missing_values_duplicate_months_and_calendar_gaps(self) -> None:
        missing_value = self.frame.copy()
        missing_value.loc[5, "value"] = float("nan")
        with self.assertRaisesRegex(ValueError, "nombres finis"):
            prepare_monthly_series(missing_value, "date", "value")

        duplicate_month = pd.concat([self.frame, self.frame.iloc[[0]]], ignore_index=True)
        with self.assertRaisesRegex(ValueError, "une seule valeur"):
            prepare_monthly_series(duplicate_month, "date", "value")

        missing_month = self.frame.drop(index=20).reset_index(drop=True)
        with self.assertRaisesRegex(ValueError, "mois manquants"):
            prepare_monthly_series(missing_month, "date", "value")

    # Les scores sont publiés par horizon avec N, dates de cibles et origines vérifiables.
    def test_evaluation_reports_candidate_and_both_baselines_per_horizon(self) -> None:
        report = evaluate_and_forecast(
            self.series,
            horizon=3,
            validation_origins=12,
            model_name="ridge",
            source_sha256=self.source_sha256,
            filename=TEMPERATURE_CSV.name,
            declared_context={"value_column": "value", "unit": "°C"},
        )
        metrics = report["validation"]["metrics_by_horizon"]
        self.assertEqual(set(metrics), {"1", "2", "3"})
        self.assertEqual({key: score["n"] for key, score in metrics.items()}, {"1": 12, "2": 12, "3": 12})
        for horizon in ("1", "2", "3"):
            record = metrics[horizon]
            self.assertEqual(set(record["models"]), {"candidate", "persistence", "seasonal_baseline"})
            self.assertEqual(record["models"]["candidate"]["n"], 12)
            self.assertEqual(record["models"]["persistence"]["n"], 12)
            self.assertEqual(record["models"]["seasonal_baseline"]["n"], 12)
            self.assertTrue(record["models"]["seasonal_baseline"]["available"])
            self.assertLessEqual(record["validation_period"]["start"], record["validation_period"]["end"])
            self.assertLessEqual(record["origin_period"]["start"], record["origin_period"]["end"])
            for name in ("candidate", "persistence", "seasonal_baseline"):
                model_metrics = record["models"][name]
                self.assertGreaterEqual(model_metrics["mae"], 0)
                self.assertGreaterEqual(model_metrics["rmse"], 0)

    # Chaque origine s'arrête avant sa cible et la baseline saisonnière ne lit que le passé connu.
    def test_validation_rows_are_chronological_and_baselines_use_past_only(self) -> None:
        report = evaluate_and_forecast(
            self.series,
            horizon=3,
            validation_origins=12,
            model_name="ridge",
            source_sha256=self.source_sha256,
        )
        values = self.series["value"].tolist()
        dates = self.series["date"].dt.strftime("%Y-%m-%d").tolist()
        for row in report["validation"]["predictions"]:
            origin_index = dates.index(row["origin_date"])
            valid_index = dates.index(row["valid_date"])
            self.assertEqual(valid_index - origin_index, row["horizon_months"])
            self.assertEqual(row["training_examples"], origin_index + 1 - 12)
            self.assertEqual(row["persistence"], values[origin_index])
            previous_same_month = [
                index for index in range(origin_index + 1)
                if self.series["date"].iloc[index].month == self.series["date"].iloc[valid_index].month
            ]
            self.assertEqual(row["seasonal_baseline"], values[previous_same_month[-1]])

    # Le scénario commence après la dernière observation et exporte des dates, valeurs et empreintes.
    def test_forecast_is_future_only_and_tied_to_the_uploaded_bytes(self) -> None:
        report = evaluate_and_forecast(
            self.series,
            horizon=3,
            validation_origins=12,
            model_name="ridge",
            source_sha256=self.source_sha256,
            filename=f"nested/{TEMPERATURE_CSV.name}",
            declared_context={"value_column": "value", "unit": "°C"},
        )
        self.assertEqual(report["status"], "exploratory_user_uploaded_data")
        self.assertFalse(report["is_current"])
        self.assertFalse(report["is_official"])
        self.assertEqual(report["source"]["sha256"], self.source_sha256)
        self.assertEqual(report["source"]["filename"], TEMPERATURE_CSV.name)
        self.assertEqual(report["latest_observation"]["date"], "2025-12-01")
        self.assertEqual([point["date"] for point in report["forecast"]], ["2026-01-01", "2026-02-01", "2026-03-01"])
        self.assertTrue(all(point["horizon_months"] == index for index, point in enumerate(report["forecast"], start=1)))
        self.assertEqual(report["forecast_origin"], report["latest_observation"]["date"])
        self.assertFalse(report["configuration"]["future_observations_used"])
        self.assertFalse(report["configuration"]["random_split"])
        self.assertEqual(len(report["code_sha256"]), 64)
        self.assertEqual(report["uncertainty"], "Non quantifiée; aucun intervalle artificiel n'est fourni.")

    # L'horizon maximal garde le même nombre d'origines, les baselines et les dates futures cohérents.
    def test_maximum_horizon_reports_all_monthly_targets_without_future_observations(self) -> None:
        report = evaluate_and_forecast(
            self.series,
            horizon=24,
            validation_origins=12,
            model_name="ridge",
            source_sha256=self.source_sha256,
        )
        self.assertEqual(len(report["forecast"]), 24)
        self.assertEqual(report["forecast"][-1]["date"], "2027-12-01")
        self.assertEqual(len(report["validation"]["metrics_by_horizon"]), 24)
        for metric in report["validation"]["metrics_by_horizon"].values():
            self.assertEqual(metric["n"], 12)
            self.assertTrue(metric["models"]["seasonal_baseline"]["available"])
            self.assertEqual(metric["models"]["seasonal_baseline"]["n"], 12)

    # Le candidat forêt aléatoire est configurable et sa graine/structure sont conservées.
    def test_random_forest_candidate_configuration_is_versioned(self) -> None:
        report = evaluate_and_forecast(
            self.series,
            horizon=1,
            validation_origins=12,
            model_name="random_forest",
            source_sha256=self.source_sha256,
        )
        self.assertEqual(report["configuration"]["model_version"], "random-forest-monthly-v2")
        self.assertEqual(report["configuration"]["parameters"]["n_estimators"], 100)
        self.assertEqual(report["configuration"]["parameters"]["random_state"], 2026)
        self.assertEqual(report["validation"]["metrics_by_horizon"]["1"]["n"], 12)

    # Le point d'entrée multipart consomme le CSV réel et renvoie le même rapport traçable.
    def test_multipart_api_accepts_real_upload_and_returns_validation_and_forecast(self) -> None:
        upload = UploadFile(filename=TEMPERATURE_CSV.name, file=BytesIO(self.csv_bytes))
        report = asyncio.run(ml_evaluate(
            file=upload,
            date_col="date",
            value_col="value",
            delimiter=",",
            decimal_mark=".",
            confirm_real_observations=True,
            sector_filter="Douala",
            horizon=3,
            validation_origins=12,
            model_type="ridge",
            source="NASA MERRA-2 T2M archive",
            unit="°C",
            aggregation="Moyenne mensuelle",
            resolution="Grille régionale",
        ))
        self.assertEqual(report["schema_version"], 2)
        self.assertEqual(report["target"]["column"], "value")
        self.assertEqual(report["source"]["sha256"], self.source_sha256)
        self.assertEqual(report["source"]["declared_context"]["sector_filter"], "Douala")
        self.assertEqual(report["source"]["declared_context"]["user_attested_real_observations"], "true")
        self.assertEqual(len(report["validation"]["predictions"]), 36)
        self.assertEqual(len(report["forecast"]), 3)
        self.assertEqual(report["forecast"][0]["date"], "2026-01-01")

    # Les horizons configurés exigent un historique suffisant et une empreinte source déclarée.
    def test_rejects_insufficient_origins_horizon_and_missing_hash(self) -> None:
        with self.assertRaisesRegex(ValueError, "origines"):
            evaluate_and_forecast(self.series, validation_origins=11, source_sha256=self.source_sha256)
        with self.assertRaisesRegex(ValueError, "empreinte SHA-256"):
            evaluate_and_forecast(self.series, horizon=1, validation_origins=12, source_sha256="")
        with self.assertRaisesRegex(ValueError, "moins"):  # Les erreurs décrivent le calendrier requis.
            evaluate_and_forecast(
                self.series.iloc[:50].reset_index(drop=True),
                horizon=24,
                validation_origins=12,
                source_sha256=self.source_sha256,
            )


# Permet l'exécution directe du fichier pendant la vérification backend.
if __name__ == "__main__":
    unittest.main()
