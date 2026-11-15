/** Commande d’interface pour choisir la langue de l’interface (français ou anglais). */
import { Languages } from 'lucide-react';
import { LANGUAGES, useTranslation, type Language } from '../lib/i18n';

/** Sélecteur de langue placé dans l’en-tête, à côté du thème. */
export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation();
  const label = t('Langue de l’interface', 'Interface language');

  return (
    <label className="language-toggle" title={label}>
      <Languages size={15} aria-hidden="true" />
      <select
        aria-label={label}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        {LANGUAGES.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
