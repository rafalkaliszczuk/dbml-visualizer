import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { SAMPLE_DBML } from '../utils/dbmlParser';

interface FileUploaderProps {
  onLoad: (content: string) => void;
  error: string | null;
}

export default function FileUploader({ onLoad, error }: FileUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => onLoad((e.target?.result as string) ?? '');
      reader.readAsText(file);
    },
    [onLoad]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [readFile]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) readFile(file);
    },
    [readFile]
  );

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#6366f1" />
            <rect x="6" y="8" width="20" height="3" rx="1.5" fill="white" />
            <rect x="6" y="14" width="20" height="3" rx="1.5" fill="white" fillOpacity="0.7" />
            <rect x="6" y="20" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.4" />
          </svg>
          <h1 className="text-2xl font-bold text-white tracking-tight">DBML Visualizer</h1>
        </div>
        <p className="text-[#8b949e] text-sm">
          Interactive read-only ERD viewer for DBML schemas
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl">
        {/* Tabs */}
        <div className="flex border-b border-[#30363d]">
          {(['upload', 'paste'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mode === tab
                  ? 'text-white border-b-2 border-[#6366f1]'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              {tab === 'upload' ? 'Upload File' : 'Paste DBML'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {mode === 'upload' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#6366f1] bg-[#6366f1]/5'
                  : 'border-[#30363d] hover:border-[#4d5566] hover:bg-[#1c2128]'
              }`}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                className={isDragging ? 'text-[#6366f1]' : 'text-[#4d5566]'}
              >
                <path
                  d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="17 8 12 3 7 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="12"
                  y1="3"
                  x2="12"
                  y2="15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center">
                <p className="text-[#e6edf3] text-sm font-medium">Drop a .dbml file here</p>
                <p className="text-[#8b949e] text-xs mt-1">or click to browse</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".dbml,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder={`Table users {\n  id integer [pk]\n  name varchar\n}\n\nRef: ...`}
                className="w-full h-48 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] font-mono placeholder-[#4d5566] resize-none focus:outline-none focus:border-[#6366f1] transition-colors"
              />
              <button
                onClick={() => pasteContent.trim() && onLoad(pasteContent)}
                disabled={!pasteContent.trim()}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Visualize Schema
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-red-400 flex-shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-red-400 text-xs font-mono">{error}</p>
            </div>
          )}

          {/* Sample */}
          <button
            onClick={() => onLoad(SAMPLE_DBML)}
            className="mt-4 w-full py-2 rounded-lg text-sm text-[#8b949e] border border-[#30363d] hover:border-[#4d5566] hover:text-[#e6edf3] transition-colors"
          >
            Load sample schema
          </button>
        </div>
      </div>

      <p className="mt-6 text-[#4d5566] text-xs">
        Supports DBML syntax — tables, fields, references, indexes
      </p>
    </div>
  );
}
