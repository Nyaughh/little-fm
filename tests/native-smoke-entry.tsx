// Included only by -PlittleFmNativeTest. Never part of the release entry.
import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgets, syncWidgets } from '../widgets/bridge';
import { WidgetPreview } from '../components/WidgetPreview';
import { defaultSettings, patterns, type Pattern, type ListeningState } from '../services/listening-model';
import { saveUsernames, saveWidgetSettings } from '../services/listening';
import { resolveArtwork } from '../services/artwork';

registerWidgets();
const state: ListeningState = {
  usernames: ['mochi', 'fern', 'june', 'olive'], settings: defaultSettings,
  tracks: ['mochi', 'fern', 'june', 'olive'].map(username => ({ username, currentTrack: { title: 'Glue Song', artist: 'beabadoobee', album: 'Glue Song', isNowPlaying: false } })),
};
function SmokeApp() {
  const [status, setStatus] = useState('Preparing native widgets');
  const [coverReady, setCoverReady] = useState(false);
  const [preview, setPreview] = useState(state);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('WIDGET_SMOKE_PATTERN', async (pattern: Pattern) => {
      if (!(pattern in patterns)) return;
      const settings = { ...defaultSettings, pattern };
      await saveWidgetSettings(settings);
      await syncWidgets();
      setPreview({ ...state, settings });
      setStatus('Pattern ready ' + pattern);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => { void (async () => {
    try {
      await saveUsernames(state.usernames);
      await saveWidgetSettings(state.settings);
      await AsyncStorage.setItem('@lastfm_tracks_v1', JSON.stringify(state.tracks));
      const cover = await resolveArtwork(state.tracks[0].currentTrack!);
      setCoverReady(Boolean(cover.uri?.startsWith('data:image')));
      console.info('WIDGET_SMOKE_ARTWORK', cover.uri?.startsWith('data:image') ? 'decoded' : 'missing');
      await syncWidgets();
    } catch (error) { console.warn('WIDGET_SMOKE_SETUP', error instanceof Error ? error.message : 'unknown'); }
    finally { setStatus('Native checks ready'); }
  })(); }, []);
  return <View style={{ flex: 1, paddingTop: 36, gap: 16, alignItems: 'center', backgroundColor: '#FAF8F2' }}>
    <Text>{status}</Text>
    <Text>{coverReady ? 'Artwork ready' : 'Artwork missing'}</Text>
    <WidgetPreview state={preview} />
    <WidgetPreview state={preview} circle />
  </View>;
}
registerRootComponent(SmokeApp);
