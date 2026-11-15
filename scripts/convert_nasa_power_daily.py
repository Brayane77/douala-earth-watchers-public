# Convertit l’export quotidien NASA POWER conservé dans le dépôt en séries mensuelles du contrat backend.
from __future__ import annotations  # Autorise les annotations différées utilisées par la fonction de validation.
from io import StringIO  # Permet de lire le tableau CSV placé après l’en-tête NASA POWER.
from pathlib import Path  # Construit des chemins stables relatifs à l’emplacement du script.
import pandas as pd  # Valide les observations quotidiennes et calcule les agrégats mensuels.
# Repère la racine du dépôt afin que le script fonctionne depuis tout répertoire courant.
ROOT = Path(__file__).resolve().parents[1]  # Le parent de scripts est la racine du projet.
# Définit le nom exact du fichier quotidien reçu depuis Google Drive.
SOURCE_FILE = ROOT / "nasa-data" / "csv" / "POWER_Point_Daily_20150101_20251231_004d05N_009d70E_LST.csv"  # L’en-tête du fichier garde la source, la zone et les unités.
# Définit le dossier des CSV mensuels lus par l’API FastAPI.
OUTPUT_DIRECTORY = ROOT / "nasa-data" / "csv"  # Les sorties utilisent le contrat date,value,sector du backend.
# Définit les noms de sortie sans écraser les séries déjà présentes.
TEMPERATURE_OUTPUT = "temperature_Douala_POWER_monthly.csv"  # Ce fichier représente la moyenne mensuelle de T2M quotidien.
# Définit le second nom de sortie pour le cumul mensuel de précipitations corrigées.
PRECIPITATION_OUTPUT = "precipitation_Douala_POWER_monthly.csv"  # Ce fichier représente la somme des valeurs quotidiennes PRECTOTCORR.
# Charge et valide les observations quotidiennes du fichier NASA POWER.
def load_daily_source() -> pd.DataFrame:  # La fonction refuse une date absente, un jour dupliqué ou une valeur manquante.
    # Lit les lignes textuelles en conservant correctement les caractères UTF‑8 éventuels.
    lines = SOURCE_FILE.read_text(encoding="utf-8-sig").splitlines()  # Les lignes de métadonnées précèdent le tableau CSV.
    # Vérifie que le séparateur d’en-tête NASA POWER est présent.
    if "-END HEADER-" not in lines:  # Un fichier sans marqueur ne doit pas être interprété à l’aveugle.
        raise ValueError(f"En-tête NASA POWER introuvable dans {SOURCE_FILE.name}")  # Le message identifie la source à corriger.
    # Place la lecture tabulaire juste après les métadonnées de l’export.
    table_start = lines.index("-END HEADER-") + 1  # La ligne suivante contient YEAR,DOY,T2M,PRECTOTCORR.
    # Lit le tableau de données sans inclure son en-tête NASA POWER comme une ligne d’observation.
    frame = pd.read_csv(StringIO("\n".join(lines[table_start:])))  # Les colonnes source restent inchangées.
    # Déclare les colonnes minimales attendues pour les deux indicateurs.
    required_columns = {"YEAR", "DOY", "T2M", "PRECTOTCORR"}  # Ces noms sont fournis par le CSV source.
    # Établit les colonnes absentes pour produire un message de validation précis.
    missing_columns = required_columns.difference(frame.columns)  # Aucune colonne de variable n’est devinée.
    # Refuse un export dont le schéma ne contient pas les variables documentées.
    if missing_columns:  # Le traitement ne peut pas reconstruire les champs manquants.
        raise ValueError(f"Colonnes NASA POWER absentes: {sorted(missing_columns)}")  # Le détail facilite la correction du fichier.
    # Convertit l’année en nombre et marque les valeurs illisibles comme invalides.
    years = pd.to_numeric(frame["YEAR"], errors="coerce")  # YEAR identifie l’année civile de chaque observation.
    # Convertit le jour ordinal de l’année en nombre pour construire les dates.
    day_of_year = pd.to_numeric(frame["DOY"], errors="coerce")  # DOY varie de 1 à 365 ou 366 selon l’année.
    # Refuse les dates source dont YEAR ou DOY ne sont pas numériques.
    if years.isna().any() or day_of_year.isna().any():  # Aucune date invalide n’est ignorée silencieusement.
        raise ValueError("YEAR ou DOY contient une valeur absente ou non numérique.")  # Le fichier source doit être corrigé avant conversion.
    # Reconstruit la date calendaire depuis l’année et le jour ordinal NASA POWER.
    frame["date"] = pd.to_datetime(years.astype(int).astype(str) + day_of_year.astype(int).astype(str).str.zfill(3), format="%Y%j", errors="coerce")  # Les dates restent dans le calendrier local indiqué par l’export.
    # Refuse une date impossible, comme un jour ordinal hors de son année.
    if frame["date"].isna().any():  # Une date ambiguë ne doit pas atteindre les graphiques.
        raise ValueError("Le CSV NASA POWER contient une date YEAR/DOY invalide.")  # Le message renvoie à la période et au jour ordinal.
    # Convertit la température et le taux quotidien de précipitation en nombres finis.
    for column in ("T2M", "PRECTOTCORR"):  # Ces variables sont décrites dans l’en-tête du fichier.
        frame[column] = pd.to_numeric(frame[column], errors="coerce")  # Les valeurs illisibles deviennent invalides.
        if frame[column].isna().any() or frame[column].eq(-999).any():  # -999 est le code de valeur manquante de l’en-tête NASA POWER.
            raise ValueError(f"La colonne {column} contient une valeur manquante ou invalide.")  # Aucune valeur manquante n’est imputée.
    # Ordonne les lignes par date et donne un index stable aux contrôles suivants.
    frame = frame.sort_values("date").reset_index(drop=True)  # Le tri permet de tester la continuité journalière.
    # Vérifie qu’aucun jour source ne figure plusieurs fois.
    if frame["date"].duplicated().any():  # Une observation par jour est attendue pour chaque variable.
        raise ValueError("Le fichier NASA POWER contient des dates quotidiennes dupliquées.")  # Les doublons sont rejetés plutôt que moyennés.
    # Construit la suite de dates quotidiennes attendue entre les bornes du fichier.
    expected_dates = pd.Series(pd.date_range(frame["date"].min(), frame["date"].max(), freq="D"), name="date")  # Les années bissextiles sont incluses par le calendrier.
    # Refuse une période quotidienne avec une lacune ou un jour supplémentaire.
    if not frame["date"].equals(expected_dates):  # Chaque jour de la période doit être présent exactement une fois.
        raise ValueError("La période NASA POWER contient un jour manquant ou une séquence discontinue.")  # L’agrégation mensuelle ne masque pas une lacune.
    # Retourne les mesures journalières seulement après validation du schéma, des valeurs et du calendrier.
    return frame  # Les unités restent celles documentées dans l’en-tête d’origine.
