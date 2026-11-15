/** Contrats TypeScript, validations de payload et appels same-origin vers les routes FastAPI. */
/** Observation climatique mensuelle réellement renvoyée par l’API locale. */
export interface Observation {
  date: string;
  sector: string;
  value: number;
}

/** Métadonnées de provenance, d’unité, de période et d’emplacement d’un jeu de données. */
export interface DatasetMetadata {
  kind: string;
  filename: string;
  label: string;
  source: string;
  variable: string;
  unit: string;
  aggregation: string;
  spatial_resolution: string;
  provenance_note: string;
  latitude: number;
  longitude: number;
  color: string;
  precision: number;
  sectors: string[];
  start: string;
  end: string;
  record_count: number;
}

/** Réponse d’un produit du catalogue et de ses observations filtrées. */
export interface DatasetResponse {
  kind: string;
  column: string;
  source: string;
  metadata: DatasetMetadata;
  data: Observation[];
}

/** Chargeur commun du catalogue et des séries affichées au tableau de bord. */
export interface DashboardResponse {
  source: string;
  catalog: Record<string, DatasetMetadata>;
  sectors: string[];
  active_sector: string | null;
  datasets: Record<string, DatasetResponse>;
}

/** Accepte un objet JSON non nul, sans tableau, avant d’en lire les propriétés. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Vérifie une clé mensuelle YYYY-MM et refuse les numéros de mois hors calendrier. */
function isMonthKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** Contrôle qu’une liste API ne contient que des chaînes. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Valide les champs minimaux du catalogue climatique avant affichage. */
function isDatasetMetadata(value: unknown): value is DatasetMetadata {
  return isObject(value)
    && typeof value.kind === 'string'
    && typeof value.filename === 'string'
    && typeof value.label === 'string'
    && typeof value.source === 'string'
    && typeof value.variable === 'string'
    && typeof value.unit === 'string'
    && typeof value.aggregation === 'string'
    && typeof value.spatial_resolution === 'string'
    && typeof value.provenance_note === 'string'
    && typeof value.color === 'string'
    && Number.isFinite(value.latitude)
    && Number.isFinite(value.longitude)
    && Number.isFinite(value.precision)
    && isStringArray(value.sectors)
    && isMonthKey(value.start)
    && isMonthKey(value.end)
    && Number.isInteger(value.record_count);
}

/** Refuse les lignes dont la date, le secteur ou la mesure ne respecte pas le contrat API. */
function isObservation(value: unknown): value is Observation {
  if (!isObject(value) || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false;
  const parsedDate = Date.parse(`${value.date}T00:00:00Z`);
  return Number.isFinite(parsedDate)
    && new Date(parsedDate).toISOString().slice(0, 10) === value.date
    && typeof value.sector === 'string'
    && typeof value.value === 'number'
    && Number.isFinite(value.value);
}

/** Extrait un détail HTTP exploitable ou un extrait du corps texte reçu. */
async function errorMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  if (body) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (isObject(parsed) && typeof parsed.detail === 'string') return parsed.detail;
    } catch {
      // Le backend peut renvoyer une réponse texte ; elle est affichée comme telle.
    }
    return body.slice(0, 360);
  }
  return `Le backend a répondu avec le statut ${response.status}.`;
}

