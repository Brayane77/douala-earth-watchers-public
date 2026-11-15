/**
 * Commande d'interface pour choisir et mémoriser le thème clair ou sombre.
 * Le mode clair est le fond blanc par défaut; le mode sombre n'est utilisé que
 * si l'utilisateur l'a explicitement sélectionné.
 */
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, persistTheme, resolveInitialTheme, type Theme } from '../lib/theme';

/** Synchronise le choix de thème avec le document et le stockage local si disponible. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [initialized, setInitialized] = useState(false);

  // Reprend le choix enregistré (ou le blanc par défaut) déjà appliqué par le script d'amorçage.
  useEffect(() => {
    const initialTheme = resolveInitialTheme();
    applyTheme(initialTheme);
    // Le rendu serveur et le premier rendu client affichent le bouton neutre pour éviter
    // toute divergence d'hydratation; le libellé réel apparaît immédiatement après.
    setTheme(initialTheme);
    setInitialized(true);
  }, []);

  // Applique chaque changement au document, y compris la classe utilisée par Tailwind.
  useEffect(() => {
    if (initialized) applyTheme(theme);
  }, [initialized, theme]);

  // Bascule le thème affiché et conserve le choix explicite pour la prochaine visite.
  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    persistTheme(nextTheme);
  }

  const Icon = theme === 'dark' ? Sun : Moon;
  const label = theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre';

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
      onClick={toggleTheme}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
    </button>
  );
}
