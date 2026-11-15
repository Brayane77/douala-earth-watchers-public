#!/usr/bin/env python3
"""Convertit le flux mensuel MERRA-2 PRECTOT en cumuls séparés, en mm/mois."""
from __future__ import annotations  # Autorise les annotations différées sous Python 3.10+.

import calendar  # Fournit le nombre de jours exact de chaque mois grégorien.
import csv  # Écrit un CSV standard sans dépendance supplémentaire.
from pathlib import Path  # Construit les chemins à partir du dépôt, quel que soit le terminal.

import numpy as np  # Vérifie la validité numérique des séries NetCDF.
from netCDF4 import Dataset, num2date  # Lit le fichier NetCDF4 et convertit son axe temporel.

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]  # Repère la racine du dépôt à partir de ce script.
SOURCE_FILE = REPOSITORY_ROOT / "nasa-data" / "Nasa" / "Nasa" / "g4.areaAvgTimeSeries.M2TMNXFLX_5_12_4_PRECTOT.20150101-20251231.9E_4N_9E_4N.nc"  # Garde le NetCDF source existant à son emplacement.
OUTPUT_FILE = REPOSITORY_ROOT / "nasa-data" / "csv" / "precipitation_Douala_MERRA2_monthly.csv"  # Conserve la sortie MERRA-2 distincte des séries GPM et POWER.
VARIABLE_NAME = "M2TMNXFLX_5_12_4_PRECTOT"  # Identifie explicitement la variable PRECTOT de l’export Giovanni.
EXPECTED_PERIODS = [(year, month) for year in range(2015, 2026) for month in range(1, 13)]  # Attend 132 mois continus, de janvier 2015 à décembre 2025.