# Écrit une série mensuelle au format canonique consommé par le backend.
def write_monthly_series(series: pd.Series, filename: str) -> None:  # La fonction ne modifie aucune valeur autrement que par l’agrégation choisie.
    # Forme les trois colonnes obligatoires de l’API avec une zone explicite.
    output = pd.DataFrame({"date": series.index.strftime("%Y-%m-%d"), "value": series.to_numpy(), "sector": "Douala"})  # Les dates indiquent le début de chaque mois agrégé.
    # Sauvegarde la série dérivée sans index et avec une précision numérique reproductible.
    output.to_csv(OUTPUT_DIRECTORY / filename, index=False, float_format="%.6f")  # Le CSV source quotidien demeure conservé séparément.
# Exécute la validation et les deux agrégations documentées.
def main() -> None:  # T2M devient une moyenne mensuelle et PRECTOTCORR un cumul mensuel.
    # Charge toutes les lignes quotidiennes après les contrôles de validité.
    daily = load_daily_source()  # Le fichier conserve ses 4 018 dates de 2015 à 2025.
    # Indexe les dates pour regrouper les observations par mois calendaire.
    indexed = daily.set_index("date")  # Les mois sont alignés au premier jour du mois.
    # Calcule la moyenne arithmétique des températures journalières en degrés Celsius.
    monthly_temperature = indexed["T2M"].resample("MS").mean()  # T2M est fourni en °C dans le fichier NASA POWER.
    # Calcule le cumul mensuel en additionnant les taux quotidiens exprimés en millimètres par jour.
    monthly_precipitation = indexed["PRECTOTCORR"].resample("MS").sum(min_count=1)  # mm/jour additionnés par jour donnent un cumul mensuel en mm/mois.
    # Refuse une série mensuelle incomplète au lieu de produire des trous ou des valeurs estimées.
    if monthly_temperature.isna().any() or monthly_precipitation.isna().any():  # Les 132 mois attendus doivent tous contenir des données valides.
        raise ValueError("Une agrégation mensuelle NASA POWER est vide ou invalide.")  # L’API ne doit pas masquer une anomalie source.
    # Enregistre la série de températures sous une identité distincte des autres produits MERRA‑2.
    write_monthly_series(monthly_temperature, TEMPERATURE_OUTPUT)  # Le fichier canonique est ensuite lu par backend/nasa_data.py.
    # Enregistre les précipitations corrigées séparément des séries GPM existantes.
    write_monthly_series(monthly_precipitation, PRECIPITATION_OUTPUT)  # Le cumul conserve son unité mm/mois.
    # Affiche le nombre de mois dérivés et la période calculée depuis le fichier.
    print(f"NASA POWER : {len(monthly_temperature)} mois, de {monthly_temperature.index.min():%Y-%m} à {monthly_temperature.index.max():%Y-%m}.")  # Le résultat reste vérifiable après conversion.
# Lance la conversion uniquement lorsque le script est exécuté directement.
if __name__ == "__main__":  # L’import du module ne déclenche pas de génération de fichiers.
    main()  # Recrée les deux CSV dérivés depuis le fichier brut conservé.
