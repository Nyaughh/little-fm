// Included only by -PlittleFmNativeTest. Never part of the release entry.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgets, syncWidgets } from '../widgets/bridge';
import { WidgetPreview } from '../components/WidgetPreview';
import { defaultSettings, type ListeningState } from '../services/listening-model';
import { saveUsernames, saveWidgetSettings } from '../services/listening';
import { resolveArtwork } from '../services/artwork';

registerWidgets();
const state: ListeningState = {
  usernames: ['mochi', 'fern', 'june', 'olive'], settings: defaultSettings,
  tracks: ['mochi', 'fern', 'june', 'olive'].map(username => ({ username, currentTrack: { title: 'Glue Song', artist: 'beabadoobee', album: 'Glue Song', isNowPlaying: false } })),
};
function SmokeApp() {
  const [status, setStatus] = useState('Preparing native widgets');
  useEffect(() => { void (async () => {
    try {
      await saveUsernames(state.usernames);
      await saveWidgetSettings(state.settings);
      await AsyncStorage.setItem('@lastfm_tracks_v1', JSON.stringify(state.tracks));
      const cover = await resolveArtwork(state.tracks[0].currentTrack!);
      if (!cover.uri?.startsWith('data:image')) throw new Error('Android artwork decoding failed');
      await syncWidgets();
      setStatus('Native artwork ready');
    } catch (error) { setStatus('FAILED: ' + (error instanceof Error ? error.message : 'unknown')); }
  })(); }, []);
  return <View style={{ flex: 1, paddingTop: 36, gap: 16, alignItems: 'center', backgroundColor: '#FAF8F2' }}>
    <Text>{status}</Text>
    <WidgetPreview state={state} />
    <WidgetPreview state={state} circle />
  </View>;
}
registerRootComponent(SmokeApp);
