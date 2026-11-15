/** Carte de présentation d’un indicateur déjà calculé à partir des lignes visibles. */
interface MetricCardProps {
  title: string;
  value: string;
  note: string;
  tone: 'blue' | 'orange' | 'violet' | 'green';
  deltaTone?: 'positive' | 'negative' | 'neutral';
}

/** Présente un résumé fourni par l’appelant sans effectuer de calcul de prévision. */
export function MetricCard({ title, value, note, tone, deltaTone = 'neutral' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-heading">
        <span>{title}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className={`metric-note ${deltaTone === 'neutral' ? '' : `metric-note-${deltaTone}`}`}>{note}</span>
    </article>
  );
}
