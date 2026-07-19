export default function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="card px-4 py-3">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="text-xs text-ink-muted mt-1">{note}</div>}
    </div>
  );
}
