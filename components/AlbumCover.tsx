import React, { useEffect, useState } from 'react';
import { AppState, Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { immediateArtwork, resolveArtwork } from '../services/artwork';
import type { CurrentTrack } from '../types/lastfm';
import { coverFallbackSvg } from './doodles';

export function AlbumCover({ track, size = 48, radius = 10, refreshKey }: { track: CurrentTrack | null; size?: number; radius?: number; refreshKey?: number }) {
  const identity = [track?.artist, track?.album, track?.title, track?.image, ...(track?.imageCandidates || [])].join('|');
  const [cover, setCover] = useState(() => ({ identity, uri: immediateArtwork(track) }));
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const uri = cover.identity === identity ? cover.uri : immediateArtwork(track);
  useEffect(() => { setCover({ identity, uri: immediateArtwork(track) }); setRetry(0); setFailed([]); }, [identity]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setRetry(value => value + 1); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (track) void resolveArtwork(track, failed).then(result => {
      if (!active) return;
      // A late response for a previous song cannot replace the current cover.
      if (result.uri) setCover({ identity, uri: result.uri });
      else timer = setTimeout(() => { if (active && AppState.currentState === 'active') setRetry(value => value + 1); }, Math.max(500, result.expires - Date.now()));
    });
    return () => { active = false; clearTimeout(timer); };
  }, [identity, retry, refreshKey]);
  return <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#EEE9DD', flexShrink: 0 }}>
    {uri ? <Image accessibilityLabel={`Cover for ${track?.album || track?.title}`} source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" onError={() => {
      setCover({ identity, uri: undefined });
      if (failed.length < 3) { setFailed(previous => [...previous, uri]); setRetry(previous => previous + 1); }
    }} /> : <SvgXml xml={coverFallbackSvg()} width={size} height={size} />}
  </View>;
}
