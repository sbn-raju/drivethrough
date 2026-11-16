import { useId, useRef, useState } from 'react';
import { CheckCircle2, FileText, Upload } from 'lucide-react';

type Props = {
  label: string;
  description?: string;
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  /** Shown when a file has already been uploaded previously. */
  existingLabel?: string | null;
  error?: string;
  maxBytes?: number;
};

export function FileDrop({ label, description, accept, file, onFile, existingLabel, error, maxBytes = 5 * 1024 * 1024 }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const shownError = localError ?? error;

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > maxBytes) {
      setLocalError('This file is larger than 5 MB. Choose a smaller file.');
      return;
    }
    setLocalError(null);
    onFile(f);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center gap-2 rounded-[14px] border border-dashed px-4 py-6 text-center transition-colors ${
          shownError ? 'border-danger bg-danger/5' : dragging ? 'border-brand-yellow-hover bg-brand-yellow-soft' : 'border-border bg-surface-secondary/50'
        }`}
      >
        {file ? (
          <>
            <FileText className="size-6 text-foreground" aria-hidden />
            <p className="max-w-full truncate text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB · ready to upload</p>
          </>
        ) : existingLabel ? (
          <>
            <CheckCircle2 className="size-6 text-success" aria-hidden />
            <p className="text-sm font-semibold">{existingLabel}</p>
            <p className="text-xs text-muted">Choose a new file only if you want to replace it.</p>
          </>
        ) : (
          <>
            <Upload className="size-6 text-muted" aria-hidden />
            <p className="text-sm">
              <span className="font-semibold">Drag a file here</span> or choose one below
            </p>
          </>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-1 min-h-9 rounded-[10px] border border-border bg-white px-4 text-sm font-semibold hover:bg-surface-secondary focus-visible:outline-3 focus-visible:outline-brand-yellow/50"
        >
          {file || existingLabel ? 'Choose a different file' : 'Choose file'}
        </button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          aria-describedby={`${id}-help`}
          aria-invalid={!!shownError}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      <p id={`${id}-help`} className={`text-xs ${shownError ? 'text-danger' : 'text-muted'}`}>
        {shownError ?? description}
      </p>
    </div>
  );
}
