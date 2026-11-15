/** Parcours manuel d'évaluation et de projection mensuelle sur un CSV utilisateur. */
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, BrainCircuit, Download, FileSpreadsheet, Info, LoaderCircle, Upload } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyMlHorizonMetrics, MonthlyMlReport } from '../lib/api';
import { evaluateMonthlyMl, type MonthlyMlEvaluationRequest } from '../lib/monthly-ml';

// Garde la limite côté navigateur alignée avec la limite du endpoint mémoire.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Séries d'export disponibles pour le contrat multipart.
type CsvDelimiter = MonthlyMlEvaluationRequest['delimiter'];
type DecimalMark = MonthlyMlEvaluationRequest['decimalMark'];
type ModelChoice = MonthlyMlEvaluationRequest['model'];

// Parse le premier enregistrement CSV en respectant les guillemets et le séparateur choisi.
function splitCsvRecord(record: string, delimiter: CsvDelimiter): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    if (character === '"') {
      if (quoted && record[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      fields.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (quoted) throw new Error('La ligne d’en-tête CSV contient des guillemets non refermés.');
  fields.push(current.trim());
  return fields;
}

// Détecte un séparateur courant sans confondre les séparateurs enfermés dans des guillemets.
function detectCsvDelimiter(record: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [',', ';', '\t'];
  const counts = candidates.map((delimiter) => {
    let quoted = false;
    let count = 0;
    for (let index = 0; index < record.length; index += 1) {
      if (record[index] === '"') {
        if (quoted && record[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (record[index] === delimiter && !quoted) {
        count += 1;
      }
    }
    return count;
  });
  const maximum = Math.max(...counts);
  if (maximum < 1) throw new Error('Impossible de détecter un séparateur CSV entre virgule, point-virgule et tabulation.');
  return candidates[counts.indexOf(maximum)];
}

// Lit les noms de colonnes du premier enregistrement, sans inventer ni transformer de ligne.
function parseCsvHeader(text: string, requestedDelimiter?: CsvDelimiter): { columns: string[]; delimiter: CsvDelimiter } {
  const firstRecord = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/, 1)[0] ?? '';
  if (!firstRecord.trim()) throw new Error('Le fichier ne contient pas de ligne d’en-tête.');
  const delimiter = requestedDelimiter ?? detectCsvDelimiter(firstRecord);
  const columns = splitCsvRecord(firstRecord, delimiter);
  if (columns.length < 2 || columns.some((column) => !column)) {
    throw new Error('L’en-tête doit contenir au moins deux noms de colonnes non vides.');
  }
  if (new Set(columns).size !== columns.length) {
    throw new Error('Les noms de colonnes de l’en-tête doivent être uniques.');
  }
  return { columns, delimiter };
}

// Lit un fragment de CSV en mémoire dans les navigateurs natifs et dans les environnements de test.
function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier impossible.'));
    reader.readAsText(blob);
  });
}

// Choisit des valeurs initiales explicites à partir de l'en-tête, modifiables avant le calcul.
function suggestColumns(columns: string[]): { date: string; value: string } {
  const date = columns.find((column) => /^(date|time|month|mois|timestamp)$/i.test(column)) ?? columns[0];
  const preferredValues = /^(value|valeur|t2m|temperature|température|precipitation|précipitation|ndvi|evi)$/i;
  const value = columns.find((column) => column !== date && preferredValues.test(column))
    ?? columns.find((column) => column !== date && !/^sector$/i.test(column))
    ?? columns.find((column) => column !== date)
    ?? '';
  return { date, value };
}

// Formate un nombre sans pourcentage artificiel, dans la précision lisible de la page.
function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value);
}

