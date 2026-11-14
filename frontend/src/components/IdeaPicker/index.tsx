import { useEffect, useMemo, useState } from 'react';
import { timeAgo } from '../../lib/format';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchIdeas } from '../../store/ideas/ideasService';
import type { Idea } from '../../types/buffer';
import Loading from '../Loading';
import Modal from '../Modal';

/** Pick one of your saved ideas to start a post from. */
export default function IdeaPicker({ onPick, onClose }: { onPick: (idea: Idea) => void; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { items, loaded, loading, error, bufferError } = useAppSelector((s) => s.ideas);
  const [q, setQ] = useState('');

  // Always ask for the latest list when the picker opens, so ideas added in Buffer show up.
  useEffect(() => {
    void dispatch(fetchIdeas());
  }, [dispatch]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => `${i.title} ${i.text}`.toLowerCase().includes(t)) : items;
  }, [items, q]);

  return (
    <Modal title="Start from an idea" onClose={onClose} wide>
      <input className="field mb-4" placeholder="Search ideas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ideas" />
      {loading && !loaded && <Loading />}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {bufferError && <p className="mb-3 rounded-xl bg-sand-100 p-3 text-xs text-sand-700">Could not read your Buffer ideas ({bufferError}). Ideas saved in this app are still listed.</p>}
      {loaded && shown.length === 0 && <p className="py-8 text-center text-sm text-muted">{items.length ? 'No matching ideas.' : 'You have no ideas yet. Add one on the Ideas page, or in Buffer.'}</p>}
      <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
        {shown.map((i) => (
          <li key={i.id}>
            <button onClick={() => onPick(i)} className="flex w-full items-start gap-3 rounded-2xl border border-line bg-paper p-3 text-left hover:bg-sage-50">
              {i.assets[0]?.kind === 'image' && <img src={i.assets[0].url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{i.title || 'Untitled'}</span>
                  {i.syncStatus === 'synced' && <span className="chip shrink-0 bg-sage-100 text-forest-800">In Buffer</span>}
                </span>
                <span className="line-clamp-2 text-xs text-muted">{i.text}</span>
                <span className="mt-1 block text-[0.7rem] text-muted">{timeAgo(i.updatedAt)}{i.assets.length ? ` · ${i.assets.length} media` : ''}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
