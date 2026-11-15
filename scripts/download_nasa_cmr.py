#!/usr/bin/env python3
"""
Python script for downloading data from the NASA CMR API

Requirements:
    > pip install tqdm

To run the script: `python download_files_M2T1NXLND_5.12.4.py`
"""

import os  # Importe les dépendances utilisées par cette étape.
import requests  # Importe les dépendances utilisées par cette étape.
from tqdm import tqdm  # Importe les dépendances utilisées par cette étape.
from concurrent.futures import ThreadPoolExecutor, as_completed  # Importe les dépendances utilisées par cette étape.

CMR_BASE_URL = "https://cmr.earthdata.nasa.gov"  # Initialise ou met à jour `CMR_BASE_URL` pour la suite du traitement.

SHORT_NAME = "M2T1NXLND"  # Initialise ou met à jour `SHORT_NAME` pour la suite du traitement.
VERSION = "5.12.4"  # Initialise ou met à jour `VERSION` pour la suite du traitement.
FILTER_TEMPORAL = ""  # Initialise ou met à jour `FILTER_TEMPORAL` pour la suite du traitement.
FILTER_BBOX = ""  # Initialise ou met à jour `FILTER_BBOX` pour la suite du traitement.
FILTER_SEARCH = ""  # Initialise ou met à jour `FILTER_SEARCH` pour la suite du traitement.
FILTER_CLOUD_COVER_MIN = ""  # Initialise ou met à jour `FILTER_CLOUD_COVER_MIN` pour la suite du traitement.
FILTER_CLOUD_COVER_MAX = ""  # Initialise ou met à jour `FILTER_CLOUD_COVER_MAX` pour la suite du traitement.
DOWNLOAD_DIR = f"./{SHORT_NAME}_{VERSION}"  # Initialise ou met à jour `DOWNLOAD_DIR` pour la suite du traitement.
MAX_WORKERS = 5  # Number of parallel downloads

os.makedirs(DOWNLOAD_DIR, exist_ok=True)  # Exécute cette étape du traitement avec les données déjà contrôlées.


def query_cmr_granules(  # Définit la fonction et son rôle dans le traitement.
    short_name: str,  # Exécute cette étape du traitement avec les données déjà contrôlées.
    version: str,  # Exécute cette étape du traitement avec les données déjà contrôlées.
    page_size: int = 2000,  # Initialise ou met à jour `page_size` pour la suite du traitement.
    search_after: str | None = None,  # Initialise ou met à jour `search_after` pour la suite du traitement.
    **extra_params,  # Exécute cette étape du traitement avec les données déjà contrôlées.
):  # Ferme la structure ouverte plus haut.
    """
    Queries the CMR granules endpoint.

    Args:
        short_name: The short name of the collection
        version: The version of the collection
        page_size: The number of results per page (max is 2000)
        search_after: The pagination token for subsequent requests (optional, see https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html#search-after for more details)
        **extra_params: Additional query parameters (e.g., temporal, bounding_box, etc.)

    Returns:
        tuple: (response object, list of granule items)
    """
    url = f"{CMR_BASE_URL}/search/granules.umm_json"  # Initialise ou met à jour `url` pour la suite du traitement.

    params = {  # Initialise ou met à jour `params` pour la suite du traitement.
        "short_name": short_name,  # Exécute cette étape du traitement avec les données déjà contrôlées.
        "version": version,  # Exécute cette étape du traitement avec les données déjà contrôlées.
        "page_size": page_size,  # Exécute cette étape du traitement avec les données déjà contrôlées.
        **extra_params,  # Merge any additional parameters
    }  # Ferme la structure ouverte plus haut.

    headers = {"Accept": "application/json"}  # Initialise ou met à jour `headers` pour la suite du traitement.
    if search_after:  # Vérifie la condition avant de poursuivre le traitement.
        headers["CMR-Search-After"] = search_after  # Exécute cette étape du traitement avec les données déjà contrôlées.

    response = requests.get(url, params=params, headers=headers)  # Initialise ou met à jour `response` pour la suite du traitement.

    try:  # Ouvre le contexte contrôlé de cette opération.
        response.raise_for_status()  # Exécute cette étape du traitement avec les données déjà contrôlées.
    except requests.exceptions.HTTPError:  # Traite explicitement l’erreur ou la fin de cette opération.
        print("Failed to fetch granules:", response.text)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        raise  # Exécute cette étape du traitement avec les données déjà contrôlées.

    data = response.json()  # Initialise ou met à jour `data` pour la suite du traitement.
    items = data.get("items", [])  # Initialise ou met à jour `items` pour la suite du traitement.

    return response, items  # Renvoie le résultat de cette étape à son appelant.


