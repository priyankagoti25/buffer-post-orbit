import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { errorMessage } from '../../lib/format';
import { altFromName, kindOfFile, uploadFile, type MediaItem } from '../../lib/media';
import Icon from '../Icon';

type Props = {
  value: MediaItem[];
  onChange: Dispatch<SetStateAction<MediaItem[]>>;
  max?: number;
};

const patch = (id: string, change: Partial<MediaItem>) => (list: MediaItem[]) =>
  list.map((m) => (m.id === id ? { ...m, ...change } : m));

export default function MediaUploader({ value, onChange, max = 10 }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [drag, setDrag] = useState(false);

  function add(files: FileList | File[]) {
    setMessage('');
    const list = Array.from(files);
    const room = max - value.length;
    if (list.length > room) setMessage(`You can add up to ${max} files. Extra files were skipped.`);
    for (const file of list.slice(0, Math.max(room, 0))) {
      const kind = kindOfFile(file);
      if (!kind) {
        setMessage(`"${file.name}" is not supported. Use JPG, PNG, GIF, WebP, MP4 or MOV.`);
        continue;
      }
      const id = `m${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
      const localUrl = URL.createObjectURL(file);
      onChange((cur) => [...cur, { id, kind, name: file.name, url: '', altText: kind === 'image' ? altFromName(file.name) : '', status: 'uploading', progress: 0, localUrl }]);
      uploadFile(file, kind, (pct) => onChange(patch(id, { progress: pct })))
        .then((url) => onChange(patch(id, { url, status: 'done', progress: 100 })))
        .catch((e) => onChange(patch(id, { status: 'error', error: errorMessage(e, e instanceof Error ? e.message : 'Upload failed.') })));
    }
    if (input.current) input.current.value = '';
  }

  const remove = (m: MediaItem) => {
    if (m.localUrl) URL.revokeObjectURL(m.localUrl);
    onChange((cur) => cur.filter((x) => x.id !== m.id));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={`rounded-2xl border border-dashed px-4 py-4 text-center transition-colors ${drag ? 'border-forest-600 bg-sage-100' : 'border-sage-300 bg-cream'}`}
      >
        <button type="button" className="btn btn-soft btn-sm" onClick={() => input.current?.click()} disabled={value.length >= max}>
          <Icon name="image" className="h-4 w-4" /> Add photos or videos
        </button>
        <p className="mt-2 text-xs text-muted">or drop files here · JPG, PNG, GIF, WebP, MP4, MOV</p>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
          onChange={(e) => e.target.files && add(e.target.files)}
        />
      </div>
      {message && <p className="mt-2 text-xs text-red-700">{message}</p>}

      {value.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((m) => {
            const src = m.localUrl || m.url;
            return (
              <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-paper">
                <div className="relative aspect-square bg-stone-100">
                  {m.kind === 'image' ? (
                    <img src={src} alt={m.altText || ''} className="h-full w-full object-cover" />
                  ) : (
                    <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  )}
                  {m.kind === 'video' && <span className="absolute left-2 top-2 chip bg-black/60 text-white">Video</span>}
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    aria-label={`Remove ${m.name}`}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                  {m.status === 'uploading' && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 p-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                        <div className="h-full bg-white transition-all" style={{ width: `${m.progress}%` }} />
                      </div>
                    </div>
                  )}
                  {m.status === 'error' && (
                    <div className="absolute inset-0 grid place-items-center bg-red-900/70 p-2 text-center text-xs text-white">{m.error}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
