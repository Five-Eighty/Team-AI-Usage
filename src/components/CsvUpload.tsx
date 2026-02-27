import { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';
import type { AIService } from '../types/index.js';
import { SERVICE_LABELS, SERVICE_COLORS } from '../types/index.js';

interface UploadInfo {
  filename: string;
  uploadedAt: string;
  recordCount: number;
}

interface UploadResult {
  recordsImported: number;
  totalRows: number;
  unmatchedNames?: string[];
  filename: string;
}

const CSV_SERVICES: AIService[] = ['higgsfield', 'weavy'];

export function CsvUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [uploads, setUploads] = useState<Record<string, UploadInfo | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [result, setResult] = useState<{ service: string; data: UploadResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeService, setActiveService] = useState<AIService | null>(null);

  // Fetch existing upload info on mount
  useState(() => {
    for (const service of CSV_SERVICES) {
      axios.get(`/api/upload/${service}`).then((res) => {
        if (res.data?.success && res.data.data) {
          setUploads((prev) => ({ ...prev, [service]: res.data.data }));
        }
      }).catch(() => {});
    }
  });

  function handleUploadClick(service: AIService) {
    setActiveService(service);
    setError(null);
    setResult(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeService) return;

    setUploading(activeService);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`/api/upload/${activeService}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setResult({ service: activeService, data: res.data.data });
        setUploads((prev) => ({
          ...prev,
          [activeService]: {
            filename: res.data.data.filename,
            uploadedAt: new Date().toISOString(),
            recordCount: res.data.data.recordsImported,
          },
        }));
        onUploadComplete();
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Upload failed');
      }
    } finally {
      setUploading(null);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(service: AIService) {
    try {
      await axios.delete(`/api/upload/${service}`);
      setUploads((prev) => ({ ...prev, [service]: null }));
      setResult(null);
      onUploadComplete();
    } catch {
      // ignore
    }
  }

  return (
    <div className="csv-upload">
      <h4>CSV Data Import</h4>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      <div className="csv-services">
        {CSV_SERVICES.map((service) => {
          const info = uploads[service];
          return (
            <div key={service} className="csv-service-row">
              <span
                className="service-dot"
                style={{ backgroundColor: SERVICE_COLORS[service] }}
              />
              <span className="csv-service-name">{SERVICE_LABELS[service]}</span>
              {info ? (
                <div className="csv-uploaded-info">
                  <FileText size={14} />
                  <span className="csv-filename">{info.filename}</span>
                  <span className="csv-count">{info.recordCount} records</span>
                  <button
                    className="csv-delete-btn"
                    onClick={() => handleDelete(service)}
                    title="Remove uploaded data"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-small"
                  onClick={() => handleUploadClick(service)}
                  disabled={uploading === service}
                >
                  <Upload size={14} />
                  {uploading === service ? 'Uploading...' : 'Upload CSV'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {result && (
        <div className="csv-result">
          <CheckCircle size={14} />
          <span>
            Imported {result.data.recordsImported} records from {result.data.filename}
          </span>
          {result.data.unmatchedNames && result.data.unmatchedNames.length > 0 && (
            <div className="csv-unmatched">
              Could not match: {result.data.unmatchedNames.join(', ')}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="csv-error">{error}</div>
      )}
    </div>
  );
}
