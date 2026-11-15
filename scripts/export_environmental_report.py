# Produit un rapport descriptif PDF à partir d’un CSV fourni, sans générer d’observations.
"""Exporter un rapport descriptif environnemental à partir d'un CSV réel."""
# Active les annotations de type modernes sans évaluer les types à l'import.
from __future__ import annotations

# Charge l'analyse des arguments passés depuis le terminal.
import argparse
# Fournit des dates et heures pour horodater les rapports.
from datetime import datetime, timezone
# Permet de créer les dossiers de sortie et de valider les fichiers.
from pathlib import Path

# Charge Matplotlib pour produire le rapport PDF avec graphiques.
import matplotlib
# Sélectionne un moteur sans interface graphique, adapté à l'export automatique.
matplotlib.use("Agg")
# Charge l'API de tracé utilisée pour les graphiques du document.
import matplotlib.dates as mdates
# Charge l'API de mise en page et de création de figures.
import matplotlib.pyplot as plt
# Charge le conteneur PDF multi-pages de Matplotlib.
from matplotlib.backends.backend_pdf import PdfPages
# Charge Pandas pour lire, valider et résumer le CSV.
import pandas as pd


# Définit la fonction qui décrit les options disponibles en ligne de commande.
def parse_args() -> argparse.Namespace:
    # Crée le parseur et explique le but de l'outil à l'utilisateur.
    parser = argparse.ArgumentParser(description="Créer un rapport environnemental PDF à partir d'une série CSV réelle.")
    # Demande le chemin du fichier CSV source.
    parser.add_argument("--input", required=True, type=Path, help="Chemin du fichier CSV d'entrée.")
    # Demande le nom de la colonne de dates.
    parser.add_argument("--date-column", default="date", help="Colonne contenant les dates.")
    # Demande le nom de la variable numérique à décrire.
    parser.add_argument("--value-column", required=True, help="Colonne numérique à analyser.")
    # Permet de spécifier une colonne de secteur géographique.
    parser.add_argument("--sector-column", default=None, help="Colonne facultative identifiant le secteur.")
    # Permet de restreindre le rapport à un secteur du CSV.
    parser.add_argument("--sector", default=None, help="Valeur facultative à retenir dans la colonne de secteur.")
    # Définit un titre lisible pour le rapport final.
    parser.add_argument("--title", default="Rapport environnemental", help="Titre affiché sur le rapport.")
    # Exige une référence de source pour rendre la provenance visible.
    parser.add_argument("--source", required=True, help="Source, produit, organisme ou URL des données.")
    # Oblige l'utilisateur à préciser la nature épistémique de la donnée fournie.
    parser.add_argument("--data-status", required=True, choices=["observation", "reanalysis", "derived", "modelled", "synthetic", "unknown"], help="Nature déclarée des données; aucune valeur n'est vérifiée par le script.")
    # Exige l'unité de mesure de la variable analysée.
    parser.add_argument("--units", required=True, help="Unité de la variable, par exemple °C ou mm/mois.")
    # Exige la méthode d'agrégation ou de traitement déclarée par l'utilisateur.
    parser.add_argument("--aggregation", required=True, help="Agrégation appliquée aux données avant l'export.")
    # Exige une indication sur la résolution ou l'échelle spatiale.
    parser.add_argument("--spatial-scale", required=True, help="Résolution ou échelle spatiale des données.")
    # Demande l'emplacement du fichier PDF produit.
    parser.add_argument("--output", required=True, type=Path, help="Chemin du PDF à créer.")
    # Retourne les options validées par le parseur.
    return parser.parse_args()


