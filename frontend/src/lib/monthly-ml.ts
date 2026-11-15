/** Contrats et appels explicites de l'évaluation ML mensuelle sur un CSV fourni par l'utilisateur. */
import type { MonthlyMlHorizonMetrics, MonthlyMlReport, MonthlyMlScore, MonthlyMlValidationPrediction } from './api';

/** Champs de formulaire utilisés pour une seule exécution soumise manuellement. */
export interface MonthlyMlEvaluationRequest {
  file: File;
  dateColumn: string;
  valueColumn: string;
  delimiter: ',' | ';' | '\t';
  decimalMark: '.' | ',';
  confirmRealObservations: boolean;
  sectorFilter: string;
  horizon: number;
  validationOrigins: number;
  model: 'random_forest' | 'ridge';
  source: string;
  unit: string;
  aggregation: string;
  resolution: string;
}

/** Envoie le formulaire à l'API sans conserver le fichier dans le navigateur ou sur le serveur. */
export async function evaluateMonthlyMl(request: MonthlyMlEvaluationRequest): Promise<MonthlyMlReport> {
  const form = new FormData();
  form.set('file', request.file, request.file.name);
  form.set('date_col', request.dateColumn);
  form.set('value_col', request.valueColumn);
  form.set('delimiter', request.delimiter);
  form.set('decimal_mark', request.decimalMark);
  form.set('confirm_real_observations', String(request.confirmRealObservations));
  form.set('sector_filter', request.sectorFilter);
  form.set('horizon', String(request.horizon));
  form.set('validation_origins', String(request.validationOrigins));
  form.set('model_type', request.model);
  form.set('source', request.source);
  form.set('unit', request.unit);
  form.set('aggregation', request.aggregation);
  form.set('resolution', request.resolution);

  const response = await fetch('/api/ml/evaluate', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (body) {
      let detail: string | null = null;
      try {
        const parsed: unknown = JSON.parse(body);
        if (isRecord(parsed) && typeof parsed.detail === 'string') detail = parsed.detail;
      } catch {
        // Si la réponse n'est pas JSON, son extrait sera montré comme message d'erreur.
      }
      throw new Error(detail ?? body.slice(0, 360));
    }
    throw new Error(`Le backend a répondu avec le statut ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (!isMonthlyMlReport(payload)) {
    throw new Error('Le rapport ML mensuel est incomplet ou incohérent.');
  }
  return payload;
}

/** Vérifie une structure JSON avant d'en lire une propriété. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Valide un numéro fini sans traiter null, chaîne ou booléen comme une mesure. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Contrôle un jour ISO du calendrier grégorien. */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

/** Vérifie une période complète et ordonnée. */
function isPeriod(value: unknown): value is { start: string; end: string } {
  return isRecord(value) && isIsoDate(value.start) && isIsoDate(value.end) && value.start <= value.end;
}

// Décale une date de début de mois sans dépendre des durées variables des mois civils.
function shiftMonth(date: string, months: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + months, 1)).toISOString().slice(0, 10);
}

/** Valide un score et son effectif observé. */
function isMlScore(value: unknown): value is MonthlyMlScore {
  return isRecord(value)
    && Number.isInteger(value.n)
    && Number(value.n) > 0
    && isFiniteNumber(value.mae)
    && value.mae >= 0
    && isFiniteNumber(value.rmse)
    && value.rmse >= 0;
}

/** Valide une ligne d'historique réel sans accepter de valeur future comme observation. */
function isHistoryPoint(value: unknown): boolean {
  return isRecord(value) && isIsoDate(value.date) && isFiniteNumber(value.value);
}

/** Valide une projection datée et l'horizon associé. */
function isForecastPoint(value: unknown): boolean {
  return isRecord(value)
    && isIsoDate(value.date)
    && Number.isInteger(value.horizon_months)
    && Number(value.horizon_months) >= 1
    && isFiniteNumber(value.prediction);
}

/** Vérifie la structure d'un modèle de validation et la disponibilité de la baseline saisonnière. */
function isHorizonMetrics(value: unknown, expectedHorizon: number): boolean {
  if (!isRecord(value)
    || value.horizon_months !== expectedHorizon
    || !Number.isInteger(value.n)
    || Number(value.n) <= 0
    || !isPeriod(value.origin_period)
    || !isPeriod(value.validation_period)
    || !isRecord(value.training_examples)
    || !Number.isInteger(value.training_examples.min)
    || !Number.isInteger(value.training_examples.max)
    || !isRecord(value.models)) return false;

  const models = value.models;
  const seasonal = models.seasonal_baseline;
  const totalSamples = Number(value.n);
  if (!isMlScore(models.candidate)
    || !isMlScore(models.persistence)
    || !isRecord(seasonal)
    || typeof seasonal.available !== 'boolean'
    || !Number.isInteger(seasonal.n)
    || Number(seasonal.n) < 0
    || (seasonal.period !== null && !isPeriod(seasonal.period))
    || (seasonal.mae !== null && (!isFiniteNumber(seasonal.mae) || seasonal.mae < 0))
    || (seasonal.rmse !== null && (!isFiniteNumber(seasonal.rmse) || seasonal.rmse < 0))
    || (seasonal.reason !== null && typeof seasonal.reason !== 'string')) return false;

  const seasonalSamples = Number(seasonal.n);
  const trainingMinimum = Number(value.training_examples.min);
  const trainingMaximum = Number(value.training_examples.max);
  return models.candidate.n === totalSamples
    && models.persistence.n === totalSamples
    && trainingMinimum >= 0
    && trainingMaximum >= trainingMinimum
    && (seasonal.available
      ? seasonalSamples === totalSamples && seasonal.mae !== null && seasonal.rmse !== null && seasonal.reason === null
      : seasonalSamples < totalSamples && seasonal.reason !== null);
}

/** Vérifie les champs et alignements essentiels du rapport ML mensuel retourné par l'API. */
function isMonthlyMlReport(value: unknown): value is MonthlyMlReport {
  if (!isRecord(value)
    || value.schema_version !== 2
    || value.status !== 'exploratory_user_uploaded_data'
    || value.is_current !== false
    || value.is_official !== false
    || typeof value.run_id !== 'string'
    || !/^[0-9a-f]{20}$/.test(value.run_id)
    || !isRecord(value.target)
    || typeof value.target.column !== 'string'
    || typeof value.target.unit !== 'string'
    || !isRecord(value.source)
    || value.source.type !== 'user_uploaded_csv'
    || typeof value.source.filename !== 'string'
    || typeof value.source.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(value.source.sha256)
    || value.source.retrieved_at !== null
    || !Number.isInteger(value.source.record_count)
    || !isPeriod(value.source.source_period)
    || !isRecord(value.source.declared_context)
    || !isRecord(value.configuration)
    || !['random_forest', 'ridge'].includes(String(value.configuration.model_name))
    || typeof value.configuration.model_version !== 'string'
    || typeof value.configuration.estimator !== 'string'
    || !isRecord(value.configuration.parameters)
    || !Array.isArray(value.configuration.feature_names)
    || !value.configuration.feature_names.every((name) => typeof name === 'string')
    || !Number.isInteger(value.configuration.horizon_months)
    || Number(value.configuration.horizon_months) < 1
    || Number(value.configuration.horizon_months) > 24
    || !Number.isInteger(value.configuration.validation_origins)
    || Number(value.configuration.validation_origins) < 12
    || Number(value.configuration.validation_origins) > 36
    || value.configuration.future_observations_used !== false
    || value.configuration.random_split !== false
    || typeof value.code_sha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(value.code_sha256)
    || typeof value.uncertainty !== 'string'
    || !Array.isArray(value.history)
    || !value.history.every(isHistoryPoint)
    || value.history.length !== value.source.record_count
    || !isRecord(value.latest_observation)
    || !isIsoDate(value.latest_observation.date)
    || !isFiniteNumber(value.latest_observation.value)
    || !isRecord(value.validation)
    || typeof value.validation.method !== 'string'
    || !isPeriod(value.validation.origin_period)
    || !isRecord(value.validation.metrics_by_horizon)
    || !Array.isArray(value.validation.predictions)
    || !value.validation.predictions.every(isValidationPrediction)
    || value.validation.uncertainty !== 'Non quantifiée.'
    || !isIsoDate(value.forecast_origin)
    || !Array.isArray(value.forecast)
    || !value.forecast.every(isForecastPoint)) return false;

  const horizon = Number(value.configuration.horizon_months);
  const validationOrigins = Number(value.configuration.validation_origins);
  const forecastOrigin = value.forecast_origin as string;
  const metrics = value.validation.metrics_by_horizon;
  const history = value.history as { date: string; value: number }[];
  const predictions = value.validation.predictions as MonthlyMlValidationPrediction[];
  const forecast = value.forecast as { date: string; horizon_months: number; prediction: number }[];
  const context = value.source.declared_context;
  if (Object.keys(metrics).length !== horizon || forecast.length !== horizon) return false;
  if (!Object.values(context).every((item) => typeof item === 'string')) return false;
  if (!isRecord(value.configuration.software_versions)
    || !Object.values(value.configuration.software_versions).every((item) => typeof item === 'string')) return false;
  if (value.forecast_origin !== value.latest_observation.date) return false;
  if (history[0]?.date !== value.source.source_period.start
    || history[history.length - 1]?.date !== value.latest_observation.date
    || history[history.length - 1]?.value !== value.latest_observation.value
    || value.source.source_period.end !== value.latest_observation.date) return false;

  for (let index = 0; index < history.length; index += 1) {
    if (history[index].date.slice(8) !== '01') return false;
    if (index > 0 && history[index].date !== shiftMonth(history[index - 1].date, 1)) return false;
  }

  for (let lead = 1; lead <= horizon; lead += 1) {
    const metricValue = metrics[String(lead)];
    if (!isHorizonMetrics(metricValue, lead)) return false;
    const metric = metricValue as MonthlyMlHorizonMetrics;
    const rows = predictions.filter((row) => row.horizon_months === lead);
    const uniqueOrigins = new Set(rows.map((row) => row.origin_date));
    if (rows.length !== validationOrigins || uniqueOrigins.size !== validationOrigins || metric.n !== rows.length) return false;
    if (metric.models.candidate.n !== rows.length || metric.models.persistence.n !== rows.length) return false;
    if (rows.some((row) => row.valid_date !== shiftMonth(row.origin_date, lead))) return false;
    const originDates = rows.map((row) => row.origin_date).sort();
    const validDates = rows.map((row) => row.valid_date).sort();
    const trainingCounts = rows.map((row) => row.training_examples);
    if (metric.origin_period.start !== originDates[0] || metric.origin_period.end !== originDates[originDates.length - 1]) return false;
    if (metric.validation_period.start !== validDates[0] || metric.validation_period.end !== validDates[validDates.length - 1]) return false;
    if (metric.training_examples.min !== Math.min(...trainingCounts)
      || metric.training_examples.max !== Math.max(...trainingCounts)) return false;
  }

  const allOrigins = predictions.map((row) => row.origin_date).sort();
  if (value.validation.origin_period.start !== allOrigins[0]
    || value.validation.origin_period.end !== allOrigins[allOrigins.length - 1]) return false;

  return forecast.every((point, index) =>
    point.horizon_months === index + 1
    && point.date === shiftMonth(forecastOrigin, index + 1));
}

/** Vérifie les colonnes des prédictions de validation utilisées dans le tableau/export. */
function isValidationPrediction(value: unknown): boolean {
  return isRecord(value)
    && isIsoDate(value.origin_date)
    && isIsoDate(value.valid_date)
    && Number.isInteger(value.horizon_months)
    && Number(value.horizon_months) >= 1
    && isFiniteNumber(value.observed)
    && isFiniteNumber(value.model)
    && isFiniteNumber(value.persistence)
    && (value.seasonal_baseline === null || isFiniteNumber(value.seasonal_baseline))
    && Number.isInteger(value.training_examples)
    && Number(value.training_examples) >= 0;
}
