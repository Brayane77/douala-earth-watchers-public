/**
 * Contexte de langue de l’interface (français par défaut, anglais disponible).
 *
 * Le français reste la langue de référence : chaque appel `t(français, anglais)`
 * porte sa traduction à côté du texte affiché, sans dictionnaire séparé à tenir
 * synchronisé. La langue choisie est mémorisée dans le stockage local et lue par
 * un script d’amorçage avant le premier rendu, comme pour le thème.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Clé de stockage local qui conserve le choix explicite de l’utilisateur. */
export const LANGUAGE_STORAGE_KEY = 'dew-language';

/** Langues prises en charge par l’interface. */
export type Language = 'fr' | 'en';

/** Langues proposées par la commande de sélection. */
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

/** Locale de formatage Intl associée à chaque langue. */
const INTL_LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB' };

/** Signature de la fonction de traduction : texte français puis texte anglais. */
type Translate = (french: string, english: string) => string;

/** Valeur partagée par les composants consommateurs du contexte. */
export interface LanguageContextValue {
  /** Langue active. */
  language: Language;
  /** Locale Intl à passer aux formats de date, d’heure et de nombre. */
  intlLocale: string;
  /** Traduit un couple français/anglais dans la langue active. */
  t: Translate;
  /** Change la langue active et mémorise le choix. */
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Lit la langue enregistrée, en ignorant une valeur inconnue ou un stockage bloqué. */
export function readStoredLanguage(): Language | null {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'fr' || saved === 'en' ? saved : null;
  } catch {
    // Un navigateur qui bloque le stockage local ne doit pas casser l’affichage.
    return null;
  }
}

/** Le français est la langue par défaut; l’anglais n’est utilisé que sur choix explicite. */
export function resolveInitialLanguage(): Language {
  return readStoredLanguage() ?? 'fr';
}

/** Mémorise le choix explicite sans interrompre l’affichage si le stockage échoue. */
function persistLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // La langue reste utilisable pour la session même si le stockage est bloqué.
  }
}

/**
 * Script inline injecté dans l’en-tête : il applique la langue et l’attribut
 * `lang` du document avant le premier rendu. Il duplique volontairement la
 * logique ci-dessus car il s’exécute avant le chargement du bundle.
 */
export const LANGUAGE_BOOT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('${LANGUAGE_STORAGE_KEY}');var l=s==='en'?'en':'fr';var r=document.documentElement;r.dataset.language=l;r.setAttribute('lang',l);}catch(e){document.documentElement.dataset.language='fr';document.documentElement.setAttribute('lang','fr');}})();`;

/** Fournit la langue active et la fonction de traduction à l’ensemble des routes. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [initialized, setInitialized] = useState(false);

  // Reprend la langue enregistrée (ou le français par défaut) après le premier rendu.
  useEffect(() => {
    setLanguageState(resolveInitialLanguage());
    setInitialized(true);
  }, []);

  // Tient l’attribut lang du document à jour pour les lecteurs d’écran et le navigateur.
  useEffect(() => {
    if (!initialized) return;
    document.documentElement.dataset.language = language;
    document.documentElement.setAttribute('lang', language);
  }, [initialized, language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    persistLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    intlLocale: INTL_LOCALES[language],
    t: (french, english) => (language === 'en' ? english : french),
    setLanguage,
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Accède à la langue active et à la fonction de traduction. */
export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation doit être utilisé dans un LanguageProvider.');
  }
  return context;
}

/**
 * Libellés anglais des séries du catalogue FastAPI, indexés par identifiant.
 * Une clé absente conserve le libellé français d’origine.
 */
const PRODUCT_LABELS_EN: Record<string, string> = {
  temperature: 'Air temperature at 2 m',
  precipitation: 'Monthly precipitation',
  precipitation_merra2: 'MERRA-2 monthly precipitation',
  precipitation_rate: 'Mean precipitation rate',
  temperature_power: 'Air temperature at 2 m (NASA POWER)',
  precipitation_power: 'Bias-corrected monthly precipitation (NASA POWER)',
};

/** Traduit un libellé de produit du catalogue en gardant la clé comme secours. */
export function localizedProductLabel(kind: string, label: string, t: Translate): string {
  const englishLabel = PRODUCT_LABELS_EN[kind];
  return englishLabel ? t(label, englishLabel) : label;
}

/** Libellés anglais des champs de métadonnées partagés par plusieurs panneaux. */
export const METADATA_LABELS_EN = {
  unit: 'Unit',
  aggregation: 'Aggregation',
  resolution: 'Resolution',
  period: 'Available period',
} as const;
