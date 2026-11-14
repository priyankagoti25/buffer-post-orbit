import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOverview } from '../../hooks/useOverview';
import type { Overview } from '../../types/buffer';
import ConnectCard from '../ConnectCard';
import Loading from '../Loading';
import Notice from '../Notice';

type Props = { children: (ctx: { overview: Overview; reload: () => void }) => ReactNode };

/** Shows the page only when Buffer is connected and the overview has loaded. */
export default function BufferGate({ children }: Props) {
  const { status, statusError, overview, loading, error, reload } = useOverview();
  const [params, setParams] = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const oauth = params.get('buffer');
  const oauthNotice =
    !dismissed && oauth === 'error' ? (
      <Notice
        kind="error"
        className="mb-6"
        onDismiss={() => {
          setDismissed(true);
          setParams({}, { replace: true });
        }}
      >
        Buffer connection failed: {params.get('reason') ?? 'unknown error'}
      </Notice>
    ) : !dismissed && oauth === 'connected' ? (
      <Notice
        kind="success"
        className="mb-6"
        onDismiss={() => {
          setDismissed(true);
          setParams({}, { replace: true });
        }}
      >
        Buffer is connected.
      </Notice>
    ) : null;

  let body: ReactNode;
  if (statusError && !status) body = <Notice kind="error">{statusError}</Notice>;
  else if (!status) body = <Loading />;
  else if (!status.connected) body = <ConnectCard reauth={status.reauthRequired} />;
  else if (error && !overview) {
    body = (
      <Notice kind="error">
        {error} <button className="underline" onClick={() => void reload()}>Try again</button>
      </Notice>
    );
  } else if (!overview || loading && !overview) body = <Loading label="Loading your Buffer account…" />;
  else body = children({ overview, reload: () => void reload() });

  return (
    <>
      {oauthNotice}
      {body}
    </>
  );
}