# Définit une fonction de chargement qui valide les données sans imputation silencieuse.
def load_series(args: argparse.Namespace) -> pd.DataFrame:
    # Vérifie que le fichier demandé est bien présent sur le disque.
    if not args.input.is_file():
        # Interrompt l'export avec un message simple si le CSV manque.
        raise ValueError(f"Fichier d'entrée introuvable : {args.input}")
    # Lit le fichier CSV en conservant les colonnes sous leur nom initial.
    frame = pd.read_csv(args.input)
    # Vérifie que les colonnes nécessaires à l'analyse sont présentes.
    required = [args.date_column, args.value_column]
    # Ajoute la colonne de secteur aux colonnes obligatoires si elle est demandée.
    if args.sector_column:
        # Mémorise le champ géographique demandé dans la liste de validation.
        required.append(args.sector_column)
    # Repère les colonnes attendues qui n'existent pas dans le fichier.
    missing_columns = [column for column in required if column not in frame.columns]
    # Refuse un schéma incomplet plutôt que d'inventer ou de deviner des champs.
    if missing_columns:
        # Explique les colonnes manquantes à corriger dans le CSV ou les options.
        raise ValueError(f"Colonnes absentes du CSV : {', '.join(missing_columns)}")
    # Convertit les dates et marque les valeurs illisibles comme invalides.
    dates = pd.to_datetime(frame[args.date_column], errors="coerce")
    # Convertit la variable en nombre sans remplacer les cellules invalides.
    values = pd.to_numeric(frame[args.value_column], errors="coerce")
    # Refuse toute date manquante ou invalide afin de ne pas fausser la période.
    if dates.isna().any():
        # Fournit une erreur explicite sur les dates à contrôler.
        raise ValueError("La colonne de dates contient des valeurs absentes ou invalides.")
    # Refuse toute valeur manquante ou non numérique au lieu de l'imputer.
    if values.isna().any():
        # Indique la colonne numérique à corriger.
        raise ValueError(f"La variable {args.value_column!r} contient des cellules vides ou non numériques.")
    # Copie les champs validés dans un tableau normalisé pour les calculs.
    result = pd.DataFrame({"date": dates, "value": values.astype(float)})
    # Ajoute le secteur à la série uniquement lorsqu'une colonne a été fournie.
    if args.sector_column:
        # Copie le libellé géographique pour garder la relation spatiale dans le rapport.
        result["sector"] = frame[args.sector_column].astype(str)
    # Filtre le secteur sélectionné lorsque l'utilisateur en a demandé un.
    if args.sector is not None:
        # Vérifie qu'une colonne de secteur existe avant d'appliquer le filtre.
        if "sector" not in result:
            # Interrompt le traitement car le filtre demandé ne peut pas être appliqué.
            raise ValueError("L'option --sector exige aussi --sector-column.")
        # Garde uniquement les lignes correspondant au secteur choisi.
        result = result[result["sector"] == args.sector].copy()
    # Refuse les séries vides ou à une seule observation, inutilisables en graphique.
    if len(result) < 2:
        # Signale que la série doit contenir au moins deux points.
        raise ValueError("Il faut au moins deux observations valides pour générer le rapport.")
    # Trie les observations chronologiquement avant les statistiques et le tracé.
    result = result.sort_values("date").reset_index(drop=True)
    # Retourne la série validée et triée sans modifier les valeurs source.
    return result


