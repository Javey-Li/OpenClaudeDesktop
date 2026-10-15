import { useCallback, useEffect, useRef, useState } from 'react';

// Both source surfaces consume the same persisted scheduler and its change
// events. Ignore replies from an older request or an unmounted surface.
export function useLocalRoutines(call) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const reload = useCallback(async () => {
    const version = ++revision.current;
    try {
      const value = await call('local-routines', { action: 'list' });
      if (version === revision.current) { setTasks(value); setError(''); }
    } catch (error) {
      if (version === revision.current) setError(error.message);
    }
  }, [call]);
  useEffect(() => {
    const unsubscribe = window.desktop?.onEvent?.(event => {
      if (event.kind === 'local-routines') void reload();
    });
    void reload();
    return () => { revision.current++; unsubscribe?.(); };
  }, [reload]);
  return { tasks, error, reload };
}