// Met en forme une date mensuelle tout en conservant les jours exacts dans les tableaux.
function formatMonth(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

// Met en forme les bornes de période affichées sous chaque horizon de validation.
function formatPeriod(period: { start: string; end: string }): string {
  return `${formatMonth(period.start)} – ${formatMonth(period.end)}`;
}

// Échappe une cellule CSV même si un nom ou un libellé contient ponctuation ou saut de ligne.
function csvCell(value: string | number | null): string {
  if (value === null) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}

// Télécharge dans le navigateur un artefact dérivé du seul rapport affiché.
function downloadText(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Construit un CSV cohérent réunissant métriques, lignes d'évaluation et valeurs projetées.
function makeResultsCsv(report: MonthlyMlReport): string {
  const header = [
    'type', 'run_id', 'source_sha256', 'model', 'origin_date', 'valid_date', 'horizon_months',
    'n', 'period_start', 'period_end', 'mae', 'rmse', 'observed', 'candidate',
    'persistence', 'seasonal_baseline', 'prediction',
  ];
  const rows: (string | number | null)[][] = [header];
  const metrics = Object.values(report.validation.metrics_by_horizon).sort((a, b) => a.horizon_months - b.horizon_months);
  for (const horizon of metrics) {
    const modelRows = [
      { name: report.configuration.model_name, n: horizon.models.candidate.n, mae: horizon.models.candidate.mae, rmse: horizon.models.candidate.rmse },
      { name: 'persistence', n: horizon.models.persistence.n, mae: horizon.models.persistence.mae, rmse: horizon.models.persistence.rmse },
      {
        name: 'seasonal_baseline',
        n: horizon.models.seasonal_baseline.n,
        mae: horizon.models.seasonal_baseline.mae,
        rmse: horizon.models.seasonal_baseline.rmse,
      },
    ];
    for (const score of modelRows) {
      rows.push([
        'validation_metric', report.run_id, report.source.sha256, score.name, '', '', horizon.horizon_months,
        score.n, horizon.validation_period.start, horizon.validation_period.end, score.mae, score.rmse, '', '', '', '', '',
      ]);
    }
  }
  for (const point of report.validation.predictions) {
    rows.push([
      'validation_prediction', report.run_id, report.source.sha256, report.configuration.model_name,
      point.origin_date, point.valid_date, point.horizon_months, '', '', '', '', '', point.observed,
      point.model, point.persistence, point.seasonal_baseline, '',
    ]);
  }
  for (const point of report.forecast) {
    rows.push([
      'forecast', report.run_id, report.source.sha256, report.configuration.model_name,
      report.forecast_origin, point.date, point.horizon_months, '', '', '', '', '', '', '', '', '', point.prediction,
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

// Expose le dépôt et le résultat uniquement après une action explicite de l'utilisateur.
export function MonthlyMlLab() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileError, setFileError] = useState('');
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(',');
  const [decimalMark, setDecimalMark] = useState<DecimalMark>('.');
  const [dateColumn, setDateColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [horizon, setHorizon] = useState('12');
  const [validationOrigins, setValidationOrigins] = useState('12');
  const [model, setModel] = useState<ModelChoice>('random_forest');
  const [source, setSource] = useState('');
  const [unit, setUnit] = useState('');
  const [aggregation, setAggregation] = useState('');
  const [resolution, setResolution] = useState('');
  const [confirmRealObservations, setConfirmRealObservations] = useState(false);
  const [result, setResult] = useState<MonthlyMlReport | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Met à jour la liste des colonnes lorsqu'une nouvelle source CSV est sélectionnée.
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0] ?? null;
    setResult(null);
    setFormError('');
    setFileError('');
    setFile(null);
    setConfirmRealObservations(false);
    setColumns([]);
    setDateColumn('');
    setValueColumn('');
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setFileError('Choisissez un fichier portant l’extension .csv.');
      input.value = '';
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setFileError('Le fichier dépasse la limite de 5 Mio.');
      input.value = '';
      return;
    }
    try {
      const header = parseCsvHeader(await readBlobText(selectedFile.slice(0, 64 * 1024)));
      const suggestions = suggestColumns(header.columns);
      setFile(selectedFile);
      setDelimiter(header.delimiter);
      setDecimalMark('.');
      setColumns(header.columns);
      setDateColumn(suggestions.date);
      setValueColumn(suggestions.value);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'L’en-tête du CSV est illisible.');
      input.value = '';
    }
  }

  // Reparse l'en-tête si l'utilisateur corrige le séparateur détecté automatiquement.
  async function handleDelimiterChange(nextDelimiter: CsvDelimiter): Promise<void> {
    setDelimiter(nextDelimiter);
    setResult(null);
    if (!file) return;
    try {
      const header = parseCsvHeader(await readBlobText(file.slice(0, 64 * 1024)), nextDelimiter);
      const suggestions = suggestColumns(header.columns);
      const nextDate = header.columns.includes(dateColumn) ? dateColumn : suggestions.date;
      const nextValue = header.columns.includes(valueColumn) && valueColumn !== nextDate
        ? valueColumn
        : (suggestions.value !== nextDate ? suggestions.value : header.columns.find((column) => column !== nextDate) ?? '');
      setColumns(header.columns);
      setDateColumn(nextDate);
      setValueColumn(nextValue);
      setFileError('');
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'L’en-tête ne correspond pas au séparateur choisi.');
      setColumns([]);
      setDateColumn('');
      setValueColumn('');
    }
  }

  // Envoie le fichier et ses choix seulement après validation explicite du formulaire.
  async function submitEvaluation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError('');
    setResult(null);
    if (!file) {
      setFormError('Choisissez d’abord un fichier CSV mensuel.');
      return;
    }
    if (!dateColumn || !valueColumn || dateColumn === valueColumn) {
      setFormError('Choisissez une colonne de date et une autre colonne de variable.');
      return;
    }
    if (!confirmRealObservations) {
      setFormError('Confirmez que les valeurs sont des observations réelles et non des données synthétiques.');
      return;
    }
    const horizonValue = Number(horizon);
    const originsValue = Number(validationOrigins);
    if (!Number.isInteger(horizonValue) || horizonValue < 1 || horizonValue > 24) {
      setFormError('L’horizon doit être un nombre entier de 1 à 24 mois.');
      return;
    }
    if (!Number.isInteger(originsValue) || originsValue < 12 || originsValue > 36) {
      setFormError('Le nombre d’origines de validation doit être de 12 à 36.');
      return;
    }

    const request: MonthlyMlEvaluationRequest = {
      file,
      dateColumn,
      valueColumn,
      delimiter,
      decimalMark,
      confirmRealObservations,
      sectorFilter: sectorFilter.trim(),
      horizon: horizonValue,
      validationOrigins: originsValue,
      model,
      source: source.trim(),
      unit: unit.trim(),
      aggregation: aggregation.trim(),
      resolution: resolution.trim(),
    };
    setIsSubmitting(true);
    try {
      setResult(await evaluateMonthlyMl(request));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Le calcul exploratoire n’a pas abouti.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Construit les points du graphique sans relier la dernière observation à une fausse continuité.
  const chartRows = result
    ? [
      ...result.history.map((point) => ({ date: point.date, observed: point.value, projection: null as number | null })),
      ...result.forecast.map((point) => ({ date: point.date, observed: null as number | null, projection: point.prediction })),
    ]
    : [];
  const validationMetrics = result
    ? Object.values(result.validation.metrics_by_horizon).sort((a, b) => a.horizon_months - b.horizon_months)
    : [];

  // Télécharge un JSON exact du rapport affiché ou un CSV des métriques et points présents.
  function downloadReport(format: 'json' | 'csv'): void {
    if (!result) return;
    const filename = `douala-earth-watchers-ml-${result.run_id}.${format}`;
    const content = format === 'json' ? `${JSON.stringify(result, null, 2)}\n` : makeResultsCsv(result);
    const mimeType = format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8';
    downloadText(filename, content, mimeType);
  }

  return (
    <section className="panel monthly-ml-panel" aria-labelledby="monthly-ml-title">
      <div className="panel-heading">
        <div>
          <div className="section-title"><BrainCircuit size={19} aria-hidden="true" /><h2 id="monthly-ml-title">Laboratoire ML mensuel</h2></div>
          <p>Évaluation et scénario exploratoires sur une série mensuelle que vous fournissez.</p>
        </div>
        <span className="ml-experimental-badge">Expérimental · CSV utilisateur</span>
      </div>

      <div className="ml-scope-callout">
        <Info size={18} aria-hidden="true" />
        <p>Ce calcul est séparé du forecast quotidien T2M et des avis officiels. Aucun entraînement ne démarre à l’ouverture de la page : soumettez le formulaire pour lancer une évaluation. Le fichier est transmis pour cette requête, sans archivage par l’application; sa provenance reste à déclarer par vous.</p>
      </div>

      <form className="ml-form" onSubmit={(event) => { void submitEvaluation(event); }}>
        <fieldset className="ml-fieldset" disabled={isSubmitting}>
        <legend className="visually-hidden">Paramètres de l’évaluation ML mensuelle</legend>
        <label className="ml-upload-field">
          <span>Fichier CSV mensuel <span aria-hidden="true">·</span> jusqu’à 5 Mio</span>
          <span className="ml-upload-control"><Upload size={17} aria-hidden="true" />{file ? file.name : 'Choisir un fichier CSV'}</span>
          <input className="visually-hidden" type="file" accept=".csv,text/csv" onChange={(event) => { void handleFileChange(event); }} aria-describedby="ml-file-hint ml-file-error" />
        </label>
        <small id="ml-file-hint" className="ml-field-hint">Minimum 60 mois continus, une valeur finie par mois, sans mois manquant ni doublon. Aucun remplissage automatique.</small>
        {fileError && <p id="ml-file-error" className="forecast-error" role="alert">{fileError}</p>}

        {columns.length > 0 && (
          <>
            <div className="ml-form-grid">
              <label className="forecast-field">
                <span>Colonne de date mensuelle</span>
                <select value={dateColumn} onChange={(event) => {
                  const nextDate = event.target.value;
                  setDateColumn(nextDate);
                  if (valueColumn === nextDate) setValueColumn(columns.find((column) => column !== nextDate) ?? '');
                  setResult(null);
                }}>
                  {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                </select>
              </label>
              <label className="forecast-field">
                <span>Variable à modéliser</span>
                <select value={valueColumn} onChange={(event) => { setValueColumn(event.target.value); setResult(null); }}>
                  {columns.filter((column) => column !== dateColumn).map((column) => <option key={column} value={column}>{column}</option>)}
                </select>
              </label>
              <label className="forecast-field">
                <span>Séparateur CSV</span>
                <select value={delimiter} onChange={(event) => { void handleDelimiterChange(event.target.value as CsvDelimiter); }}>
                  <option value=",">Virgule</option>
                  <option value=";">Point-virgule</option>
                  <option value="\t">Tabulation</option>
                </select>
              </label>
              <label className="forecast-field">
                <span>Séparateur décimal</span>
                <select value={decimalMark} onChange={(event) => { setDecimalMark(event.target.value as DecimalMark); setResult(null); }}>
                  <option value=".">Point</option>
                  <option value=",">Virgule</option>
                </select>
              </label>
              <label className="forecast-field">
                <span>Horizon du scénario (mois après la dernière observation)</span>
                <input type="number" min="1" max="24" step="1" required value={horizon} onChange={(event) => { setHorizon(event.target.value); setResult(null); }} />
              </label>
              <label className="forecast-field">
                <span>Origines de validation</span>
                <select value={validationOrigins} onChange={(event) => { setValidationOrigins(event.target.value); setResult(null); }}>
                  <option value="12">12 origines</option>
                  <option value="24">24 origines</option>
                  <option value="36">36 origines</option>
                </select>
              </label>
              <label className="forecast-field">
                <span>Modèle candidat</span>
                <select value={model} onChange={(event) => { setModel(event.target.value as ModelChoice); setResult(null); }}>
                  <option value="random_forest">Forêt aléatoire</option>
                  <option value="ridge">Ridge</option>
                </select>
              </label>
              <label className="forecast-field">
                <span>Secteur (facultatif)</span>
                <input value={sectorFilter} onChange={(event) => { setSectorFilter(event.target.value); setResult(null); }} placeholder="Valeur exacte de la colonne sector" />
              </label>
              <label className="forecast-field">
                <span>Source / provenance (déclarée)</span>
                <input value={source} onChange={(event) => { setSource(event.target.value); setResult(null); }} placeholder="Ex. source et identifiant du produit" />
              </label>
              <label className="forecast-field">
                <span>Unité (déclarée)</span>
                <input value={unit} onChange={(event) => { setUnit(event.target.value); setResult(null); }} placeholder="Ex. °C, mm/mois, unité inconnue" />
              </label>
              <label className="forecast-field">
                <span>Agrégation mensuelle (déclarée)</span>
                <input value={aggregation} onChange={(event) => { setAggregation(event.target.value); setResult(null); }} placeholder="Ex. moyenne mensuelle déjà calculée" />
              </label>
              <label className="forecast-field">
                <span>Résolution spatiale (déclarée)</span>
                <input value={resolution} onChange={(event) => { setResolution(event.target.value); setResult(null); }} placeholder="Ex. point, grille ou non précisée" />
              </label>
            </div>
            <p className="ml-field-hint">Pour une série multi-secteur, saisissez la valeur exacte de sa colonne <code>sector</code>. Si le champ reste vide, il faut déjà n’avoir qu’une ligne par mois.</p>
            <p className="ml-field-hint">La validation glissante utilise le nombre d’origines choisi. Chaque horizon publie son propre N et ses dates de cibles; la baseline saisonnière reprend la dernière observation passée du même mois calendaire.</p>
            <label className="ml-confirm-field">
              <input type="checkbox" required checked={confirmRealObservations} onChange={(event) => { setConfirmRealObservations(event.target.checked); setResult(null); }} />
              <span>Je confirme que les valeurs du CSV sont des observations réelles, et non une série synthétique ou fictive. La provenance demeure déclarative et n’est pas vérifiée par l’application.</span>
            </label>
            <button type="submit" className="primary-button ml-submit-button" disabled={isSubmitting || !file || !dateColumn || !valueColumn || !confirmRealObservations}>
              {isSubmitting ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
              {isSubmitting ? 'Évaluation en cours…' : 'Évaluer et produire le scénario'}
            </button>
          </>
        )}
        </fieldset>
      </form>

      {formError && <p className="forecast-error" role="alert">{formError}</p>}
      {isSubmitting && <p className="forecast-loading" role="status"><LoaderCircle className="spin" size={17} aria-hidden="true" /> Entraînement et validation chronologique en cours; ce calcul peut prendre quelques secondes.</p>}

      {result && (
        <div className="ml-results" aria-live="polite">
          <div className="ml-result-heading">
            <div>
              <span className="eyebrow">RAPPORT EXPLORATOIRE · PAS UN FORECAST ACTUEL</span>
              <h3>Résultat du modèle sur « {result.target.column} »</h3>
              <p>{result.source.record_count} mois réels du CSV · {formatMonth(result.source.source_period.start)} à {formatMonth(result.source.source_period.end)} · unité déclarée : {result.target.unit}</p>
            </div>
            <div className="ml-export-actions" aria-label="Exporter ce rapport">
              <button type="button" className="export-button" onClick={() => downloadReport('json')}><Download size={14} aria-hidden="true" /> JSON</button>
              <button type="button" className="export-button" onClick={() => downloadReport('csv')}><Download size={14} aria-hidden="true" /> CSV</button>
            </div>
          </div>

          <div className="ml-manifest-grid">
            <div><span>Fichier et période observée</span><strong>{result.source.filename}<br />{result.source.source_period.start} — {result.source.source_period.end}</strong></div>
            <div><span>Modèle / version</span><strong>{result.configuration.model_name === 'random_forest' ? 'Forêt aléatoire' : 'Ridge'} · {result.configuration.model_version}</strong></div>
            <div><span>Horizon / origines</span><strong>{result.configuration.horizon_months} mois · {result.configuration.validation_origins} origines</strong></div>
            <div><span>Origine du scénario</span><strong>Dernière observation : {result.latest_observation.date} ({formatNumber(result.latest_observation.value)} {result.target.unit})</strong></div>
            <div><span>SHA-256 du CSV soumis</span><code>{result.source.sha256}</code></div>
            <div><span>Run / empreinte code</span><strong>{result.run_id}</strong><code>{result.code_sha256}</code></div>
          </div>

          <div className="ml-results-note" role="note">
            <AlertTriangle size={17} aria-hidden="true" />
            <p>Les observations historiques proviennent du fichier choisi; l’API n’ajoute aucune valeur réelle. Le scénario est calculé à partir de la dernière date du CSV, pas de la date d’aujourd’hui : si le fichier est ancien, certaines dates projetées peuvent déjà être passées. Ce n’est ni un forecast météo actuel de Douala, ni une alerte officielle. Aucun intervalle d’incertitude n’est estimé.</p>
          </div>

          <section className="ml-result-section" aria-labelledby="ml-validation-title">
            <div className="ml-section-heading">
              <div><h4 id="ml-validation-title">Validation chronologique et baselines</h4><p>{result.validation.method}</p></div>
              <span className="unit-chip">Erreurs en {result.target.unit}</span>
            </div>
            <div className="scientific-table-wrap">
              <table className="scientific-table ml-metrics-table">
                <thead><tr><th scope="col">Horizon</th><th scope="col">N</th><th scope="col">Origines</th><th scope="col">Dates évaluées</th><th scope="col">Candidat<br />MAE / RMSE</th><th scope="col">Persistance<br />MAE / RMSE</th><th scope="col">Saisonnière<br />MAE / RMSE</th></tr></thead>
                <tbody>
                  {validationMetrics.map((metric: MonthlyMlHorizonMetrics) => (
                    <tr key={metric.horizon_months}>
                      <th scope="row">{metric.horizon_months} mois</th>
                      <td>{metric.n}</td>
                      <td>{formatPeriod(metric.origin_period)}</td>
                      <td>{formatPeriod(metric.validation_period)}</td>
                      <td>{formatNumber(metric.models.candidate.mae)} / {formatNumber(metric.models.candidate.rmse)}</td>
                      <td>{formatNumber(metric.models.persistence.mae)} / {formatNumber(metric.models.persistence.rmse)}</td>
                      <td title={metric.models.seasonal_baseline.reason ?? undefined}>
                        {metric.models.seasonal_baseline.mae !== null && metric.models.seasonal_baseline.rmse !== null
                          ? `${formatNumber(metric.models.seasonal_baseline.mae)} / ${formatNumber(metric.models.seasonal_baseline.rmse)} · N=${metric.models.seasonal_baseline.n}`
                          : `Non calculable · N=${metric.models.seasonal_baseline.n}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ml-footnote">Les MAE/RMSE restent dans l’unité déclarée; aucun MAPE ni score de « précision » n’est calculé. Les scores du candidat ne sont pas garantis supérieurs aux baselines. Le nombre d’exemples d’entraînement min/max par horizon est inclus dans le JSON.</p>
          </section>

          <section className="ml-result-section" aria-labelledby="ml-forecast-title">
            <div className="ml-section-heading">
              <div><h4 id="ml-forecast-title">Projection mensuelle calculée</h4><p>Origine : {result.forecast_origin} · valeurs futures produites par le modèle, sans observation réelle ajoutée.</p></div>
              <span className="unit-chip">{result.target.unit}</span>
            </div>
            <div className="ml-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 10, right: 16, left: 2, bottom: 2 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatMonth} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis width={62} tickFormatter={(value: number) => formatNumber(value)} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={(label) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${String(label)}T00:00:00Z`))}
                    formatter={(value) => [formatNumber(Number(value)), '']}
                    contentStyle={{ borderRadius: 10, borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <Line type="monotone" dataKey="observed" name="Observation du CSV" stroke="#2783a8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="projection" name="Projection expérimentale" stroke="#e07a35" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: '#e07a35' }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="ml-chart-legend"><span><i className="ml-legend-observed" /> Série observée du CSV</span><span><i className="ml-legend-projection" /> Projection expérimentale</span><small>Aucun intervalle d’incertitude représenté</small></div>
            <div className="scientific-table-wrap">
              <table className="scientific-table ml-forecast-table">
                <thead><tr><th scope="col">Horizon</th><th scope="col">Date cible relative à l’origine</th><th scope="col">Valeur calculée ({result.target.unit})</th></tr></thead>
                <tbody>{result.forecast.map((point) => <tr key={point.horizon_months}><th scope="row">M+{point.horizon_months}</th><td>{point.date}</td><td>{formatNumber(point.prediction)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <details className="ml-validation-details">
            <summary>Voir les {result.validation.predictions.length} comparaisons de validation détaillées</summary>
            <div className="scientific-table-wrap">
              <table className="scientific-table ml-validation-table">
                <thead><tr><th scope="col">Origine</th><th scope="col">Date cible</th><th scope="col">Horizon</th><th scope="col">Observé</th><th scope="col">Candidat</th><th scope="col">Persistance</th><th scope="col">Saisonnière</th></tr></thead>
                <tbody>{result.validation.predictions.map((point, index) => (
                  <tr key={`${point.origin_date}-${point.horizon_months}-${index}`}>
                    <td>{point.origin_date}</td><td>{point.valid_date}</td><td>{point.horizon_months} mois</td>
                    <td>{formatNumber(point.observed)}</td><td>{formatNumber(point.model)}</td><td>{formatNumber(point.persistence)}</td>
                    <td>{point.seasonal_baseline === null ? '—' : formatNumber(point.seasonal_baseline)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </details>

          <details className="ml-validation-details ml-manifest-details">
            <summary>Configuration, provenance déclarée et limites</summary>
            <dl className="source-details ml-context-details">
              <div><dt>Provenance déclarée</dt><dd>{result.source.declared_context.source}</dd></div>
              <div><dt>Unité / agrégation</dt><dd>{result.source.declared_context.unit} · {result.source.declared_context.aggregation}</dd></div>
              <div><dt>Résolution / secteur</dt><dd>{result.source.declared_context.resolution} · {result.source.declared_context.sector_filter}</dd></div>
              <div><dt>Version logicielle</dt><dd>{Object.entries(result.configuration.software_versions).map(([name, version]) => `${name} ${version}`).join(' · ')}</dd></div>
              <div><dt>Variables explicatives</dt><dd>{result.configuration.feature_names.join(', ')}</dd></div>
              <div><dt>Incertitude</dt><dd>{result.uncertainty}</dd></div>
            </dl>
          </details>
        </div>
      )}
    </section>
  );
}
