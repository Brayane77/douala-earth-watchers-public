#!/usr/bin/env python3
"""
Script pour traiter et convertir les données GPM en format compatible avec l'application.

Ce script:
1. Télécharge le fichier CSV depuis GitHub
2. Nettoie les métadonnées
3. Convertit les données quotidiennes en mensuelles
4. Sauvegarde dans nasa-data/csv/

Usage:
    python scripts/process_gpm_data.py

Requirements:
    pip install pandas
"""

import os  # Importe les dépendances utilisées par cette étape.
import sys  # Importe les dépendances utilisées par cette étape.
import pandas as pd  # Importe les dépendances utilisées par cette étape.
import numpy as np  # Importe les dépendances utilisées par cette étape.
from datetime import datetime  # Importe les dépendances utilisées par cette étape.

# Chemins
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_DIR = os.path.join(BASE_DIR, 'nasa-data', 'csv')  # Initialise ou met à jour `CSV_DIR` pour la suite du traitement.

# URL du fichier source
GPM_CSV_URL = "https://raw.githubusercontent.com/wagueduclair-byte/DOUALA-EARTH-WATCHER/main/g4.areaAvgTimeSeries.GPM_3IMERGDL_07_precipitation.20150101-20251231.9E_3N_9E_4N.csv"

# Nom du fichier de sortie
OUTPUT_CSV = os.path.join(CSV_DIR, 'precipitation_Douala_GPM.csv')

os.makedirs(CSV_DIR, exist_ok=True)  # Exécute cette étape du traitement avec les données déjà contrôlées.


def download_gpm_data():  # Définit la fonction et son rôle dans le traitement.
    """Télécharger le fichier GPM depuis GitHub."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    import requests  # Importe les dépendances utilisées par cette étape.
    
    print("Téléchargement du fichier GPM depuis GitHub...")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    try:  # Ouvre le contexte contrôlé de cette opération.
        response = requests.get(GPM_CSV_URL, stream=True)  # Initialise ou met à jour `response` pour la suite du traitement.
        response.raise_for_status()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Sauvegarder temporairement
        temp_file = os.path.join(CSV_DIR, 'GPM_temp.csv')
        with open(temp_file, 'wb') as f:  # Ouvre le contexte contrôlé de cette opération.
            for chunk in response.iter_content(chunk_size=8192):  # Parcourt les éléments nécessaires au traitement.
                f.write(chunk)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        print(f"Fichier téléchargé: {temp_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return temp_file  # Renvoie le résultat de cette étape à son appelant.
        
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Erreur de téléchargement: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return None  # Renvoie le résultat de cette étape à son appelant.


def clean_gpm_data(temp_file):  # Définit la fonction et son rôle dans le traitement.
    """Nettoyer les métadonnées et extraire les données."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("Nettoyage des métadonnées...")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    try:  # Ouvre le contexte contrôlé de cette opération.
        # Lire le fichier
        df = pd.read_csv(temp_file)
        
        # Trouver la ligne où commencent les données (après les métadonnées)
        # Les données commencent quand on a une colonne 'time'
        start_row = None
        for i, row in df.iterrows():  # Parcourt les éléments nécessaires au traitement.
            if 'time' in str(row.values[0]).lower() or pd.notna(row.values[0]):  # Vérifie la condition avant de poursuivre le traitement.
                # Vérifier si c'est une date
                try:
                    pd.to_datetime(row.values[0])  # Exécute cette étape du traitement avec les données déjà contrôlées.
                    start_row = i  # Initialise ou met à jour `start_row` pour la suite du traitement.
                    break  # Contrôle le déroulement de la boucle ou du bloc courant.
                except:  # Exécute cette étape du traitement avec les données déjà contrôlées.
                    continue  # Contrôle le déroulement de la boucle ou du bloc courant.
        
        if start_row is None:  # Vérifie la condition avant de poursuivre le traitement.
            print("Impossible de trouver le début des données")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            return None  # Renvoie le résultat de cette étape à son appelant.
        
        # Extraire les données à partir de cette ligne
        df_clean = df.iloc[start_row:].reset_index(drop=True)
        
        # Renommer les colonnes
        df_clean.columns = ['date', 'precipitation']
        
        # Convertir la date en datetime
        df_clean['date'] = pd.to_datetime(df_clean['date'])
        
        # Filtrer les valeurs invalides (Fill Value = -9999.9)
        df_clean = df_clean[df_clean['precipitation'] != -9999.9]
        df_clean = df_clean.dropna()  # Initialise ou met à jour `df_clean` pour la suite du traitement.
        
        print(f"Données nettoyées: {len(df_clean)} lignes")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return df_clean  # Renvoie le résultat de cette étape à son appelant.
        
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Erreur de nettoyage: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return None  # Renvoie le résultat de cette étape à son appelant.


