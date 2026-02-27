import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { fetchServiceStatus } from '../api/client.js';

interface ServiceInfo {
  configured: boolean;
  label: string;
  note?: string;
}

export function ServiceStatus() {
  const [services, setServices] = useState<Record<string, ServiceInfo> | null>(
    null
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchServiceStatus()
      .then(setServices)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!services) return null;

  const configuredCount = Object.values(services).filter(
    (s) => s.configured
  ).length;

  return (
    <div className="service-status">
      <h4>
        API Connections ({configuredCount}/{Object.keys(services).length})
      </h4>
      <div className="status-list">
        {Object.entries(services).map(([key, service]) => (
          <div key={key} className="status-item">
            {service.configured ? (
              <CheckCircle size={16} className="status-ok" />
            ) : (
              <XCircle size={16} className="status-missing" />
            )}
            <span className="status-label">{service.label}</span>
            {service.note && (
              <span className="status-note" title={service.note}>
                <AlertTriangle size={12} />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
