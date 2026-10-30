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

// Real HTTP bytes exercise Android Blob decoding and image compression. Only
// the test build remaps this image to the runner's local, >64KB PNG fixture.
const networkFetch = global.fetch;
let fixtureTitle = 'Glue Song';
let onAutomaticFetch: (() => void) | undefined;
let onLiveFetch: ((title: string) => void) | undefined;
global.fetch = (async (input: any, options: any) => {
  const url = String(typeof input === 'string' ? input : input.url);
  if (url === 'https://widget-fixture.test/cover.png') return networkFetch('http://127.0.0.1:8788/cover.png', options);
  if (url.includes('/api/lastfm?')) {
    const method = decodeURIComponent(url.match(/[?&]method=([^&]+)/)?.[1] || '').toLowerCase();
    const image = [{ size: 'large', '#text': 'https://widget-fixture.test/cover.png' }];
    const body = method === 'user.getrecenttracks' ? { recenttracks: { track: [{ name: fixtureTitle, artist: { '#text': 'beabadoobee' }, album: { '#text': 'Glue Song' }, image, '@attr': { nowplaying: 'true' } }] } }
      : method === 'album.getinfo' ? { album: { image } } : method === 'track.getinfo' ? { track: { album: { image } } } : { albums: [] };
    if (method === 'user.getrecenttracks' && fixtureTitle === 'Automatic refresh song') onAutomaticFetch?.();
    if (method === 'user.getrecenttracks' && fixtureTitle.startsWith('Live refresh ')) onLiveFetch?.(fixtureTitle);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return networkFetch(input, options);
}) as typeof fetch;

registerWidgets();
const state: ListeningState = {
  usernames: ['mochi', 'fern', 'june', 'olive'], settings: defaultSettings,
  tracks: ['mochi', 'fern', 'june', 'olive'].map((username, index) => ({ username, checkedAt: Date.now(), currentTrack: { title: 'Glue Song', artist: 'beabadoobee', album: 'Glue Song', isNowPlaying: index === 0, playedAt: index === 0 ? undefined : Date.now() - index * 12 * 60000 } })),
};
function SmokeApp() {
  const [status, setStatus] = useState('Preparing native widgets');
  const [coverReady, setCoverReady] = useState(false);
  const [preview, setPreview] = useState(state);
  useEffect(() => {
    onAutomaticFetch = () => setStatus('Automatic refresh fetched');
    onLiveFetch = title => setStatus('Live refresh fetched ' + title);
    const automatic = DeviceEventEmitter.addListener('WIDGET_SMOKE_AUTOMATIC', () => { fixtureTitle = 'Automatic refresh song'; setStatus('Automatic check armed'); });
    // Only changes the fake upstream song. It never requests a widget update.
    const live = DeviceEventEmitter.addListener('WIDGET_SMOKE_LIVE', (title: string) => { fixtureTitle = title; setStatus('Live check armed ' + title); });
    const subscription = DeviceEventEmitter.addListener('WIDGET_SMOKE_PATTERN', async (pattern: Pattern) => {
      if (!(pattern in patterns)) return;
      fixtureTitle = 'Glue Song';
      const settings = { ...defaultSettings, pattern };
      await saveWidgetSettings(settings);
      await syncWidgets();
      setPreview({ ...state, settings });
      setStatus('Pattern ready ' + pattern);
    });
    return () => { subscription.remove(); automatic.remove(); live.remove(); onAutomaticFetch = undefined; onLiveFetch = undefined; };
  }, []);
  useEffect(() => { void (async () => {
    try {
      await saveUsernames(state.usernames);
      await saveWidgetSettings(state.settings);
      await AsyncStorage.setItem('@lastfm_tracks_v1', JSON.stringify(state.tracks));
      let cover = await resolveArtwork(state.tracks[0].currentTrack!);
      // A cold emulator can spend the first image budget initializing its
      // decoder. Exercise the normal backoff before declaring setup complete.
      for (let attempt = 0; !cover.uri && attempt < 2; attempt++) {
        await new Promise(resolve => setTimeout(resolve, Math.max(100, Math.min(15050, cover.expires - Date.now() + 50))));
        cover = await resolveArtwork(state.tracks[0].currentTrack!);
      }
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