def convert_daily_to_monthly(df_daily):  # Définit la fonction et son rôle dans le traitement.
    """Convertir les données quotidiennes en mensuelles (moyenne)."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("Conversion quotidienne → mensuelle...")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    try:  # Ouvre le contexte contrôlé de cette opération.
        # Extraire année et mois
        df_daily['year'] = df_daily['date'].dt.year
        df_daily['month'] = df_daily['date'].dt.month  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Grouper par année-mois et calculer la moyenne
        df_monthly = df_daily.groupby(['year', 'month']).agg({
            'precipitation': 'mean'  # Exécute cette étape du traitement avec les données déjà contrôlées.
        }).reset_index()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Créer une colonne date (premier jour du mois)
        df_monthly['date'] = pd.to_datetime(
            df_monthly['year'].astype(str) + '-' +   # Exécute cette étape du traitement avec les données déjà contrôlées.
            df_monthly['month'].astype(str).str.zfill(2) + '-01'  # Exécute cette étape du traitement avec les données déjà contrôlées.
        )  # Ferme la structure ouverte plus haut.
        
        # Conserver seulement les colonnes nécessaires
        df_monthly = df_monthly[['date', 'precipitation']]
        
        # Renommer la colonne pour correspondre à notre format
        df_monthly.columns = ['date', 'value']
        
        # Ajouter la colonne sector
        df_monthly['sector'] = 'Douala'
        
        print(f"Conversion terminée: {len(df_monthly)} mois")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return df_monthly  # Renvoie le résultat de cette étape à son appelant.
        
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Erreur de conversion: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return None  # Renvoie le résultat de cette étape à son appelant.


def save_final_csv(df_monthly, output_path):  # Définit la fonction et son rôle dans le traitement.
    """Sauvegarder le fichier CSV final."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Sauvegarde dans {output_path}...")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    try:  # Ouvre le contexte contrôlé de cette opération.
        df_monthly.to_csv(output_path, index=False)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print(f"Fichier sauvegardé: {output_path}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print(f"   Contient {len(df_monthly)} mois de données")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return True  # Renvoie le résultat de cette étape à son appelant.
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Erreur de sauvegarde: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return False  # Renvoie le résultat de cette étape à son appelant.


def main():  # Définit la fonction et son rôle dans le traitement.
    """Processus complet."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("TRAITEMENT DES DONNÉES GPM")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Étape 1 : Télécharger
    temp_file = download_gpm_data()
    if temp_file is None:  # Vérifie la condition avant de poursuivre le traitement.
        return  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Étape 2 : Nettoyer
    df_clean = clean_gpm_data(temp_file)
    if df_clean is None:  # Vérifie la condition avant de poursuivre le traitement.
        return  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Étape 3 : Convertir en mensuel
    df_monthly = convert_daily_to_monthly(df_clean)
    if df_monthly is None:  # Vérifie la condition avant de poursuivre le traitement.
        return  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Étape 4 : Sauvegarder
    if save_final_csv(df_monthly, OUTPUT_CSV):
        # Supprimer le fichier temporaire
        os.remove(temp_file)
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("TRAITEMENT TERMINÉ AVEC SUCCÈS")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print(f"Fichier final: {OUTPUT_CSV}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print(f"Contient: {len(df_monthly)} mois de données (2015-2025)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("Pour utiliser ce fichier avec l'application:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("1. Renommez-le en 'precipitation_Douala.csv'")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("2. Ou modifiez nasa_data.py pour charger 'precipitation_Douala_GPM.csv'")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("Pour fusionner avec les données existantes:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("1. Placez les deux fichiers dans nasa-data/csv/")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("2. Le backend chargera automatiquement les données étendues")  # Exécute cette étape du traitement avec les données déjà contrôlées.


if __name__ == "__main__":  # Vérifie la condition avant de poursuivre le traitement.
    main()  # Exécute cette étape du traitement avec les données déjà contrôlées.