# Définit la génération du PDF en deux pages lisibles à l'impression.
def export_pdf(args: argparse.Namespace, frame: pd.DataFrame) -> None:
    # Crée automatiquement le dossier parent si nécessaire.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Sélectionne une police installée qui couvre les caractères français.
    plt.rcParams["font.family"] = "DejaVu Sans"
    # Calcule l'horodatage UTC pour différencier le moment de génération.
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    # Calcule les statistiques descriptives de la variable choisie.
    stats = frame["value"].describe()
    # Définit une palette simple qui s'imprime correctement sur fond blanc.
    green = "#19765f"
    # Ouvre le document PDF en mode multipage.
    with PdfPages(args.output) as pdf:
        # Crée la page de synthèse au format A4 portrait.
        fig = plt.figure(figsize=(8.27, 11.69), facecolor="white")
        # Retire les axes pour utiliser la page comme une mise en page documentaire.
        fig.subplots_adjust(left=0.09, right=0.91, top=0.92, bottom=0.08)
        # Ajoute le titre principal du rapport.
        fig.text(0.09, 0.92, args.title, fontsize=23, fontweight="bold", color="#14352e", va="top")
        # Ajoute une ligne de sous-titre qui précise le type de document.
        fig.text(0.09, 0.875, "Rapport descriptif environnemental", fontsize=12, color=green, va="top")
        # Compose un bandeau qui signale le statut déclaré sans prétendre le vérifier.
        status_banner = f"STATUT DÉCLARÉ : {args.data_status.upper()} — SYNTHÈSE DESCRIPTIVE, PAS UNE PRÉVISION CLIMATIQUE NI UNE ÉVALUATION OFFICIELLE DU RISQUE"
        # Affiche l'avertissement et la nature des données en évidence sur la page.
        fig.text(0.09, 0.82, status_banner, fontsize=9, color="#8a4d1f", wrap=True, va="top")
        # Prépare les métadonnées de provenance à afficher clairement.
        metadata = [
            # Identifie l'origine déclarée du jeu de données.
            ("Source / produit", args.source),
            # Nomme la grandeur sélectionnée dans le fichier.
            ("Variable", args.value_column),
            # Affiche l'unité déclarée pour interpréter les statistiques.
            ("Unité", args.units),
            # Documente la méthode de synthèse temporelle annoncée.
            ("Agrégation déclarée", args.aggregation),
            # Documente l'échelle spatiale fournie par l'utilisateur.
            ("Échelle spatiale", args.spatial_scale),
            # Distingue une observation d'une réanalyse ou d'une donnée simulée.
            ("Statut des données", args.data_status),
            # Indique le filtre sectoriel ou la couverture entière du fichier.
            ("Secteur retenu", args.sector or "Tous les secteurs du fichier"),
            # Résume les dates de début et de fin effectivement chargées.
            ("Période couverte", f"{frame.date.min():%Y-%m-%d} à {frame.date.max():%Y-%m-%d}"),
            # Compte les lignes incluses dans le rapport descriptif.
            ("Nombre d'observations", f"{len(frame):,}"),
            # Trace la date de production du rapport.
            ("Généré le", generated_at),
        # Termine la liste des métadonnées du rapport.
        ]
        # Commence la mise en page des métadonnées sous le bandeau de titre.
        y = 0.75
        # Parcourt les paires de libellés et de valeurs à afficher.
        for label, value in metadata:
            # Affiche le nom du champ avec une typographie renforcée.
            fig.text(0.10, y, f"{label} :", fontsize=10, fontweight="bold", color="#243b37", va="top")
            # Affiche la valeur fournie ou calculée à droite du libellé.
            fig.text(0.36, y, str(value), fontsize=10, color="#334b46", va="top", wrap=True)
            # Descend la position pour laisser de l'espace entre les lignes de métadonnées.
            y -= 0.045
        # Ajoute un sous-titre à la section des statistiques.
        fig.text(0.10, y - 0.02, "Statistiques descriptives", fontsize=14, fontweight="bold", color="#14352e", va="top")
        # Prépare les valeurs statistiques pertinentes pour la synthèse.
        summary = [
            # Calcule la moyenne arithmétique des observations retenues.
            ("Moyenne", stats["mean"]),
            # Calcule la médiane robuste de la variable retenue.
            ("Médiane", frame["value"].median()),
            # Identifie la valeur minimale de la série.
            ("Minimum", stats["min"]),
            # Identifie la valeur maximale de la série.
            ("Maximum", stats["max"]),
            # Mesure la dispersion statistique de l'échantillon.
            ("Écart-type", stats["std"]),
        # Termine la liste des statistiques affichées.
        ]
        # Positionne le premier élément statistique sous le titre de section.
        y_stats = y - 0.075
        # Parcourt les statistiques calculées à partir des seules lignes importées.
        for label, value in summary:
            # Formate chaque résultat avec une précision adaptée à la lecture.
            fig.text(0.12, y_stats, f"{label} : {value:,.3f} {args.units}", fontsize=11, color="#334b46", va="top")
            # Réserve une ligne supplémentaire pour la statistique suivante.
            y_stats -= 0.04
        # Ajoute une note méthodologique sur les limites des statistiques descriptives.
        fig.text(0.09, 0.02, "Les statistiques résument uniquement le fichier fourni. Elles ne valident ni la source, ni la représentativité, ni une relation causale. Vérifier les métadonnées et la méthode d'agrégation avant tout usage.", fontsize=8, color="#596c67", wrap=True, va="bottom")
        # Enregistre la page de synthèse dans le document PDF.
        pdf.savefig(fig, bbox_inches="tight")
        # Libère la mémoire de la figure après son export.
        plt.close(fig)
        # Crée la deuxième page destinée à la visualisation temporelle.
        fig, ax = plt.subplots(figsize=(11.69, 8.27), facecolor="white")
        # Ajoute un titre au graphique de série temporelle.
        ax.set_title(f"{args.value_column} — évolution dans le temps", loc="left", fontsize=16, fontweight="bold", color="#14352e", pad=18)
        # Trace une courbe distincte pour chaque secteur s'il est disponible.
        if "sector" in frame.columns:
            # Parcourt les groupes géographiques dans l'ordre de leurs libellés.
            for sector, group in frame.groupby("sector", sort=True):
                # Trace les observations du secteur avec une ligne fine et des marqueurs.
                ax.plot(group["date"], group["value"], marker="o", markersize=2.5, linewidth=1.3, label=str(sector))
            # Affiche la légende seulement si le tableau contient plusieurs secteurs.
            if frame["sector"].nunique() > 1:
                # Place la légende au-dessus du tracé pour préserver la zone de données.
                ax.legend(loc="upper left", bbox_to_anchor=(0, 1.02), frameon=False, ncol=3)
        # Trace une seule série lorsque le CSV ne comporte pas de secteur géographique.
        else:
            # Dessine la série avec la couleur de thème environnementale.
            ax.plot(frame["date"], frame["value"], marker="o", markersize=2.5, linewidth=1.5, color=green)
        # Formate les dates pour rendre les graduations temporelles compactes.
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
        # Calcule approximativement la durée de la série en nombre de mois.
        span_months = (frame.date.max().year - frame.date.min().year) * 12 + frame.date.max().month - frame.date.min().month + 1
        # Place des graduations mensuelles espacées pour éviter les libellés de mois répétés.
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=max(1, (span_months + 7) // 8)))
        # Oriente légèrement les libellés temporels pour éviter leur chevauchement.
        fig.autofmt_xdate(rotation=25, ha="right")
        # Nomme l'axe horizontal avec la variable temporelle.
        ax.set_xlabel("Date")
        # Nomme l'axe vertical avec la variable et son unité déclarée.
        ax.set_ylabel(f"{args.value_column} ({args.units})")
        # Ajoute une grille discrète qui facilite la lecture des valeurs.
        ax.grid(True, color="#dce7e3", linewidth=0.7, alpha=0.9)
        # Retire les bordures supérieure et droite pour alléger le graphique.
        ax.spines[["top", "right"]].set_visible(False)
        # Ajoute une note de méthode sous le graphique.
        fig.text(0.08, 0.035, f"Source : {args.source} · Agrégation déclarée : {args.aggregation} · Échelle : {args.spatial_scale}", fontsize=8, color="#596c67", wrap=True)
        # Ajuste les marges pour inclure titres, légendes et annotations.
        fig.tight_layout(rect=(0.04, 0.08, 0.98, 0.95))
        # Ajoute la page graphique au même fichier PDF.
        pdf.savefig(fig, bbox_inches="tight")
        # Ferme la figure pour limiter l'utilisation mémoire lors d'exports en lot.
        plt.close(fig)


# Définit le point d'entrée utilisé lors d'une exécution directe du script.
def main() -> int:
    # Analyse les paramètres passés par l'utilisateur.
    args = parse_args()
    # Charge et valide le jeu de données avant toute création du PDF.
    try:
        # Prépare la série à partir du fichier CSV renseigné.
        frame = load_series(args)
        # Génère le document PDF avec les métadonnées et le graphique.
        export_pdf(args, frame)
    # Intercepte les erreurs de validation et les présente sans trace technique.
    except (ValueError, OSError, pd.errors.ParserError) as exc:
        # Écrit l'erreur sur la sortie standard d'erreur pour les scripts d'automatisation.
        raise SystemExit(f"Erreur : {exc}") from exc
    # Confirme le chemin du PDF créé à l'utilisateur ou au processus appelant.
    print(f"Rapport PDF créé : {args.output.resolve()}")
    # Indique au système que le traitement s'est terminé sans erreur.
    return 0


# Lance le point d'entrée uniquement lorsque ce fichier est exécuté directement.
if __name__ == "__main__":
    # Transmet le code de retour au système d'exploitation.
    raise SystemExit(main())
