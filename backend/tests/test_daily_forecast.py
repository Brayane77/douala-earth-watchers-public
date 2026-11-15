"""Tests du backtest statique et des indicateurs exploratoires sur les données réelles du dépôt."""
from __future__ import annotations

# unittest exécute les contrôles sans ajouter une dépendance de test backend.
import unittest

# Les fonctions importées ne lancent pas d'entraînement au chargement du module.
from backend.daily_forecast import (
    current_forecast_status,
    evaluate_exploratory_threshold,
    load_backtest_artifact,
    load_daily_power,
    official_alerts_status,
    validation_export_rows,
)


# Vérifie la source réelle, l'absence de valeurs futures et la cohérence des exports.
class DailyForecastTests(unittest.TestCase):
    """Couvre les contrats du rapport produit hors ligne et des seuils configurés."""

    @classmethod
    def setUpClass(cls) -> None:
        """Charge une fois l'artefact vérifié par les empreintes source/code."""
        cls.artifact = load_backtest_artifact()

    # Le snapshot quotidien doit respecter sa couverture, son calendrier et sa date réelle de fin.
    def test_power_archive_is_complete_and_ends_on_its_declared_observation(self) -> None:
        frame = load_daily_power()
        self.assertEqual(len(frame), 4018)
        self.assertEqual(frame["date"].iloc[0].strftime("%Y-%m-%d"), "2015-01-01")
        self.assertEqual(frame["date"].iloc[-1].strftime("%Y-%m-%d"), "2025-12-31")
        self.assertEqual(self.artifact["source"]["source_rows"], len(frame))
        self.assertEqual(self.artifact["source"]["retrieved_at"], None)

    # Le backtest terminal publie N distinct pour chaque horizon et les trois comparateurs.
    def test_validation_reports_horizon_metrics_and_actual_sample_counts(self) -> None:
        metrics = self.artifact["validation"]["metrics_by_horizon"]
        self.assertEqual({key: metrics[key]["n"] for key in ("1", "2", "3")}, {"1": 364, "2": 363, "3": 362})
        for horizon in ("1", "2", "3"):
            self.assertEqual(set(metrics[horizon]["models"]), {"ridge_candidate", "persistence", "seasonal_baseline"})
            self.assertGreater(metrics[horizon]["models"]["ridge_candidate"]["mae"], 0)
            self.assertGreater(metrics[horizon]["models"]["ridge_candidate"]["rmse"], 0)
            self.assertEqual(metrics[horizon]["validation_period"]["end"], "2025-12-31")

    # Le endpoint de forecast ne doit pas transformer le dernier point archivé en projection future.
    def test_current_forecast_stays_empty_for_the_historical_snapshot(self) -> None:
        status = current_forecast_status(self.artifact)
        self.assertEqual(status["status"], "insufficient_data")
        self.assertEqual(status["forecast"], [])
        self.assertEqual(status["source_end_date"], "2025-12-31")
        self.assertIsNone(status["retrieved_at"])
        self.assertTrue(status["reasons"])

    # Une source officielle absente ne peut produire aucun avis, même si un seuil personnel existe.
    def test_official_alerts_are_not_simulated(self) -> None:
        status = official_alerts_status(self.artifact)
        self.assertFalse(status["official_alerts"]["available"])
        self.assertEqual(status["official_alerts"]["notices"], [])
        self.assertFalse(status["is_current"])
        self.assertFalse(status["exploratory_thresholds"]["defaults_configured"])

    # Le déclenchement conserve le vrai jour, l'unité, le statut historique et le caractère non officiel.
    def test_user_threshold_returns_a_historical_indicator_not_an_alert(self) -> None:
        latest = self.artifact["latest_observation"]
        crossed = evaluate_exploratory_threshold(self.artifact, "T2M", "gt", latest["t2m_c"] - 0.01)
        not_crossed = evaluate_exploratory_threshold(self.artifact, "T2M", "gt", latest["t2m_c"] + 0.01)
        self.assertTrue(crossed["triggered"])
        self.assertFalse(not_crossed["triggered"])
        self.assertEqual(crossed["observation"]["date"], "2025-12-31")
        self.assertEqual(crossed["observation"]["unit"], "°C")
        self.assertFalse(crossed["is_current"])
        self.assertFalse(crossed["is_official"])

    # Les lignes exportées reprennent exactement les prédictions de l'API et ajoutent leur run.
    def test_export_rows_match_the_backtest_payload(self) -> None:
        rows = validation_export_rows(self.artifact)
        predictions = self.artifact["validation"]["predictions"]
        self.assertEqual(len(rows), len(predictions))
        self.assertEqual(rows[0]["run_id"], self.artifact["run_id"])
        self.assertEqual(rows[0]["source_sha256"], self.artifact["source"]["sha256"])
        self.assertEqual(rows[0]["valid_date"], predictions[0]["valid_date"])
        self.assertEqual(rows[0]["ridge_candidate_c"], predictions[0]["ridge_candidate_c"])


# Permet d'exécuter le fichier directement pendant la vérification locale.
if __name__ == "__main__":
    unittest.main()
