/** Tests du thème clair/sombre et de sa persistance dans le stockage du navigateur. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('restaure le thème enregistré et mémorise le changement', async () => {
    window.localStorage.setItem('dew-theme', 'dark');
    render(<ThemeToggle />);

    const lightModeButton = await screen.findByRole('button', { name: 'Passer au mode clair' });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(lightModeButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(lightModeButton);

    expect(screen.getByRole('button', { name: 'Passer au mode sombre' })).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem('dew-theme')).toBe('light');
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });
});
