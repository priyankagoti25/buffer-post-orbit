import { useState } from 'react';
import { errorMessage } from '../../lib/format';
import { startBufferConnect } from '../../store/buffer/bufferService';
import Notice from '../Notice';

/** The one way into the app: send the person to Buffer to sign in. */
export default function ContinueButton({ className = '', label = 'Continue with Buffer' }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setBusy(true);
    setError('');
    try {
      await startBufferConnect();
    } catch (e) {
      setError(errorMessage(e, 'Could not start the Buffer sign-in. Try again.'));
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={go} disabled={busy} className={`btn btn-primary ${className}`}>
        {busy ? 'Opening Buffer…' : label}
      </button>
      {error && <Notice kind="error" className="mt-3">{error}</Notice>}
    </>
  );
}
