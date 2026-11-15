#!/usr/bin/env python3
"""
Script pour convertir les fichiers NetCDF NASA MERRA-2 en CSV
et les fusionner avec les données existantes.

Usage:
    python convert_nc_to_csv.py

Requirements:
    pip install netCDF4 pandas
"""

import os  # Importe les dépendances utilisées par cette étape.
import sys  # Importe les dépendances utilisées par cette étape.
from netCDF4 import Dataset  # Importe les dépendances utilisées par cette étape.
import pandas as pd  # Importe les dépendances utilisées par cette étape.
import numpy as np  # Importe les dépendances utilisées par cette étape.

# Chemins
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NC_DIR = os.path.join(BASE_DIR, 'nasa-data', 'nc')  # Initialise ou met à jour `NC_DIR` pour la suite du traitement.
CSV_DIR = os.path.join(BASE_DIR, 'nasa-data', 'csv')  # Initialise ou met à jour `CSV_DIR` pour la suite du traitement.

# S'assurer que les dossiers existent
os.makedirs(NC_DIR, exist_ok=True)
os.makedirs(CSV_DIR, exist_ok=True)  # Exécute cette étape du traitement avec les données déjà contrôlées.

# Mapping des variables NetCDF vers nos noms
VARIABLE_MAP = {
    'T2M': 'temperature',  # Exécute cette étape du traitement avec les données déjà contrôlées.
    'PRECTOT': 'precipitation',  # Exécute cette étape du traitement avec les données déjà contrôlées.
    'T10M': 'temperature_10m',  # Exécute cette étape du traitement avec les données déjà contrôlées.
    'TLML': 'temperature_lml',  # Exécute cette étape du traitement avec les données déjà contrôlées.
}  # Ferme la structure ouverte plus haut.

# Coordonnées de Douala (pour vérification)
DOUALA_LAT = 4.05
DOUALA_LON = 9.75  # Initialise ou met à jour `DOUALA_LON` pour la suite du traitement.

