/** Teste le dépôt du CSV réel et vérifie que l'évaluation n'est appelée qu'après soumission. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyMlLab } from './MonthlyMlLab';
import { evaluateMonthlyMl } from '../lib/monthly-ml';

// Le réseau est remplacé par un échec explicite; le test valide le parcours sans calcul de résultat factice.
vi.mock('../lib/monthly-ml', () => ({ evaluateMonthlyMl: vi.fn() }));

// Charge la série mensuelle réelle du dépôt pour tester le choix du fichier et des colonnes.
const realCsvText = readFileSync(resolve(process.cwd(), '../nasa-data/csv/temperature_Douala.csv'), 'utf-8');

// Vérifie le workflow utilisateur du formulaire d'évaluation mensuelle.
describe('Laboratoire ML mensuel', () => {
  // Réinitialise la fonction réseau avant chaque scénario.
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evaluateMonthlyMl).mockRejectedValue(new Error('Réponse de test : backend non appelé.'));
  });

  // Le rendu de la page ne déclenche pas l'évaluation; seul le bouton de soumission démarre le POST.
  it('sélectionne le CSV réel et soumet les colonnes et paramètres choisis à la demande', async () => {
    render(<MonthlyMlLab />);
    expect(evaluateMonthlyMl).not.toHaveBeenCalled();

    const file = new File([realCsvText], 'temperature_Douala.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/Fichier CSV mensuel/), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByLabelText('Colonne de date mensuelle')).toBeInTheDocument());
    expect(screen.getByLabelText('Colonne de date mensuelle')).toHaveValue('date');
    expect(screen.getByLabelText('Variable à modéliser')).toHaveValue('value');
    expect(evaluateMonthlyMl).not.toHaveBeenCalled();

    const submitButton = screen.getByRole('button', { name: /Évaluer et produire le scénario/ });
    expect(submitButton).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Je confirme que les valeurs du CSV sont des observations réelles/ }));
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);

    await waitFor(() => expect(evaluateMonthlyMl).toHaveBeenCalledTimes(1));
    expect(evaluateMonthlyMl).toHaveBeenCalledWith(expect.objectContaining({
      file,
      dateColumn: 'date',
      valueColumn: 'value',
      horizon: 12,
      validationOrigins: 12,
      confirmRealObservations: true,
      model: 'random_forest',
    }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Réponse de test : backend non appelé.');
  });
});
