#!/usr/bin/env python3
"""
Script robuste pour convertir le fichier GPM brut en CSV compatible.

Usage:
    python scripts/convert_gpm_final.py
"""

import os  # Importe les dépendances utilisées par cette étape.
import csv  # Importe les dépendances utilisées par cette étape.
import pandas as pd  # Importe les dépendances utilisées par cette étape.

# Chemins
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_FILE = os.path.join(BASE_DIR, 'nasa-data', 'precipitation_Douala_GPM_raw.csv')  # Initialise ou met à jour `INPUT_FILE` pour la suite du traitement.
OUTPUT_FILE = os.path.join(BASE_DIR, 'nasa-data', 'csv', 'precipitation_Douala_GPM.csv')  # Initialise ou met à jour `OUTPUT_FILE` pour la suite du traitement.

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)  # Exécute cette étape du traitement avec les données déjà contrôlées.


def process_gpm_file():  # Définit la fonction et son rôle dans le traitement.
    """Traiter le fichier GPM."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("CONVERSION FICHIER GPM → CSV MENSUEL")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Lire le fichier ligne par ligne
    with open(INPUT_FILE, 'r') as f:
        lines = f.readlines()  # Initialise ou met à jour `lines` pour la suite du traitement.
    
    print(f"Lignes totales: {len(lines)}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Trouver la ligne où commencent les données (après la ligne vide)
    data_start = None
    for i, line in enumerate(lines):  # Parcourt les éléments nécessaires au traitement.
        if line.strip() == '':  # Vérifie la condition avant de poursuivre le traitement.
            # La ligne suivante devrait être l'en-tête des données
            if i + 1 < len(lines) and 'time' in lines[i + 1].lower():
                data_start = i + 2  # Commencer après l'en-tête
                break  # Contrôle le déroulement de la boucle ou du bloc courant.
    
    if data_start is None:  # Vérifie la condition avant de poursuivre le traitement.
        print("Impossible de trouver le début des données")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return False  # Renvoie le résultat de cette étape à son appelant.
    
    print(f"Début des données: ligne {data_start}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Lire les données avec csv.reader
    data_lines = lines[data_start:]
    
    # Utiliser csv.reader pour gérer correctement les guillemets
    reader = csv.reader(data_lines)
    data = list(reader)  # Initialise ou met à jour `data` pour la suite du traitement.
    
    print(f"Lignes de données: {len(data)}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Convertir en DataFrame
    df = pd.DataFrame(data, columns=['date', 'precipitation'])
    
    # Convertir la date en datetime
    df['date'] = pd.to_datetime(df['date'])
    
    # Convertir la précipitation en float
    df['precipitation'] = pd.to_numeric(df['precipitation'], errors='coerce')
    
    # Filtrer les valeurs invalides
    df = df[df['precipitation'] != -9999.9]
    df = df.dropna()  # Initialise ou met à jour `df` pour la suite du traitement.
    
    print(f"Donnees nettoyees: {len(df)} lignes")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Convertir en mensuel
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    df_monthly = df.groupby(['year', 'month']).agg({  # Initialise ou met à jour `df_monthly` pour la suite du traitement.
        'precipitation': 'mean'  # Exécute cette étape du traitement avec les données déjà contrôlées.
    }).reset_index()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    df_monthly['date'] = pd.to_datetime(  # Exécute cette étape du traitement avec les données déjà contrôlées.
        df_monthly['year'].astype(str) + '-' +   # Exécute cette étape du traitement avec les données déjà contrôlées.
        df_monthly['month'].astype(str).str.zfill(2) + '-01'  # Exécute cette étape du traitement avec les données déjà contrôlées.
    )  # Ferme la structure ouverte plus haut.
    
    df_monthly = df_monthly[['date', 'precipitation']]  # Initialise ou met à jour `df_monthly` pour la suite du traitement.
    df_monthly.columns = ['date', 'value']  # Exécute cette étape du traitement avec les données déjà contrôlées.
    df_monthly['sector'] = 'Douala'  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    print(f"Conversion mensuelle: {len(df_monthly)} mois")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Sauvegarder
    df_monthly.to_csv(OUTPUT_FILE, index=False)
    
    print(f"Fichier sauvegarde: {OUTPUT_FILE}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"   Contient {len(df_monthly)} mois de données")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Afficher un aperçu
    print()
    print("Aperçu des données:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(df_monthly.head(10))  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    return True  # Renvoie le résultat de cette étape à son appelant.


if __name__ == "__main__":  # Vérifie la condition avant de poursuivre le traitement.
    if not os.path.exists(INPUT_FILE):  # Vérifie la condition avant de poursuivre le traitement.
        print(f"Fichier non trouvé: {INPUT_FILE}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("Veuillez télécharger le fichier depuis:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("https://github.com/wagueduclair-byte/DOUALA-EARTH-WATCHER/raw/main/g4.areaAvgTimeSeries.GPM_3IMERGDL_07_precipitation.20150101-20251231.9E_3N_9E_4N.csv")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("et le placer dans: nasa-data/precipitation_Douala_GPM_raw.csv")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    else:  # Exécute cette étape du traitement avec les données déjà contrôlées.
        if process_gpm_file():  # Vérifie la condition avant de poursuivre le traitement.
            print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("CONVERSION TERMINEE AVEC SUCCES")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print(f"Fichier généré: {OUTPUT_FILE}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("Pour utiliser ce fichier:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("1. Renommez-le en 'precipitation_Douala.csv' (écrase l'ancien)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("2. Redémarrez le backend")  # Exécute cette étape du traitement avec les données déjà contrôlées.