def download_data_from_cmr(  # Définit la fonction et son rôle dans le traitement.
    short_name: str, version: str, total_granules: int, page_size: int = 2000, **params  # Initialise ou met à jour `short_name` pour la suite du traitement.
):  # Ferme la structure ouverte plus haut.
    """Fetches granules for a given collection from the CMR API, then downloads the data from the "GET DATA" URLs"""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    search_after_value: str | None = None  # Initialise ou met à jour `search_after_value` pour la suite du traitement.
    all_download_urls = []  # Initialise ou met à jour `all_download_urls` pour la suite du traitement.
    granules_without_urls = 0  # Initialise ou met à jour `granules_without_urls` pour la suite du traitement.

    # First pass: collect all download URLs
    print("Collecting download URLs...")
    with tqdm(total=total_granules, desc="Collecting URLs", unit="granule") as pbar:  # Ouvre le contexte contrôlé de cette opération.
        while True:  # Vérifie la condition avant de poursuivre le traitement.
            # Use shared query function
            response, items = query_cmr_granules(
                short_name, version, page_size, search_after_value, **params  # Exécute cette étape du traitement avec les données déjà contrôlées.
            )  # Ferme la structure ouverte plus haut.

            # Collect "GET DATA" URLs
            for item in items:
                pbar.update(1)  # Update progress for each granule processed
                download_urls = []  # Initialise ou met à jour `download_urls` pour la suite du traitement.
                for related_url in item.get("umm", {}).get("RelatedUrls", []):  # Parcourt les éléments nécessaires au traitement.
                    if related_url.get("Type") == "GET DATA":  # Vérifie la condition avant de poursuivre le traitement.
                        download_urls.append(related_url.get("URL"))  # Exécute cette étape du traitement avec les données déjà contrôlées.
                
                if download_urls:  # Vérifie la condition avant de poursuivre le traitement.
                    all_download_urls.extend(download_urls)  # Exécute cette étape du traitement avec les données déjà contrôlées.
                else:  # Exécute cette étape du traitement avec les données déjà contrôlées.
                    granules_without_urls += 1  # Exécute cette étape du traitement avec les données déjà contrôlées.

            # Read the next search-after value from response headers
            search_after_value = response.headers.get("CMR-Search-After")

            # There is no next search-after value, we've reached the end
            if not search_after_value:
                break  # Contrôle le déroulement de la boucle ou du bloc courant.

    print(f"Found {len(all_download_urls)} files to download")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    if granules_without_urls > 0:  # Vérifie la condition avant de poursuivre le traitement.
        print(f"{granules_without_urls} granules have no download URLs")  # Exécute cette étape du traitement avec les données déjà contrôlées.

    # Second pass: download all files in parallel
    downloaded_count = 0
    skipped_count = 0  # Initialise ou met à jour `skipped_count` pour la suite du traitement.
    failed_count = 0  # Initialise ou met à jour `failed_count` pour la suite du traitement.
    
    with tqdm(total=len(all_download_urls), desc="Downloading files", unit="file") as pbar:  # Ouvre le contexte contrôlé de cette opération.
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:  # Ouvre le contexte contrôlé de cette opération.
            # Submit all download tasks at once
            future_to_url = {executor.submit(download_file, url): url for url in all_download_urls}
            
            # Process completed downloads as they finish
            for future in as_completed(future_to_url):
                status, filename = future.result()  # Exécute cette étape du traitement avec les données déjà contrôlées.
                if status == "success":  # Vérifie la condition avant de poursuivre le traitement.
                    downloaded_count += 1  # Exécute cette étape du traitement avec les données déjà contrôlées.
                    pbar.set_description(f"Downloaded: {filename}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
                elif status == "skipped":  # Vérifie la condition avant de poursuivre le traitement.
                    skipped_count += 1  # Exécute cette étape du traitement avec les données déjà contrôlées.
                    pbar.set_description(f"Skipped: {filename}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
                else:  # failed
                    failed_count += 1  # Exécute cette étape du traitement avec les données déjà contrôlées.
                    print(f"Failed: {filename}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
                
                pbar.update(1)  # Exécute cette étape du traitement avec les données déjà contrôlées.

    print(f"Downloaded: {downloaded_count} files")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    if skipped_count > 0:  # Vérifie la condition avant de poursuivre le traitement.
        print(f"Skipped: {skipped_count} files (already exist)")  # Exécute cette étape du traitement avec les données déjà contrôlées.
    if failed_count > 0:  # Vérifie la condition avant de poursuivre le traitement.
        print(f"Failed: {failed_count} files")  # Exécute cette étape du traitement avec les données déjà contrôlées.


def download_file(url: str):  # Définit la fonction et son rôle dans le traitement.
    """Download a single file and return (success, skipped, failed) status and filename"""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    local_filename = os.path.join(DOWNLOAD_DIR, os.path.basename(url))  # Initialise ou met à jour `local_filename` pour la suite du traitement.
    if os.path.exists(local_filename):  # Vérifie la condition avant de poursuivre le traitement.
        return "skipped", os.path.basename(url)  # skip existing

    try:  # Ouvre le contexte contrôlé de cette opération.
        with requests.get(url, stream=True, timeout=120) as r:  # Ouvre le contexte contrôlé de cette opération.
            r.raise_for_status()  # Exécute cette étape du traitement avec les données déjà contrôlées.
            with open(local_filename, "wb") as f:  # Ouvre le contexte contrôlé de cette opération.
                for chunk in r.iter_content(8192):  # Parcourt les éléments nécessaires au traitement.
                    f.write(chunk)  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return "success", os.path.basename(url)  # Renvoie le résultat de cette étape à son appelant.
    except Exception as e:  # Traite explicitement l’erreur ou la fin de cette opération.
        print(f"Error downloading {os.path.basename(url)}: {e}")  # Exécute cette étape du traitement avec les données déjà contrôlées.
        return "failed", os.path.basename(url)  # Renvoie le résultat de cette étape à son appelant.


def fetch_total_granules_count_from_cmr(short_name: str, version: str, **params):  # Définit la fonction et son rôle dans le traitement.
    """Fetches the total number of granules for a given collection and filters from the CMR API"""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    response, _ = query_cmr_granules(short_name, version, page_size=1, **params)  # Exécute cette étape du traitement avec les données déjà contrôlées.
    data = response.json()  # Initialise ou met à jour `data` pour la suite du traitement.
    return data.get("hits", 0)  # Renvoie le résultat de cette étape à son appelant.


def main():  # Définit la fonction et son rôle dans le traitement.
    """Main function to download data from the CMR API"""  # Exécute cette étape du traitement avec les données déjà contrôlées.
    filter_params = {}  # Initialise ou met à jour `filter_params` pour la suite du traitement.

    if FILTER_TEMPORAL:  # Vérifie la condition avant de poursuivre le traitement.
        filter_params["temporal"] = FILTER_TEMPORAL  # Exécute cette étape du traitement avec les données déjà contrôlées.

    if FILTER_BBOX:  # Vérifie la condition avant de poursuivre le traitement.
        filter_params["bounding_box"] = FILTER_BBOX  # Exécute cette étape du traitement avec les données déjà contrôlées.

    if FILTER_SEARCH:  # Vérifie la condition avant de poursuivre le traitement.
        filter_params["producer_granule_id[]"] = FILTER_SEARCH  # Exécute cette étape du traitement avec les données déjà contrôlées.
        filter_params["options[producer_granule_id][pattern]"] = 'true'  # Exécute cette étape du traitement avec les données déjà contrôlées.

    if FILTER_CLOUD_COVER_MIN and FILTER_CLOUD_COVER_MAX:  # Vérifie la condition avant de poursuivre le traitement.
        filter_params["cloud_cover"] = f"{FILTER_CLOUD_COVER_MIN},{FILTER_CLOUD_COVER_MAX}"  # Exécute cette étape du traitement avec les données déjà contrôlées.

    total_granules = fetch_total_granules_count_from_cmr(  # Initialise ou met à jour `total_granules` pour la suite du traitement.
        SHORT_NAME, VERSION, **filter_params  # Exécute cette étape du traitement avec les données déjà contrôlées.
    )  # Ferme la structure ouverte plus haut.
    print(f"Total granules: {total_granules:,}")  # Exécute cette étape du traitement avec les données déjà contrôlées.

    download_data_from_cmr(SHORT_NAME, VERSION, total_granules, **filter_params)  # Exécute cette étape du traitement avec les données déjà contrôlées.

    print("All downloads complete.")  # Exécute cette étape du traitement avec les données déjà contrôlées.


if __name__ == "__main__":  # Vérifie la condition avant de poursuivre le traitement.
    main()  # Exécute cette étape du traitement avec les données déjà contrôlées.
