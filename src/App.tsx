import { useState, useCallback, useEffect } from 'react';
import { parseDBML } from './utils/dbmlParser';
import type { ParsedSchema } from './utils/types';
import FileUploader from './components/FileUploader';
import DiagramViewer from './components/DiagramViewer';

const STORAGE_KEY = 'dbml-visualizer:content';

function tryRestoreSchema(): ParsedSchema | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = parseDBML(saved);
    return parsed.tables.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function tryParseBuiltin(): ParsedSchema | null {
  try {
    if (!__BUILTIN_DBML__) return null;
    const parsed = parseDBML(__BUILTIN_DBML__);
    return parsed.tables.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export default function App() {
  // Built-in DBML (injected at build time) takes priority — skip localStorage and FileUploader
  const builtinSchema = tryParseBuiltin();

  const [schema, setSchema] = useState<ParsedSchema | null>(
    builtinSchema ?? tryRestoreSchema()
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Layer 2: try fetching ./schema.dbml (Docker serve mode or Pages with file in public/)
  useEffect(() => {
    if (schema || builtinSchema) return;

    setLoading(true);
    fetch('./schema.dbml')
      .then((res) => {
        if (!res.ok) throw new Error('not found');
        return res.text();
      })
      .then((content) => {
        const parsed = parseDBML(content);
        if (parsed.tables.length > 0) setSchema(parsed);
      })
      .catch(() => {
        // No schema.dbml available — fall through to FileUploader
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = useCallback((content: string) => {
    try {
      setError(null);
      const parsed = parseDBML(content);
      if (parsed.tables.length === 0) {
        setError('No tables found. Check your DBML syntax.');
        return;
      }
      localStorage.setItem(STORAGE_KEY, content);
      setSchema(parsed);
    } catch (err: unknown) {
      const diag = (err as any)?.diags?.[0];
      const message = diag?.message ?? (err instanceof Error ? err.message : String(err));
      setError(message);
    }
  }, []);

  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSchema(null);
    setError(null);
  }, []);

  if (schema) {
    return (
      <DiagramViewer
        schema={schema}
        // Hide "New Schema" button when DBML is baked in at build time
        onReset={builtinSchema ? undefined : handleReset}
      />
    );
  }

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0d1117',
          color: '#8b949e',
          fontSize: 14,
          gap: 10,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="#30363d" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Loading schema…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <FileUploader onLoad={handleLoad} error={error} />;
}