/** Charge le catalogue et les séries réelles versionnées dans nasa-data/csv. */
export async function fetchDashboardData(signal?: AbortSignal): Promise<DashboardResponse> {
  const response = await fetch('/api/dashboard-data', {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const payload: unknown = await response.json();
  if (!isObject(payload) || payload.source !== 'repository-csv') {
    throw new Error('La réponse ne provient pas du catalogue CSV attendu.');
  }
  if (!isObject(payload.catalog) || !isObject(payload.datasets)) {
    throw new Error('Le backend a renvoyé un catalogue incomplet.');
  }

  const kinds = Object.keys(payload.catalog);
  if (kinds.length === 0) {
    throw new Error('Le backend ne signale aucune série climatique disponible.');
  }

  for (const kind of kinds) {
    const metadata = payload.catalog[kind];
    const dataset = payload.datasets[kind];
    if (!isDatasetMetadata(metadata) || metadata.kind !== kind) {
      throw new Error(`Les métadonnées de la série « ${kind} » sont absentes ou invalides.`);
    }
    if (!isObject(dataset) || dataset.kind !== kind || !Array.isArray(dataset.data)) {
      throw new Error(`La série « ${kind} » est absente ou invalide.`);
    }
    if (dataset.data.length !== metadata.record_count || !dataset.data.every(isObservation)) {
      throw new Error(`Les lignes reçues pour « ${kind} » ne correspondent pas au catalogue.`);
    }
    const seenMonths = new Set<string>();
    for (const row of dataset.data) {
      const month = row.date.slice(0, 7);
      const key = `${month}:${row.sector}`;
      if (month < metadata.start || month > metadata.end || !metadata.sectors.includes(row.sector) || seenMonths.has(key)) {
        throw new Error(`La période, le secteur ou l’unicité des lignes de « ${kind} » ne concorde pas.`);
      }
      seenMonths.add(key);
    }
  }

  return payload as unknown as DashboardResponse;
}

// Décrit une observation MODIS ponctuelle avec son rang QA et le masque côtier associé.
export interface ModisVegetationObservation { // Ce contrat reste distinct de la structure mensuelle `Observation`.
  date: string; // La date est le début du composite AppEEARS.
  ndvi: number; // NDVI est conservé tel qu’exporté, sans mise à l’échelle supplémentaire.
  evi: number; // EVI reste une variable distincte de NDVI.
  qa_rank: number; // Le rang résumé permet un filtrage qualité explicite.
  qa_label: string; // La description du rang vient du CSV NASA.
  vi_quality: string; // La QA détaillée MODLAND accompagne chaque valeur.
  land_water_mask: string; // Le classement côtier du pixel reste visible.
} // Aucune propriété ne représente une valeur quotidienne interpolée.

// Décrit la provenance, la fréquence et les limites de l’export AppEEARS DV.
export interface ModisVegetationMetadata { // Ces métadonnées ne rejoignent pas le catalogue climatique mensuel.
  dataset_id: string; // Le nom DV identifie la tâche AppEEARS, pas un modèle.
  product: string; // Le code complet inclut la version MOD13Q1.061.
  source: string; // La source précise le fournisseur et l’instrument.
  latitude: number; // Le point fourni est 4,05°N.
  longitude: number; // Le point fourni est 9,70°E.
  requested_start: string; // Début de la fenêtre demandée à AppEEARS.
  requested_end: string; // Fin de la fenêtre demandée à AppEEARS.
  start: string; // Première date effective présente dans le CSV.
  end: string; // Dernière date effective présente dans le CSV.
  record_count: number; // Nombre réel de composites reçus.
  spatial_resolution_m: number; // Résolution nominale du produit en mètres.
  temporal_resolution_days: number; // Fréquence nominale des composites.
  value_units: string; // Les indices de végétation sont sans unité.
  values_as_exported: boolean; // Signale l’absence de nouvelle mise à l’échelle dans le backend.
  quality_counts: Record<'no_data' | 'good' | 'marginal' | 'snow_ice' | 'cloudy', number>; // Comptes QA recalculés depuis le CSV.
  land_water_mask_counts: Record<string, number>; // Comptes des libellés bruts de masque.
  request_status: string; // Statut inclus dans le JSON AppEEARS original.
  readme_completed_at: string | null; // Date d’achèvement déclarée dans le README d’origine, si présente.
  status_warning: string; // Explique le conflit de statut sans le résoudre par hypothèse.
  model_eligible: boolean; // Cette archive reste hors du modèle T2M.
  limitations: string[]; // Avertissements affichés avec la source.
} // La fréquence et l’état QA empêchent une assimilation silencieuse à une série quotidienne.

// Regroupe les observations brutes et leurs métadonnées dans la réponse dédiée.
export interface ModisVegetationResponse { // Ce type n’est pas ajouté à DashboardResponse.
  source: string; // Distingue l’archive MODIS du catalogue repository-csv mensuel.
  metadata: ModisVegetationMetadata; // Le contexte décrit la série indépendamment des valeurs.
  observations: ModisVegetationObservation[]; // Chaque ligne conserve sa QA.
} // L’API sert les composites séparément du forecast T2M.

// Vérifie le format d’une observation avant de l’exposer au composant React.
function isModisObservation(value: unknown): value is ModisVegetationObservation { // Les réponses API restent contrôlées côté client.
  if (!isObject(value) || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false; // Refuse les dates non ISO.
  const parsedDate = Date.parse(`${value.date}T00:00:00Z`); // Valide le calendrier sans conversion de fuseau.
  return Number.isFinite(parsedDate) // Écarte les dates qui ne peuvent pas être analysées.
    && new Date(parsedDate).toISOString().slice(0, 10) === value.date // Refuse une date normalisée différente.
    && typeof value.ndvi === 'number' && Number.isFinite(value.ndvi) // NDVI doit être un nombre fini.
    && typeof value.evi === 'number' && Number.isFinite(value.evi) // EVI doit être un nombre fini.
    && typeof value.qa_rank === 'number' && Number.isInteger(value.qa_rank) && value.qa_rank >= -1 && value.qa_rank <= 3 // Conserve les rangs prévus par le produit.
    && typeof value.qa_label === 'string' && typeof value.vi_quality === 'string' // Les deux labels de QA doivent être présents.
    && typeof value.land_water_mask === 'string'; // Le masque géographique ne doit pas être perdu.
} // Les observations sans assurance qualité lisible sont rejetées côté client.

// Vérifie la structure complète du payload spécifique à l’archive MODIS.
function isModisVegetationResponse(value: unknown): value is ModisVegetationResponse { // Les valeurs ne sont jamais supposées présentes par défaut.
  if (!isObject(value) || value.source !== 'repository-modis-csv' || !isObject(value.metadata) || !Array.isArray(value.observations)) return false; // Le type et l’origine doivent correspondre.
  const metadata = value.metadata; // Les métadonnées sont examinées avant le contenu.
  const observations = value.observations; // Les lignes réelles sont validées séparément des métadonnées.
  if (metadata.dataset_id !== 'DV' || metadata.product !== 'MOD13Q1.061') return false; // Le contrat est lié à ce produit et à cette tâche.
  if (metadata.latitude !== 4.05 || metadata.longitude !== 9.7) return false; // Une archive hors Douala ne peut pas être affichée sous cette identité.
  if (metadata.spatial_resolution_m !== 250 || metadata.temporal_resolution_days !== 16 || metadata.model_eligible !== false) return false; // La nature expérimentale de la source est explicitement contrôlée.
  if (typeof metadata.record_count !== 'number' || !Number.isInteger(metadata.record_count) || observations.length !== metadata.record_count) return false; // Le compte catalogue doit correspondre aux lignes.
  if (typeof metadata.status_warning !== 'string' || !Array.isArray(metadata.limitations)) return false; // Les limites font partie du contrat public.
  if (typeof metadata.source !== 'string' || typeof metadata.request_status !== 'string') return false; // La provenance et le statut d’origine doivent rester lisibles.
  if (typeof metadata.readme_completed_at !== 'string' && metadata.readme_completed_at !== null) return false; // La date de README est nullable mais typée.
  if (!isObject(metadata.quality_counts) || !isObject(metadata.land_water_mask_counts)) return false; // La réponse doit exposer les comptes de QA et de masque.
  if (!observations.every(isModisObservation)) return false; // Chaque valeur doit conserver date et QA valides.
  const ranks = Object.values(metadata.quality_counts); // Les effectifs de rang sont additionnés pour vérifier leur cohérence.
  const validRanks = ranks.every((count): count is number => typeof count === 'number' && Number.isInteger(count) && count >= 0); // Chaque compte doit être un entier positif ou nul.
  if (!validRanks || ranks.reduce((total, count) => total + count, 0) !== metadata.record_count) return false; // Les rangs couvrent chaque composite une fois.
  return true; // Le payload est assez cohérent pour être rendu par l’interface.
} // Cette vérification ne constitue pas une validation scientifique indépendante.

// Récupère le fichier MODIS par URL relative afin que le navigateur utilise le proxy de l’application.
export async function fetchModisVegetationArchive(signal?: AbortSignal): Promise<ModisVegetationResponse> { // Aucun navigateur n’appelle localhost.
  const response = await fetch('/api/observations/modis-vegetation', { // Le backend sert le CSV local déjà contrôlé.
    headers: { Accept: 'application/json' }, // Le client demande le contrat JSON.
    signal, // React Query peut annuler une requête devenue inutile.
  }); // La réponse ne déclenche ni téléchargement NASA ni calcul de modèle.

  if (!response.ok) { // Un état HTTP d’erreur ne doit pas devenir une série vide.
    throw new Error(await errorMessage(response)); // Le message backend accompagne l’état d’erreur.
  } // La réponse réussie passe les contrôles de schéma.

  const payload: unknown = await response.json(); // Le JSON reste non fiable jusqu’à validation.
  if (!isModisVegetationResponse(payload)) { // Le frontend vérifie aussi les coordonnées et les QA.
    throw new Error('La réponse MODIS est incomplète ou ne correspond pas à l’archive DV de Douala.'); // Aucun défaut n’est masqué par une valeur exemple.
  } // Les validations du frontend sont structurelles, pas une validation climatique.
  return payload; // La série est renvoyée dans son format 16 jours original.
} // Aucune interpolation n’est réalisée avant affichage.

// Décrit l'archive quotidienne POWER et ses empreintes dans le rapport de prévision.
export interface DailyForecastSource {
  provider: string;
  upstream_product: string;
  filename: string;
  sha256: string;
  retrieved_at: string | null;
  coordinates_requested: { latitude: number; longitude: number };
  native_grid_resolution: string;
  time_standard: string;
  source_period: { start: string; end: string };
  source_rows: number;
  missing_values: number;
  precipitation_variable_excluded_from_model: string;
}

// Conserve la dernière observation et l'unité correcte de chaque variable quotidienne.
export interface DailyLatestObservation {
  date: string;
  t2m_c: number;
  precipitation_mm_day: number;
}

// Contrat de la route de forecast, qui reste sans valeur future tant que la source n'est pas fraîche.
export interface DailyForecastStatus {
  status: 'insufficient_data';
  forecast: { date: string; horizon_days: number; prediction: number; unit: string }[];
  forecast_origin: string | null;
  issued_at: string | null;
  valid_period: { start: string; end: string } | null;
  retrieved_at: string | null;
  source_end_date: string;
  latest_observation: DailyLatestObservation;
  source: DailyForecastSource;
  model_version: string;
  validation_run_id: string;
  uncertainty: string;
  reasons: string[];
}

// Décrit les erreurs par modèle et horizon, en degrés Celsius.
export interface ForecastModelMetrics {
  mae: number;
  rmse: number;
}

// Décrit une période et les scores de tous les modèles comparés pour un horizon.
export interface DailyHorizonValidation {
  horizon_days: number;
  n: number;
  origin_period: { start: string; end: string };
  validation_period: { start: string; end: string };
  training_examples: { min: number; max: number };
  models: {
    ridge_candidate: ForecastModelMetrics;
    persistence: ForecastModelMetrics;
    seasonal_baseline: ForecastModelMetrics;
  };
}

// Une ligne de backtest conserve l'origine, l'horizon et les valeurs pour chaque comparaison.
export interface DailyValidationPrediction {
  origin_date: string;
  valid_date: string;
  horizon_days: 1 | 2 | 3;
  observed_c: number;
  ridge_candidate_c: number;
  persistence_c: number;
  seasonal_baseline_c: number;
}

// Le rapport JSON pré-calculé alimente simultanément le graphique, les métriques et les exports.
export interface DailyT2MValidation {
  schema_version: number;
  run_id: string;
  status: 'historical_backtest_only';
  target: { variable: string; description: string; unit: string };
  source: DailyForecastSource;
  configuration: Record<string, unknown>;
  software: Record<string, string>;
  code_sha256: string;
  validation: {
    method: string;
    period: { start: string; end: string };
    metrics_by_horizon: Record<string, DailyHorizonValidation>;
    uncertainty: string;
    candidate_status: string;
    station_validation: string;
    predictions: DailyValidationPrediction[];
  };
  latest_observation: DailyLatestObservation;
}

// Décrit le statut des avis officiels et des règles exploratoires configurées par l'utilisateur.
export interface OfficialAlertsStatus {
  official_alerts: {
    status: 'unavailable';
    available: false;
    source: string | null;
    notices: unknown[];
    reason: string;
  };
  exploratory_thresholds: { available: boolean; defaults_configured: boolean; description: string };
  latest_observation: DailyLatestObservation;
  source_sha256: string;
  is_current: false;
}

// Retourne le résultat horodaté d'une comparaison à un seuil explicitement saisi.
export interface ExploratoryThresholdResult {
  kind: 'exploratory_threshold_indicator';
  status: 'historical_threshold_crossed' | 'historical_threshold_not_crossed';
  triggered: boolean;
  is_current: false;
  is_official: false;
  observation: { date: string; variable: 'T2M' | 'PRECTOTCORR'; label: string; value: number; unit: string };
  rule: { operator: 'gt' | 'lt'; symbol: '>' | '<'; threshold: number; unit: string };
  source: DailyForecastSource;
  message: string;
}

// Vérifie les nombres et les dates d'une prévision sans accepter de données synthétiques.
function isDailyLatestObservation(value: unknown): value is DailyLatestObservation {
  return isObject(value)
    && typeof value.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && Number.isFinite(Date.parse(`${value.date}T00:00:00Z`))
    && typeof value.t2m_c === 'number'
    && Number.isFinite(value.t2m_c)
    && typeof value.precipitation_mm_day === 'number'
    && Number.isFinite(value.precipitation_mm_day);
}

// Vérifie les champs indispensables de provenance de l'archive NASA POWER.
function isDailyForecastSource(value: unknown): value is DailyForecastSource {
  return isObject(value)
    && typeof value.provider === 'string'
    && typeof value.upstream_product === 'string'
    && typeof value.filename === 'string'
    && typeof value.sha256 === 'string'
    && /^[0-9a-f]{64}$/.test(value.sha256)
    && (typeof value.retrieved_at === 'string' || value.retrieved_at === null)
    && isObject(value.coordinates_requested)
    && Number.isFinite(value.coordinates_requested.latitude)
    && Number.isFinite(value.coordinates_requested.longitude)
    && typeof value.native_grid_resolution === 'string'
    && typeof value.time_standard === 'string'
    && isObject(value.source_period)
    && typeof value.source_period.start === 'string'
    && typeof value.source_period.end === 'string'
    && Number.isInteger(value.source_rows)
    && Number.isInteger(value.missing_values)
    && typeof value.precipitation_variable_excluded_from_model === 'string';
}

// Contrôle la structure d'une ligne de prévision historique avant affichage ou export.
function isDailyValidationPrediction(value: unknown): value is DailyValidationPrediction {
  return isObject(value)
    && typeof value.origin_date === 'string'
    && typeof value.valid_date === 'string'
    && [1, 2, 3].includes(Number(value.horizon_days))
    && Number.isFinite(value.observed_c)
    && Number.isFinite(value.ridge_candidate_c)
    && Number.isFinite(value.persistence_c)
    && Number.isFinite(value.seasonal_baseline_c);
}

// Charge le statut de forecast actuel; un état insuffisant est un résultat valide et attendu.
export async function fetchDailyT2MForecast(signal?: AbortSignal): Promise<DailyForecastStatus> {
  const response = await fetch('/api/forecasts/t2m-daily', { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(await errorMessage(response));
  const payload: unknown = await response.json();
  if (!isObject(payload)
    || payload.status !== 'insufficient_data'
    || !Array.isArray(payload.forecast)
    || payload.forecast.length !== 0
    || !isDailyForecastSource(payload.source)
    || !isDailyLatestObservation(payload.latest_observation)
    || !Array.isArray(payload.reasons)
    || !payload.reasons.every((reason) => typeof reason === 'string')) {
    throw new Error('Le statut de prévision quotidienne est incomplet ou incohérent.');
  }
  return payload as unknown as DailyForecastStatus;
}

// Charge le rapport déjà calculé sans demander un entraînement ou un backtest en direct.
export async function fetchDailyT2MValidation(signal?: AbortSignal): Promise<DailyT2MValidation> {
  const response = await fetch('/api/validation/t2m-daily', { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(await errorMessage(response));
  const payload: unknown = await response.json();
  if (!isObject(payload)
    || payload.status !== 'historical_backtest_only'
    || typeof payload.run_id !== 'string'
    || !isDailyForecastSource(payload.source)
    || !isObject(payload.validation)
    || !isObject(payload.validation.metrics_by_horizon)
    || !Array.isArray(payload.validation.predictions)
    || !payload.validation.predictions.every(isDailyValidationPrediction)
    || !isDailyLatestObservation(payload.latest_observation)) {
    throw new Error('Le rapport de validation quotidien est incomplet ou incohérent.');
  }
  return payload as unknown as DailyT2MValidation;
}

// Lit l'absence de feed officiel et l'état de la source d'observation archivée.
export async function fetchOfficialAlertsStatus(signal?: AbortSignal): Promise<OfficialAlertsStatus> {
  const response = await fetch('/api/alerts/status', { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(await errorMessage(response));
  const payload: unknown = await response.json();
  if (!isObject(payload)
    || !isObject(payload.official_alerts)
    || payload.official_alerts.available !== false
    || payload.official_alerts.status !== 'unavailable'
    || !isDailyLatestObservation(payload.latest_observation)
    || typeof payload.source_sha256 !== 'string'
    || payload.is_current !== false) {
    throw new Error('Le statut des alertes ne correspond pas au contrat attendu.');
  }
  return payload as unknown as OfficialAlertsStatus;
}

// Envoie le seuil demandé au backend pour le comparer à la dernière observation réelle archivée.
export async function evaluateDailyT2MThreshold(
  variable: 'T2M' | 'PRECTOTCORR',
  operator: 'gt' | 'lt',
  threshold: number,
  signal?: AbortSignal,
): Promise<ExploratoryThresholdResult> {
  const response = await fetch('/api/alerts/exploratory', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ variable, operator, threshold }),
    signal,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const payload: unknown = await response.json();
  if (!isObject(payload)
    || payload.kind !== 'exploratory_threshold_indicator'
    || typeof payload.triggered !== 'boolean'
    || payload.is_current !== false
    || payload.is_official !== false
    || !isObject(payload.observation)
    || !isObject(payload.rule)
    || !isDailyForecastSource(payload.source)
    || typeof payload.message !== 'string') {
    throw new Error('Le résultat de seuil exploratoire est incomplet ou incohérent.');
  }
  return payload as unknown as ExploratoryThresholdResult;
}

// Un score ML mensuel décrit les erreurs et le nombre de comparaisons sur des dates réelles.
export interface MonthlyMlScore {
  n: number;
  mae: number;
  rmse: number;
}

// La baseline saisonnière signale une disponibilité partielle sans fabriquer de valeurs manquantes.
export interface MonthlyMlSeasonalScore {
  available: boolean;
  n: number;
  period: { start: string; end: string } | null;
  mae: number | null;
  rmse: number | null;
  reason: string | null;
}

// Métriques, tailles d'échantillon et périodes sont publiées séparément pour chaque horizon.
export interface MonthlyMlHorizonMetrics {
  horizon_months: number;
  n: number;
  origin_period: { start: string; end: string };
  validation_period: { start: string; end: string };
  training_examples: { min: number; max: number };
  models: {
    candidate: MonthlyMlScore;
    persistence: MonthlyMlScore;
    seasonal_baseline: MonthlyMlSeasonalScore;
  };
}

// Une ligne de validation conserve son origine, son horizon et toutes les valeurs comparées.
export interface MonthlyMlValidationPrediction {
  origin_date: string;
  valid_date: string;
  horizon_months: number;
  observed: number;
  model: number;
  persistence: number;
  seasonal_baseline: number | null;
  training_examples: number;
}

// Le rapport conserve les observations du CSV et les compare aux projections dans un format partagé.
export interface MonthlyMlReport {
  schema_version: 2;
  run_id: string;
  status: 'exploratory_user_uploaded_data';
  is_current: false;
  is_official: false;
  target: { column: string; unit: string };
  source: {
    type: 'user_uploaded_csv';
    filename: string;
    sha256: string;
    retrieved_at: null;
    record_count: number;
    source_period: { start: string; end: string };
    declared_context: Record<string, string>;
  };
  configuration: {
    model_name: 'random_forest' | 'ridge';
    model_version: string;
    estimator: string;
    parameters: Record<string, unknown>;
    feature_names: string[];
    horizon_months: number;
    validation_origins: number;
    validation_method: string;
    baseline_persistence: string;
    baseline_seasonal: string;
    software_versions: Record<string, string>;
    future_observations_used: false;
    random_split: false;
    final_training_examples: number;
  };
  code_sha256: string;
  uncertainty: string;
  history: { date: string; value: number }[];
  latest_observation: { date: string; value: number };
  validation: {
    method: string;
    origin_period: { start: string; end: string };
    metrics_by_horizon: Record<string, MonthlyMlHorizonMetrics>;
    predictions: MonthlyMlValidationPrediction[];
    uncertainty: string;
  };
  forecast_origin: string;
  forecast: { date: string; horizon_months: number; prediction: number }[];
}
