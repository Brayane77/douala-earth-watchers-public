/**
 * Logique partagée du thème clair/sombre : clé de stockage, résolution du thème
 * initial, application au document et script d'amorçage exécuté avant le premier rendu.
 *
 * Le mode clair est le thème par défaut et reste un fond blanc; le mode sombre
 * n'est appliqué que si l'utilisateur l'a explicitement choisi.
 */

/** Clé de stockage local qui conserve le choix explicite de l'utilisateur. */
export const THEME_STORAGE_KEY = 'dew-theme';

/** Thèmes autorisés par les attributs CSS du document. */
export type Theme = 'light' | 'dark';

/** Lit le choix enregistré, en ignorant une valeur inconnue ou un stockage bloqué. */
export function readStoredTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    // Un navigateur qui bloque le stockage local ne doit pas casser l'affichage.
    return null;
  }
}

/**
 * Résout le thème à appliquer.
 * Sans choix explicite, le mode clair (fond blanc) est utilisé, indépendamment
 * du réglage système du visiteur.
 */
export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? 'light';
}

/** Applique le thème au document et synchronise la classe utilisée par Tailwind. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Le variant Tailwind `dark` cible la classe `.dark` : elle doit suivre data-theme.
  root.classList.toggle('dark', theme === 'dark');
}

/** Mémorise le choix explicite sans interrompre l'affichage si le stockage échoue. */
export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Le thème reste utilisable pour la session même si le navigateur bloque le stockage local.
  }
}

/**
 * Script inline injecté dans l'en-tête : il applique le thème avant le premier
 * rendu afin d'éviter tout flash de fond blanc en mode sombre, tout en gardant
 * le blanc comme défaut. Il duplique volontairement la logique ci-dessus car il
 * s'exécute avant le chargement du bundle.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('${THEME_STORAGE_KEY}');var t=s==='dark'?'dark':s==='light'?'light':'light';var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark');}catch(e){document.documentElement.dataset.theme='light';document.documentElement.classList.remove('dark');}})();`;
