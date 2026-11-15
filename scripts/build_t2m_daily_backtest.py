# Pré-calcule un backtest chronologique T2M; l'API et l'ouverture des pages ne lancent pas ce script.
"""Commande explicite de génération du rapport quotidien T2M versionné.

Exécuter depuis la racine du dépôt avec :
    .venv/bin/python scripts/build_t2m_daily_backtest.py

Le script lit uniquement l'archive locale NASA POWER, vérifie son intégrité
structurelle, évalue des origines chronologiques en 2025 et écrit un JSON
reproductible. Il ne récupère aucune nouvelle donnée et ne publie pas de
prévision actuelle.
"""
# Les types différés facilitent la lecture du code de génération et de ses résultats.
from __future__ import annotations

# json sauvegarde le manifeste et les métriques en texte reproductible.
import json
# Path résout la racine du dépôt afin que la commande fonctionne depuis tout répertoire courant.
from pathlib import Path
# sys rend le package backend importable lorsque Python démarre depuis le dossier scripts.
import sys
# La racine est ajoutée explicitement sans modifier les variables globales de l'utilisateur.
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))
# L'API et le script partagent le même pipeline afin d'éviter deux configurations divergentes.
from backend.daily_forecast import BACKTEST_ARTIFACT_FILE, build_backtest_artifact


# Écrit le backtest pré-calculé après validation de la source et du protocole.
def main() -> None:
    """Génère l'artefact et imprime les empreintes et métriques pour contrôle."""
    artifact = build_backtest_artifact()
    BACKTEST_ARTIFACT_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = BACKTEST_ARTIFACT_FILE.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_path.replace(BACKTEST_ARTIFACT_FILE)

    print(f"Rapport : {BACKTEST_ARTIFACT_FILE.relative_to(Path.cwd()) if BACKTEST_ARTIFACT_FILE.is_relative_to(Path.cwd()) else BACKTEST_ARTIFACT_FILE}")
    print(f"Run ID : {artifact['run_id']}")
    print(f"Source SHA-256 : {artifact['source']['sha256']}")
    print(f"Code SHA-256 : {artifact['code_sha256']}")
    for horizon, result in artifact["validation"]["metrics_by_horizon"].items():
        print(f"J+{horizon}, N={result['n']}, dates={result['validation_period']['start']}..{result['validation_period']['end']}")
        for model_name, scores in result["models"].items():
            print(f"  {model_name}: MAE={scores['mae']:.6f} °C, RMSE={scores['rmse']:.6f} °C")


# N'exécute le pré-calcul que lors d'une commande explicite en terminal.
if __name__ == "__main__":
    main()
