import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { resolveArtwork } from '../services/artwork';
import type { CurrentTrack } from '../types/lastfm';
import { coverFallbackSvg } from './doodles';

export function AlbumCover({ track, size = 48, radius = 10 }: { track: CurrentTrack | null; size?: number; radius?: number }) {
  const [uri, setUri] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const identity = [track?.artist, track?.album, track?.title, track?.image].join('|');
  useEffect(() => { setUri(undefined); setRetry(0); setFailed([]); }, [identity]);
  useEffect(() => {
    let active = true;
    if (track) void resolveArtwork(track, failed).then(cover => { if (active) setUri(cover.uri); });
    return () => { active = false; };
  }, [identity, retry]);
  return <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#EEE9DD', flexShrink: 0 }}>
    {uri ? <Image accessibilityLabel={`Cover for ${track?.album || track?.title}`} source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" onError={() => {
      setUri(undefined);
      if (retry < 2) { setFailed(previous => [...previous, uri]); setRetry(previous => previous + 1); }
    }} /> : <SvgXml xml={coverFallbackSvg()} width={size} height={size} />}
  </View>;
}
