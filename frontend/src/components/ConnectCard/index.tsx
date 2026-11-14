import { useState } from 'react';
import { errorMessage } from '../../lib/format';
import { startBufferConnect } from '../../store/buffer/bufferService';
import Notice from '../Notice';

/** Shown on any page that needs Buffer when the account is not connected yet. */
export default function ConnectCard({ reauth = false }: { reauth?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function connect() {
    setBusy(true);
    setError('');
    try {
      await startBufferConnect();
    } catch (e) {
      setError(errorMessage(e, 'Unable to start the Buffer connection.'));
      setBusy(false);
    }
  }

  return (
    <section className="grid overflow-hidden rounded-[1.75rem] md:grid-cols-5">
      <div className="bg-sage-300 p-8 sm:p-10 md:col-span-3">
        <h2 className="max-w-md text-4xl leading-[1.1] text-forest-900 sm:text-5xl">
          {reauth ? 'Reconnect Buffer.' : 'Connect Buffer.'}
          <br />
          Take it from here.
        </h2>
        <p className="mt-5 max-w-md text-[0.95rem] leading-6 text-forest-800">
          {reauth
            ? 'Buffer needs you to sign in again before this app can keep working with your channels.'
            : 'See every channel, queue and draft in one calm place, write with real formatting, and bring your best posts back with a click.'}
        </p>
        {error && <Notice kind="error" className="mt-5">{error}</Notice>}
        <button onClick={connect} disabled={busy} className="btn btn-primary mt-7 px-6 py-3.5 text-base">
          {busy ? 'Opening Buffer…' : reauth ? 'Reconnect Buffer' : 'Connect Buffer'}
        </button>
      </div>
      <div className="hidden place-items-center bg-mist-300 p-8 md:col-span-2 md:grid">
        <div className="w-full max-w-[15rem] space-y-3">
          {['Queue', 'Drafts', 'Recurring'].map((t, i) => (
            <div key={t} className="rounded-2xl bg-white/90 p-4 shadow-sm" style={{ marginLeft: i * 14 }}>
              <div className="text-xs font-semibold text-forest-800">{t}</div>
              <div className="mt-2 h-2 w-4/5 rounded-full bg-mist-200" />
              <div className="mt-1.5 h-2 w-3/5 rounded-full bg-mist-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