def convert() -> int:  # Valide la source et écrit sa série mensuelle normalisée.
    """Valide chaque borne et convertit le flux mensuel en mm/mois."""
    if not SOURCE_FILE.is_file():  # Vérifie la présence du NetCDF avant toute lecture.
        raise FileNotFoundError(f"Fichier NetCDF source introuvable : {SOURCE_FILE}")  # Signale le chemin attendu sans chercher une autre source.

    with Dataset(SOURCE_FILE, "r") as source:  # Ouvre le NetCDF en lecture seule et le ferme automatiquement.
        if VARIABLE_NAME not in source.variables:  # Refuse un fichier qui ne contient pas la variable attendue.
            raise ValueError(f"Variable PRECTOT absente de {SOURCE_FILE.name}")  # Évite d’extraire une variable différente par erreur.
        if "time" not in source.variables or "time_bnds" not in source.variables:  # Vérifie l’axe temporel et ses bornes mensuelles.
            raise ValueError("Le NetCDF doit contenir les variables time et time_bnds.")  # Refuse une durée mensuelle devinée.

        variable = source.variables[VARIABLE_NAME]  # Sélectionne la mesure mensuelle area-averaged.
        time_variable = source.variables["time"]  # Récupère les étiquettes de début de mois.
        bounds_variable = source.variables["time_bnds"]  # Récupère les intervalles exacts utilisés pour la moyenne.
        units = str(getattr(variable, "units", "")).strip()  # Lit l’unité déclarée pour PRECTOT.
        if units != "kg m-2 s-1":  # Confirme le flux moyen annoncé dans les attributs NetCDF.
            raise ValueError(f"Unité PRECTOT inattendue : {units!r}")  # Empêche toute conversion avec une unité devinée.
        if getattr(bounds_variable, "units", None) != getattr(time_variable, "units", None):  # Vérifie que les bornes et l’axe partagent la même base temporelle.
            raise ValueError("Les unités de time et time_bnds ne correspondent pas.")  # Refuse un intervalle temporel incompatible.

        flux_masked = np.ma.asarray(variable[:])  # Préserve le masque des valeurs manquantes NetCDF.
        time_masked = np.ma.asarray(time_variable[:])  # Préserve les éventuelles dates manquantes.
        bounds_masked = np.ma.asarray(bounds_variable[:])  # Préserve les éventuelles bornes manquantes.
        if np.ma.is_masked(flux_masked) or np.ma.is_masked(time_masked) or np.ma.is_masked(bounds_masked):  # Vérifie qu’aucune ligne source n’est masquée.
            raise ValueError("Le NetCDF contient au moins une valeur ou date masquée.")  # Interdit l’interpolation silencieuse des données manquantes.

        flux = np.asarray(flux_masked, dtype=np.float64)  # Convertit les taux en double précision pour le calcul des cumuls.
        time_values = np.asarray(time_masked, dtype=np.float64)  # Convertit les dates numériques pour les validations.
        bounds = np.asarray(bounds_masked, dtype=np.float64)  # Convertit les bornes numériques pour calculer la durée réelle.
        if flux.ndim != 1 or time_values.ndim != 1 or flux.shape != time_values.shape:  # Vérifie une observation de flux pour chaque mois.
            raise ValueError("Les dimensions PRECTOT et time doivent être des séries mensuelles de même taille.")  # Refuse un fichier multidimensionnel non prévu.
        if bounds.shape != (time_values.size, 2):  # Vérifie deux bornes pour chaque mois.
            raise ValueError("time_bnds doit contenir exactement deux bornes pour chaque mois.")  # Garantit une durée définie pour chaque mesure.
        if not np.isfinite(flux).all() or not np.isfinite(time_values).all() or not np.isfinite(bounds).all():  # Vérifie que toutes les valeurs numériques sont finies.
            raise ValueError("Le NetCDF contient au moins une valeur non finie.")  # Refuse NaN ou infini sans les supprimer.
        if (flux < 0).any():  # Vérifie que le flux de précipitation ne contient pas de valeur négative.
            raise ValueError("Le NetCDF contient un taux de précipitation négatif.")  # Évite de publier une accumulation physiquement incohérente.
        for attribute in ("_FillValue", "missing_value", "fmissing_value"):  # Contrôle aussi les codes manquants non masqués par le lecteur.
            missing_value = getattr(variable, attribute, None)  # Récupère le code déclaré s’il existe.
            if missing_value is not None and np.equal(flux, float(missing_value)).any():  # Compare les observations au code source manquant.
                raise ValueError(f"PRECTOT contient le code manquant {attribute}.")  # Refuse une valeur de remplissage interprétée comme pluie.

        time_units = str(getattr(time_variable, "units", ""))  # Lit les unités des dates depuis le NetCDF.
        calendar_name = str(getattr(time_variable, "calendar", "standard"))  # Respecte le calendrier déclaré, ou le calendrier standard CF.
        if calendar_name not in {"standard", "gregorian", "proleptic_gregorian"}:  # Confirme un calendrier compatible avec les mois civils utilisés.
            raise ValueError(f"Calendrier non pris en charge pour ce convertisseur : {calendar_name}")  # Refuse un calendrier de 360 ou 365 jours qui changerait la durée du mois.
        dates = num2date(time_values, time_units, calendar=calendar_name, only_use_cftime_datetimes=False)  # Convertit les étiquettes en dates calendaires.
        observed_periods = [(date.year, date.month) for date in dates]  # Réduit les dates aux couples année-mois pour le contrôle de couverture.
        if observed_periods != EXPECTED_PERIODS:  # Confirme la couverture mensuelle continue attendue du fichier source.
            raise ValueError("La série doit couvrir sans lacune janvier 2015 à décembre 2025.")  # Empêche de générer une série incomplète sous le nom canonique.
        if any(date.day != 1 or date.hour != 0 or date.minute != 0 or date.second != 0 for date in dates):  # Vérifie que chaque étiquette correspond au début de son mois.
            raise ValueError("Chaque valeur time doit désigner le premier jour du mois à 00:00:00.")  # Garantit des dates CSV cohérentes avec l’API mensuelle.

        rows: list[tuple[str, float]] = []  # Prépare les lignes date et cumul en conservant l’ordre chronologique.
        for index, date in enumerate(dates):  # Convertit chaque mois sans modifier les fichiers GPM ou POWER existants.
            if int(bounds[index, 0]) != int(time_values[index]):  # Confirme que chaque borne commence à la date étiquetée dans time.
                raise ValueError(f"Début de time_bnds incohérent pour {date.year:04d}-{date.month:02d}.")  # Empêche un décalage temporel d’une durée pourtant correcte.
            duration_seconds = int(bounds[index, 1] - bounds[index, 0] + 1)  # Les bornes du fichier vont jusqu’à la dernière seconde incluse du mois.
            expected_seconds = calendar.monthrange(date.year, date.month)[1] * 24 * 60 * 60  # Calcule la durée du mois en secondes calendaires.
            if duration_seconds != expected_seconds:  # Compare la durée de la borne source à celle du mois civil.
                raise ValueError(f"Durée de time_bnds incorrecte pour {date.year:04d}-{date.month:02d}.")  # Refuse une conversion d’un taux moyen sur une période ambiguë.
            value_mm = float(flux[index]) * duration_seconds  # Convertit kg/m²/s en mm/mois via 1 kg/m² d’eau = 1 mm.
            if not np.isfinite(value_mm):  # Vérifie le résultat après conversion d’unité.
                raise ValueError(f"Cumul non fini pour {date.year:04d}-{date.month:02d}.")  # Refuse une valeur de sortie invalide.
            rows.append((f"{date.year:04d}-{date.month:02d}-01", value_mm))  # Normalise chaque date au premier jour du mois.

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)  # Crée le dossier de sortie uniquement s’il est absent.
    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as csv_file:  # Écrit seulement le nouveau CSV MERRA-2.
        writer = csv.writer(csv_file, lineterminator="\n")  # Utilise des fins de ligne Unix et le format CSV du chargeur du projet.
        writer.writerow(("date", "value", "sector"))  # Respecte le contrat commun des CSV mensuels du dépôt.
        for date_label, value_mm in rows:  # Écrit chaque observation validée, sans remplir de mois manquants.
            writer.writerow((date_label, f"{value_mm:.6f}", "Douala"))  # Conserve le secteur et arrondit à six décimales pour le fichier.

    values_mm = [value for _, value in rows]  # Prépare les extrêmes réellement écrits pour le résumé.
    print(f"Écrit {OUTPUT_FILE.relative_to(REPOSITORY_ROOT)} : {len(rows)} mois, {rows[0][0]} à {rows[-1][0]}, {min(values_mm):.3f}–{max(values_mm):.3f} mm/mois.")  # Récapitule la période et l’échelle sans transformer les données.
    return len(rows)  # Retourne le nombre de lignes produites pour un contrôle automatisé.


def main() -> None:  # Fournit le point d’entrée explicite du convertisseur.
    """Lance la conversion seulement lors d’une exécution directe."""
    convert()  # Exécute la conversion validée depuis le fichier source archivé.


if __name__ == "__main__":  # Distingue l’exécution directe de l’import éventuel du module.
    main()  # Lance la conversion uniquement lorsque le script est appelé comme programme.
