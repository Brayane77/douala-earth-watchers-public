#!/usr/bin/env python3
"""
Script pour corriger les unités du fichier GPM.

Le fichier GPM contient des taux de précipitation en mm/jour.
Pour être compatible avec MERRA-2 (mm/mois), il faut multiplier par le nombre de jours du mois.

Usage:
    python scripts/fix_gpm_units.py
"""

import os  # Importe les dépendances utilisées par cette étape.
import pandas as pd  # Importe les dépendances utilisées par cette étape.
from calendar import monthrange  # Importe les dépendances utilisées par cette étape.

# Chemins
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_FILE = os.path.join(BASE_DIR, 'nasa-data', 'csv', 'precipitation_Douala_GPM.csv')  # Initialise ou met à jour `INPUT_FILE` pour la suite du traitement.
OUTPUT_FILE = os.path.join(BASE_DIR, 'nasa-data', 'csv', 'precipitation_Douala_GPM_mm.csv')  # Initialise ou met à jour `OUTPUT_FILE` pour la suite du traitement.


def fix_units():  # Définit la fonction et son rôle dans le traitement.
    """Corriger les unités GPM."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("CORRECTION DES UNITÉS GPM (mm/jour → mm/mois)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Lire le fichier GPM
    df = pd.read_csv(INPUT_FILE)
    df['date'] = pd.to_datetime(df['date'])  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    print(f"Fichier source: {INPUT_FILE}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Lignes: {len(df)}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Moyenne actuelle: {df['value'].mean():.2f}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Min: {df['value'].min():.2f}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Max: {df['value'].max():.2f}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Ajouter les colonnes année et mois
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Calculer le nombre de jours pour chaque mois
    df['days_in_month'] = df.apply(lambda row: monthrange(row['year'], row['month'])[1], axis=1)
    
    # Convertir mm/jour en mm/mois
    df['value_mm'] = df['value'] * df['days_in_month']
    
    # Créer le DataFrame final
    df_final = df[['date', 'value_mm', 'sector']].copy()
    df_final.columns = ['date', 'value', 'sector']  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    print(f"Moyenne après correction: {df_final['value'].mean():.2f}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Min: {df_final['value'].min():.2f}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"Max: {df_final['value'].max():.2f}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Sauvegarder
    df_final.to_csv(OUTPUT_FILE, index=False)
    
    print(f"Fichier sauvegardé: {OUTPUT_FILE}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Comparaison avec MERRA-2
    merra = pd.read_csv(os.path.join(BASE_DIR, 'nasa-data', 'csv', 'precipitation_Douala.csv'))
    merra['date'] = pd.to_datetime(merra['date'])  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    merged = pd.merge(merra, df_final, on='date', suffixes=('_MERRA', '_GPM'))  # Initialise ou met à jour `merged` pour la suite du traitement.
    
    print("Comparaison avec MERRA-2:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"  Moyenne MERRA: {merra['value'].mean():.2f} mm/mois")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"  Moyenne GPM: {df_final['value'].mean():.2f} mm/mois")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"  Différence moyenne: {merged['value_GPM'].mean() - merged['value_MERRA'].mean():.2f} mm/mois")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print(f"  Corrélation: {merra['value'].corr(df_final['value']):.4f}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    return True  # Renvoie le résultat de cette étape à son appelant.


if __name__ == "__main__":  # Vérifie la condition avant de poursuivre le traitement.
    if not os.path.exists(INPUT_FILE):  # Vérifie la condition avant de poursuivre le traitement.
        print(f"Fichier non trouvé: {INPUT_FILE}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("Veuillez d'abord exécuter:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("python scripts/convert_gpm_final.py")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    else:  # Exécute cette étape du traitement avec les données déjà contrôlées.
        if fix_units():  # Vérifie la condition avant de poursuivre le traitement.
            print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("CORRECTION TERMINÉE")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("=" * 70)  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print(f"Fichier final: {OUTPUT_FILE}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("Pour utiliser ce fichier:")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("1. Renommez-le en 'precipitation_Douala.csv' (écrase l'ancien)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print("2. Redémarrez le backend")  # Exécute cette étape du traitement avec les données déjà contrôlées.
