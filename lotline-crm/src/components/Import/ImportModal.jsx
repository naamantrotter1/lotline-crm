/**
 * ImportModal.jsx
 * Phase 5: 4-step CSV import wizard for contacts and deals.
 *
 * Steps:
 *   1. Upload  — drop or pick a CSV file
 *   2. Map     — assign CSV columns to target fields
 *   3. Preview — see first 5 mapped rows
 *   4. Done    — import progress + result summary
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Upload, ChevronRight, ChevronLeft, Loader2,
  CheckCircle, AlertCircle, FileText, Users, Briefcase,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  parseCSV, autoDetect,
  CONTACT_FIELDS, importContacts,
  DEAL_FIELDS,   importDeals,
} from '../../lib/importData';

const STEPS = ['Upload', 'Map Columns', 'Preview', 'Import'];

// ── Small helpers ─────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
            i < step  ? 'bg-green-500 text-white' :
            i === step ? 'bg-accent text-white' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i < step ? '✓' : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-8 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
      <span className="ml-3 text-sm font-medium text-gray-600">{STEPS[step]}</span>
    </div>
  );
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────

function UploadStep({ entityType, setEntityType, onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = (file) => {
    setError('');
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please select a .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, rows } = parseCSV(text);
      if (!headers.length) { setError('File appears empty or unreadable.'); return; }
      if (!rows.length) { setError('No data rows found (only a header row).'); return; }
      onParsed({ headers, rows, fileName: file.name });
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [entityType]);

  return (
    <div className="space-y-5">
      {/* Entity type selector */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Import as</p>
        <div className="flex gap-3">
          {[
            { value: 'contacts', label: 'Contacts', Icon: Users },
            { value: 'deals',    label: 'Deals',    Icon: Briefcase },
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setEntityType(value)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                entityType === value
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-12 cursor-pointer transition-colors ${
          dragging ? 'border-accent bg-accent/5' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
          <Upload size={22} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Drop a CSV file here</p>
          <p className="text-xs text-gray-400 mt-0.5">or click to browse</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 font-medium">Tip</p>
        <p className="text-xs text-amber-600 mt-0.5">
          {entityType === 'contacts'
            ? 'Include columns like Name, Email, Phone, Company. The first row must be a header row.'
            : 'Include columns like Address, County, State, Acreage. The first row must be a header row.'}
        </p>
      </div>
    </div>
  );
}

// ── Step 2: Map Columns ───────────────────────────────────────────────────────

function MapStep({ headers, entityType, colMap, setColMap }) {
  const fields = entityType === 'deals' ? DEAL_FIELDS : CONTACT_FIELDS;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Match your CSV columns to the right fields. Skip any columns you don't want to import.
      </p>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-1/2">Field</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-1/2">CSV Column</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {fields.map(f => (
              <tr key={f.key} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5">
                  <p className="text-sm font-medium text-gray-700">{f.label}</p>
                  {f.hint && <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={colMap[f.key] || ''}
                    onChange={e => setColMap(prev => ({ ...prev, [f.key]: e.target.value || undefined }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                  >
                    <option value="">— skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Step 3: Preview ───────────────────────────────────────────────────────────

function PreviewStep({ rows, headers, entityType, colMap }) {
  const fields = entityType === 'deals' ? DEAL_FIELDS : CONTACT_FIELDS;
  const mapped = fields.filter(f => colMap[f.key]);
  const preview = rows.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing first {preview.length} of <strong>{rows.length}</strong> rows.
          {' '}<strong>{mapped.length}</strong> columns mapped.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {mapped.map(f => (
                <th key={f.key} className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {preview.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {mapped.map(f => (
                  <td key={f.key} className="px-3 py-2 text-gray-700 max-w-[160px] truncate">
                    {row[colMap[f.key]] || <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <p className="text-xs text-gray-400 text-center">… and {rows.length - 5} more rows</p>
      )}
    </div>
  );
}

// ── Step 4: Import (progress + result) ───────────────────────────────────────

function ImportStep({ status, result }) {
  if (status === 'idle') return null;

  if (status === 'running') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 size={32} className="animate-spin text-accent" />
        <p className="text-sm text-gray-600">Importing rows…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 px-5 py-4 rounded-xl border ${
        result.errors ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
      }`}>
        {result.errors
          ? <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          : <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
        }
        <div>
          <p className="font-semibold text-gray-800">
            {result.errors ? 'Import completed with errors' : 'Import complete'}
          </p>
          <ul className="text-sm text-gray-600 mt-1 space-y-0.5">
            <li><strong>{result.imported}</strong> records imported successfully</li>
            {result.skipped > 0 && <li><strong>{result.skipped}</strong> rows skipped (no identifying data)</li>}
            {result.errors > 0  && <li><strong>{result.errors}</strong> rows failed (see browser console for details)</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ImportModal({ onClose, onDone, defaultEntityType = 'contacts' }) {
  const { activeOrgId } = useAuth();
  const [step, setStep] = useState(0);
  const [entityType, setEntityType] = useState(defaultEntityType);
  const [parsed, setParsed] = useState(null);   // { headers, rows, fileName }
  const [colMap, setColMap] = useState({});
  const [importStatus, setImportStatus] = useState('idle'); // 'idle' | 'running' | 'done'
  const [result, setResult] = useState(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Reset mapping when entity type changes
  useEffect(() => { setColMap({}); }, [entityType]);

  const handleParsed = ({ headers, rows, fileName }) => {
    const detectedMap = autoDetect(headers, entityType);
    setParsed({ headers, rows, fileName });
    setColMap(detectedMap);
    setStep(1);
  };

  const canProceedMap = () => {
    const mappedKeys = Object.keys(colMap).filter(k => colMap[k]);
    if (entityType === 'contacts') {
      return mappedKeys.some(k => ['full_name','first_name','email','phone'].includes(k));
    }
    return mappedKeys.includes('address');
  };

  const handleImport = async () => {
    setStep(3);
    setImportStatus('running');
    const fn = entityType === 'deals' ? importDeals : importContacts;
    const res = await fn(activeOrgId, parsed.rows, colMap);
    setResult(res);
    setImportStatus('done');
  };

  const totalMapped = Object.values(colMap).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <h2 className="font-semibold text-gray-800">Import from CSV</h2>
            {parsed && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                {parsed.fileName}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepIndicator step={step} />

          {step === 0 && (
            <UploadStep
              entityType={entityType}
              setEntityType={setEntityType}
              onParsed={handleParsed}
            />
          )}
          {step === 1 && parsed && (
            <MapStep
              headers={parsed.headers}
              entityType={entityType}
              colMap={colMap}
              setColMap={setColMap}
            />
          )}
          {step === 2 && parsed && (
            <PreviewStep
              rows={parsed.rows}
              headers={parsed.headers}
              entityType={entityType}
              colMap={colMap}
            />
          )}
          {step === 3 && (
            <ImportStep status={importStatus} result={result} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <div>
            {step > 0 && step < 3 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft size={15} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step < 3 && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}

            {step === 0 && (
              <p className="text-xs text-gray-400">Select a file to continue</p>
            )}

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedMap()}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-40"
                style={{ backgroundColor: '#c9703a' }}
                title={!canProceedMap() ? 'Map at least one identifying field to continue' : ''}
              >
                Preview <ChevronRight size={15} />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleImport}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
                style={{ backgroundColor: '#c9703a' }}
              >
                Import {parsed?.rows.length} rows <ChevronRight size={15} />
              </button>
            )}

            {step === 3 && importStatus === 'done' && (
              <button
                onClick={() => { onDone && onDone(); onClose(); }}
                className="px-5 py-2 text-sm font-semibold text-white rounded-xl"
                style={{ backgroundColor: '#c9703a' }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
