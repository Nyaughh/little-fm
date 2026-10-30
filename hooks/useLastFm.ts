import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadListeningState, refreshListeningState, saveUsernames, saveWidgetSettings } from '../services/listening';
import { defaultSettings, normalizeUsernames, type ListeningState, type WidgetSettings } from '../services/listening-model';
import { syncWidgets } from '../widgets/bridge';

export function useLastFm() {
  const [state, setState] = useState<ListeningState>({ usernames: [], tracks: [], settings: defaultSettings });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const refreshTracks = useCallback(async () => {
    if (mounted.current) setLoading(true);
    try {
      const next = await refreshListeningState();
      if (mounted.current) { setState(next); setError(null); }
      await syncWidgets();
    } catch { if (mounted.current) setError('Could not load your saved friends. Try again.'); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    loadListeningState().then(next => {
      if (mounted.current) { setState(next); setReady(true); void refreshTracks(); }
    }).catch(() => { if (mounted.current) setError('Could not read saved friends. Restart the app.'); });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void refreshTracks(); }, 30000);
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void refreshTracks(); });
    return () => { mounted.current = false; clearInterval(interval); subscription.remove(); };
  }, [refreshTracks]);
  const updateUsers = async (usernames: string[]) => {
    await saveUsernames(usernames);
    setState(await loadListeningState());
    await syncWidgets();
    await refreshTracks();
  };
  const addUsername = async (name: string) => {
    const next = normalizeUsernames([...state.usernames, name]);
    if (next.length === state.usernames.length) throw new Error('That friend is already in your circle.');
    await updateUsers(next);
  };
  const removeUsername = async (name: string) => updateUsers(state.usernames.filter(username => username !== name));
  const updateSettings = async (settings: WidgetSettings) => {
    await saveWidgetSettings(settings);
    setState(previous => ({ ...previous, settings }));
    await syncWidgets();
  };
  return { ...state, userTracks: state.tracks, ready, loading, error, addUsername, removeUsername, refreshTracks, updateSettings };
}
