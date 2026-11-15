#!/usr/bin/env python3
"""
Script pour convertir le fichier GPM brut en CSV compatible avec l'application.

Ce script suppose que le fichier GPM est déjà téléchargé dans nasa-data/

Usage:
    python scripts/convert_gpm_to_csv.py [chemin_vers_fichier_gpm]

Exemple:
    python scripts/convert_gpm_to_csv.py nasa-data/precipitation_Douala_GPM_raw.csv

Requirements:
    pip install pandas
"""

import os  # Importe les dépendances utilisées par cette étape.
import sys  # Importe les dépendances utilisées par cette étape.
import pandas as pd  # Importe les dépendances utilisées par cette étape.
import numpy as np  # Importe les dépendances utilisées par cette étape.

# Chemin par défaut
DEFAULT_INPUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                           'nasa-data', 'precipitation_Douala_GPM_raw.csv')  # Exécute cette étape du traitement avec les données déjà contrôlées.
DEFAULT_OUTPUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),   # Initialise ou met à jour `DEFAULT_OUTPUT` pour la suite du traitement.
                            'nasa-data', 'csv', 'precipitation_Douala_GPM.csv')  # Exécute cette étape du traitement avec les données déjà contrôlées.


def find_data_start(df):  # Définit la fonction et son rôle dans le traitement.
    """Trouver la première ligne de données dans le DataFrame."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    for i, row in df.iterrows():  # Parcourt les éléments nécessaires au traitement.
        # Vérifier si la première colonne contient une date
        try:
            pd.to_datetime(row.iloc[0])  # Exécute cette étape du traitement avec les données déjà contrôlées.
            return i  # Renvoie le résultat de cette étape à son appelant.
        except:  # Exécute cette étape du traitement avec les données déjà contrôlées.
            continue  # Contrôle le déroulement de la boucle ou du bloc courant.
    return 0  # Renvoie le résultat de cette étape à son appelant.


def clean_and_convert(input_file, output_file):  # Définit la fonction et son rôle dans le traitement.
    """Nettoyer le fichier GPM et convertir en format mensuel."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Lecture de {input_file}...")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    try:  # Ouvre le contexte contrôlé de cette opération.
        # Lire le fichier
        df = pd.read_csv(input_file)
        print(f"   Lignes lues: {len(df)}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Trouver où commencent les données
        start_row = find_data_start(df)
        print(f"   Début des données: ligne {start_row}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Extraire les données
        df_clean = df.iloc[start_row:].reset_index(drop=True)
        
        # Renommer les colonnes
        df_clean.columns = ['date', 'precipitation']
        
        # Convertir la date en datetime
        df_clean['date'] = pd.to_datetime(df_clean['date'])
        
        # Filtrer les valeurs invalides (Fill Value = -9999.9)
        df_clean = df_clean[df_clean['precipitation'] != -9999.9]
        df_clean = df_clean.dropna()  # Initialise ou met à jour `df_clean` pour la suite du traitement.
        
        print(f"Données nettoyées: {len(df_clean)} lignes")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Convertir en mensuel
        df_clean['year'] = df_clean['date'].dt.year
        df_clean['month'] = df_clean['date'].dt.month  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        df_monthly = df_clean.groupby(['year', 'month']).agg({  # Initialise ou met à jour `df_monthly` pour la suite du traitement.
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
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        df_monthly.to_csv(output_file, index=False)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        print(f"Fichier sauvegardé: {output_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print(f"   Contient {len(df_monthly)} mois de données")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        return True  # Renvoie le résultat de cette étape à son appelant.
        
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Erreur: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        import traceback  # Importe les dépendances utilisées par cette étape.
        traceback.print_exc()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return False  # Renvoie le résultat de cette étape à son appelant.


def main():  # Définit la fonction et son rôle dans le traitement.
    """Processus principal."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("CONVERSION FICHIER GPM → CSV MENSUEL")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Récupérer le fichier d'entrée
    if len(sys.argv) > 1:
        input_file = sys.argv[1]  # Initialise ou met à jour `input_file` pour la suite du traitement.
    else:  # Exécute cette étape du traitement avec les données déjà contrôlées.
        input_file = DEFAULT_INPUT  # Initialise ou met à jour `input_file` pour la suite du traitement.
        print(f"Aucun fichier spécifié, utilisation du fichier par défaut:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print(f"   {input_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Vérifier que le fichier existe
    if not os.path.exists(input_file):
        print(f"Fichier non trouvé: {input_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("Pour télécharger le fichier manuellement:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("1. Allez sur:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("   https://github.com/wagueduclair-byte/DOUALA-EARTH-WATCHER/raw/main/g4.areaAvgTimeSeries.GPM_3IMERGDL_07_precipitation.20150101-20251231.9E_3N_9E_4N.csv")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("2. Téléchargez le fichier")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("3. Placez-le dans: nasa-data/precipitation_Douala_GPM_raw.csv")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("4. Relancez ce script")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    print(f"Fichier source: {input_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Fichier destination: {DEFAULT_OUTPUT}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Convertir
    if clean_and_convert(input_file, DEFAULT_OUTPUT):
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("CONVERSION TERMINÉE AVEC SUCCÈS")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print(f"Fichier généré: {DEFAULT_OUTPUT}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("Pour utiliser ce fichier avec l'application:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("1. Renommez-le en 'precipitation_Douala.csv' (écrase l'ancien)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("   OU")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("2. Modifiez nasa_data.py pour charger 'precipitation_Douala_GPM.csv'")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("Pour comparer GPM et MERRA-2:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("1. Gardez les deux fichiers")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("2. Modifiez le backend pour charger les deux sources")  # Exécute cette étape du traitement avec les données déjà contrôlées.


if __name__ == "__main__":  # Vérifie la condition avant de poursuivre le traitement.
    main()  # Exécute cette étape du traitement avec les données déjà contrôlées.