def extract_nc_to_csv(nc_file, variable_name, output_csv):  # Définit la fonction et son rôle dans le traitement.
    """
    Extraire une variable d'un fichier NetCDF et la sauvegarder en CSV.
    
    Args:
        nc_file: Chemin vers le fichier NetCDF
        variable_name: Nom de la variable à extraire
        output_csv: Chemin vers le fichier CSV de sortie
    """
    try:  # Ouvre le contexte contrôlé de cette opération.
        # Ouvrir le fichier NetCDF
        nc = Dataset(nc_file, 'r')
        
        # Extraire les données
        if variable_name not in nc.variables:
            print(f"Variable '{variable_name}' non trouvée dans {nc_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            print(f"   Variables disponibles: {list(nc.variables.keys())}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            return False  # Renvoie le résultat de cette étape à son appelant.
        
        var_data = nc.variables[variable_name][:]  # Initialise ou met à jour `var_data` pour la suite du traitement.
        time_var = nc.variables['time']  # Initialise ou met à jour `time_var` pour la suite du traitement.
        
        # Convertir le temps en dates
        time_units = time_var.units
        time_calendar = getattr(time_var, 'calendar', 'standard')  # Initialise ou met à jour `time_calendar` pour la suite du traitement.
        
        # Conversion du temps (netCDF time units)
        if 'since' in time_units:
            ref_date_str = time_units.split('since')[-1].strip()  # Initialise ou met à jour `ref_date_str` pour la suite du traitement.
            from datetime import datetime  # Importe les dépendances utilisées par cette étape.
            ref_date = datetime.strptime(ref_date_str, '%Y-%m-%d %H:%M:%S')  # Initialise ou met à jour `ref_date` pour la suite du traitement.
            # Calculer les dates
            time_values = time_var[:]
            dates = pd.to_datetime([ref_date + pd.Timedelta(days=int(t)) for t in time_values])  # Initialise ou met à jour `dates` pour la suite du traitement.
        else:  # Exécute cette étape du traitement avec les données déjà contrôlées.
            # Essayer une autre méthode
            dates = pd.to_datetime(time_var[:], unit='D', origin=pd.Timestamp(time_units.split('since')[-1].strip()))
        
        # Créer DataFrame
        df = pd.DataFrame({
            'date': dates,  # Exécute cette étape du traitement avec les données déjà contrôlées.
            'value': var_data.flatten(),  # Exécute cette étape du traitement avec les données déjà contrôlées.
            'sector': 'Douala'  # Exécute cette étape du traitement avec les données déjà contrôlées.
        })  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Filtrer les valeurs invalides (NaN, inf)
        df = df.replace([np.inf, -np.inf], np.nan).dropna()
        
        # Sauvegarder en CSV
        df.to_csv(output_csv, index=False)
        print(f"Converti {nc_file} → {output_csv} ({len(df)} points)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        nc.close()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return True  # Renvoie le résultat de cette étape à son appelant.
        
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Erreur lors de la conversion de {nc_file}: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return False  # Renvoie le résultat de cette étape à son appelant.


def merge_csv_files(existing_csv, new_csv, output_csv):  # Définit la fonction et son rôle dans le traitement.
    """
    Fusionner deux fichiers CSV en supprimant les doublons.
    
    Args:
        existing_csv: Fichier CSV existant (2015-2025)
        new_csv: Nouveau fichier CSV (2000-2015)
        output_csv: Fichier CSV de sortie fusionné
    """
    try:  # Ouvre le contexte contrôlé de cette opération.
        # Lire les fichiers
        df_existing = pd.read_csv(existing_csv)
        df_new = pd.read_csv(new_csv)  # Initialise ou met à jour `df_new` pour la suite du traitement.
        
        # Convertir les dates en datetime pour comparaison
        df_existing['date'] = pd.to_datetime(df_existing['date'])
        df_new['date'] = pd.to_datetime(df_new['date'])  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Supprimer les doublons (dates qui existent déjà)
        df_new = df_new[~df_new['date'].isin(df_existing['date'])]
        
        # Fusionner
        df_merged = pd.concat([df_existing, df_new]).sort_values('date').reset_index(drop=True)
        
        # Sauvegarder
        df_merged.to_csv(output_csv, index=False)
        print(f"Fusionné {existing_csv} + {new_csv} → {output_csv} ({len(df_merged)} points)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return True  # Renvoie le résultat de cette étape à son appelant.
        
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Erreur lors de la fusion: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return False  # Renvoie le résultat de cette étape à son appelant.


def process_all_files():  # Définit la fonction et son rôle dans le traitement.
    """Traiter tous les fichiers NetCDF disponibles."""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("CONVERSION NetCDF → CSV")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Lister les fichiers NetCDF
    nc_files = [f for f in os.listdir(NC_DIR) if f.endswith('.nc')]
    
    if not nc_files:  # Vérifie la condition avant de poursuivre le traitement.
        print("Aucun fichier NetCDF trouvé dans", NC_DIR)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        print("   Placez vos fichiers .nc dans ce dossier avant de relancer le script.")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    print(f"Trouvé {len(nc_files)} fichier(s) NetCDF dans {NC_DIR}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    # Traiter chaque fichier
    for nc_file in nc_files:
        print(f"Traitement de: {nc_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Détecter la variable
        nc = Dataset(os.path.join(NC_DIR, nc_file), 'r')
        available_vars = [v for v in nc.variables if v not in ['time', 'lat', 'lon']]  # Initialise ou met à jour `available_vars` pour la suite du traitement.
        nc.close()  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        # Trouver la variable principale
        main_var = None
        for var in available_vars:  # Parcourt les éléments nécessaires au traitement.
            if var in VARIABLE_MAP:  # Vérifie la condition avant de poursuivre le traitement.
                main_var = var  # Initialise ou met à jour `main_var` pour la suite du traitement.
                break  # Contrôle le déroulement de la boucle ou du bloc courant.
        
        if not main_var:  # Vérifie la condition avant de poursuivre le traitement.
            print(f"Aucune variable reconnue dans {nc_file}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
            continue  # Contrôle le déroulement de la boucle ou du bloc courant.
        
        # Convertir en CSV
        output_name = VARIABLE_MAP.get(main_var, main_var.lower())
        temp_csv = os.path.join(CSV_DIR, f"{output_name}_temp.csv")  # Initialise ou met à jour `temp_csv` pour la suite du traitement.
        
        if extract_nc_to_csv(  # Vérifie la condition avant de poursuivre le traitement.
            os.path.join(NC_DIR, nc_file),  # Exécute cette étape du traitement avec les données déjà contrôlées.
            main_var,  # Exécute cette étape du traitement avec les données déjà contrôlées.
            temp_csv  # Exécute cette étape du traitement avec les données déjà contrôlées.
        ):  # Ferme la structure ouverte plus haut.
            # Vérifier si un fichier existant existe
            existing_patterns = [
                f"{output_name}_Douala.csv",  # Exécute cette étape du traitement avec les données déjà contrôlées.
                f"{output_name}_Douala_2015-2025.csv",  # Exécute cette étape du traitement avec les données déjà contrôlées.
                f"{output_name}_Douala_2000-2025.csv"  # Exécute cette étape du traitement avec les données déjà contrôlées.
            ]  # Ferme la structure ouverte plus haut.
            
            existing_file = None  # Initialise ou met à jour `existing_file` pour la suite du traitement.
            for pattern in existing_patterns:  # Parcourt les éléments nécessaires au traitement.
                if os.path.exists(os.path.join(CSV_DIR, pattern)):  # Vérifie la condition avant de poursuivre le traitement.
                    existing_file = os.path.join(CSV_DIR, pattern)  # Initialise ou met à jour `existing_file` pour la suite du traitement.
                    break  # Contrôle le déroulement de la boucle ou du bloc courant.
            
            if existing_file:  # Vérifie la condition avant de poursuivre le traitement.
                # Fusionner
                final_name = f"{output_name}_Douala_2000-2025.csv"
                final_csv = os.path.join(CSV_DIR, final_name)  # Initialise ou met à jour `final_csv` pour la suite du traitement.
                merge_csv_files(existing_file, temp_csv, final_csv)  # Exécute cette étape du traitement avec les données déjà contrôlées.
                
                # Supprimer les fichiers temporaires
                os.remove(temp_csv)
                # Renommer le fichier existant si nécessaire
                if existing_file != final_csv:
                    os.remove(existing_file)  # Exécute cette étape du traitement avec les données déjà contrôlées.
            else:  # Exécute cette étape du traitement avec les données déjà contrôlées.
                # Renommer le fichier temporaire
                final_name = f"{output_name}_Douala.csv"
                final_csv = os.path.join(CSV_DIR, final_name)  # Initialise ou met à jour `final_csv` pour la suite du traitement.
                os.rename(temp_csv, final_csv)  # Exécute cette étape du traitement avec les données déjà contrôlées.
                print(f"Fichier sauvegardé: {final_name}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        
        print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    
    print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("CONVERSION TERMINÉE")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("=" * 60)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("Fichiers CSV générés dans:", CSV_DIR)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    print("Vous pouvez maintenant redémarrer le backend pour utiliser les nouvelles données.")  # Exécute cette étape du traitement avec les données déjà contrôlées.


if __name__ == "__main__":  # Vérifie la condition avant de poursuivre le traitement.
    process_all_files()  # Exécute cette étape du traitement avec les données déjà contrôlées.
