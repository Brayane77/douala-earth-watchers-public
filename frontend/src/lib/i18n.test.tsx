/** Vérifie la langue par défaut, la traduction et la mémorisation du choix. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, LANGUAGE_STORAGE_KEY, useTranslation } from './i18n';
import { LanguageToggle } from '../components/LanguageToggle';

/** Affiche une phrase traduite pour observer la langue active. */
function Probe() {
  const { t, intlLocale } = useTranslation();
  return <p>{t('Bonjour', 'Hello')} · {intlLocale}</p>;
}

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.language;
    document.documentElement.setAttribute('lang', 'fr');
  });

  it('affiche le français par défaut et expose la locale fr-FR', async () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);

    await waitFor(() => expect(screen.getByText(/Bonjour · fr-FR/)).toBeInTheDocument());
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
  });

  it('bascule en anglais, met à jour le document et mémorise le choix', async () => {
    render(<LanguageProvider><LanguageToggle /><Probe /></LanguageProvider>);

    const select = await screen.findByRole('combobox', { name: 'Langue de l’interface' });
    fireEvent.change(select, { target: { value: 'en' } });

    await waitFor(() => expect(screen.getByText(/Hello · en-GB/)).toBeInTheDocument());
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('reprend la langue anglaise enregistrée au montage', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    render(<LanguageProvider><Probe /></LanguageProvider>);

    await waitFor(() => expect(screen.getByText(/Hello · en-GB/)).toBeInTheDocument());
  });
});
