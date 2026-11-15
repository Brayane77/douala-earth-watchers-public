# Point d’entrée de compatibilité qui délègue au lanceur Streamlit historique.
"""Lanceur racine conservé pour les commandes Streamlit historiques."""
# Importe l'outil Python qui exécute un fichier comme un script.
import runpy
# Importe l'outil de chemins pour localiser l'application sans dépendre du dossier courant.
from pathlib import Path

# Résout le chemin stable vers l'interface Streamlit placée dans frontend/.
APP_ENTRYPOINT = Path(__file__).resolve().parent / "frontend" / "app.py"
# Exécute l'application dans son propre contexte afin de conserver le rechargement Streamlit.
runpy.run_path(str(APP_ENTRYPOINT))
