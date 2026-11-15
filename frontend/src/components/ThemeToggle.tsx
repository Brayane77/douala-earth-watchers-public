/** Commande d’interface pour choisir et mémoriser le thème clair ou sombre. */
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/** Valeurs de thème autorisées par les attributs CSS du document. */
type Theme = 'light' | 'dark';

/** Synchronise le choix de thème avec le document et le stockage local si disponible. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem('dew-theme');
    } catch {
      savedTheme = null;
    }
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const initialTheme: Theme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : systemPrefersDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) document.documentElement.dataset.theme = theme;
  }, [initialized, theme]);

  // Bascule le thème affiché et essaie de conserver le choix pour la prochaine visite.
  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      window.localStorage.setItem('dew-theme', nextTheme);
    } catch {
      // Le thème reste utilisable pour la session même si le navigateur bloque le stockage local.
    }
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
