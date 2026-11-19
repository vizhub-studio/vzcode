import { useContext, useState } from 'react';
import { VZCodeContext } from './VZCodeContext';

/**
 * Standalone-only conflict resolution. Embedded hosts can provide their
 * own affordance for external file conflicts.
 */
export const WorkspaceConflictBanner = () => {
  const { content } = useContext(VZCodeContext);
  const conflicts: string[] = (
    content as unknown as {
      workspaceConflicts?: string[];
    } | null
  )?.workspaceConflicts ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!conflicts.length) return null;

  const resolve = async (
    name: string,
    choice: 'disk' | 'editor',
  ) => {
    if (
      choice === 'editor' &&
      !window.confirm(
        'Overwrite the external disk changes for "' +
          name + '" with the editor version?',
      )
    ) {
      return;
    }
    setBusy(name);
    setError(null);
    try {
      const response = await fetch(
        '/workspace-conflicts/resolve',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, choice }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(
          () => ({}),
        );
        throw new Error(
          body.error || 'Unable to resolve conflict',
        );
      }
    } catch (caught: any) {
      setError(caught.message ?? String(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        maxHeight: '45vh',
        overflowY: 'auto',
        maxWidth: 'min(600px, 95vw)',
        padding: 14,
        borderRadius: 8,
        background: '#fff4dc',
        color: '#3a2a12',
        border: '1px solid #d6a341',
        boxShadow: '0 4px 20px #0003',
      }}
    >
      <strong>External filesystem conflict</strong>
      <p>
        Changes were made to these files outside VZCode while
        there were unsaved editor changes. Autosave is paused
        to prevent data loss.
      </p>
      {conflicts.map((name) => (
        <div
          key={name}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <code>{name}</code>
          <button
            disabled={busy !== null}
            onClick={() => void resolve(name, 'disk')}
          >
            Load disk version
          </button>
          <button
            disabled={busy !== null}
            onClick={() => void resolve(name, 'editor')}
          >
            Overwrite disk with editor
          </button>
        </div>
      ))}
      {error ? <p>{error}</p> : null}
    </aside>
  );
};
