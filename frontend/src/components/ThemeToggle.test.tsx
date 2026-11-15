/** Tests du thème clair/sombre, du blanc par défaut et de sa persistance. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';
import { THEME_STORAGE_KEY } from '../lib/theme';

/** Remplace la préférence système simulée par le setup de test. */
function mockSystemPreference(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: prefersDark,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    mockSystemPreference(false);
    vi.restoreAllMocks();
  });

  it('restaure le thème sombre enregistré et mémorise le retour au clair', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeToggle />);

    const lightModeButton = await screen.findByRole('button', { name: 'Passer au mode clair' });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(lightModeButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(lightModeButton);

    expect(screen.getByRole('button', { name: 'Passer au mode sombre' })).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('démarre en mode clair sans choix enregistré, même si le système préfère le sombre', async () => {
    mockSystemPreference(true);
    render(<ThemeToggle />);

    await screen.findByRole('button', { name: 'Passer au mode sombre' });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('respecte un choix clair explicite alors que le système préfère le sombre', async () => {
    mockSystemPreference(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeToggle />);

    await screen.findByRole('button', { name: 'Passer au mode sombre' });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });
});
