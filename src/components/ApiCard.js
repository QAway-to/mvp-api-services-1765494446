import Link from 'next/link';

export default function ApiCard({ icon, title, description, href, status = 'ready' }) {
  const statusLabels = {
    ready: 'Ready',
    coming: 'Coming Soon',
    beta: 'Beta',
  };

  const statusColors = {
    ready: 'status-success',
    coming: 'status-warning',
    beta: 'status-info',
  };

  const CardContent = () => (
    <>
      <div className="api-card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="api-card-footer">
        <span className={`status-badge ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
        {href && <span>→</span>}
      </div>
    </>
  );

  if (!href || status === 'coming') {
    return (
      <div className="api-card" style={{ opacity: status === 'coming' ? 0.6 : 1, cursor: 'default' }}>
        <CardContent />
      </div>
    );
  }

  return (
    <Link href={href} className="api-card">
      <CardContent />
    </Link>
  );
}

