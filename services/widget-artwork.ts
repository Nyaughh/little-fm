import { getCachedArtwork, resolveArtwork } from './artwork';
import type { ListeningState } from './listening-model';

// Keep headless work bounded even when a large circle has many missing covers.
export async function withWidgetArtwork(state: ListeningState, network = true, onProgress?: (state: ListeningState) => void): Promise<ListeningState> {
  const tracks = state.tracks.map(row => ({ ...row, currentTrack: row.currentTrack ? { ...row.currentTrack } : null }));
  const deadline = Date.now() + 8500;
  let cursor = 0;
  let progressTimer: ReturnType<typeof setTimeout> | undefined;
  await Promise.all(Array.from({ length: Math.min(4, tracks.length) }, async () => {
    while (cursor < tracks.length) {
      const row = tracks[cursor++];
      if (!row.currentTrack) continue;
      const cached = await getCachedArtwork(row.currentTrack);
      const cover = cached?.uri ? cached : network && Date.now() < deadline ? await resolveArtwork(row.currentTrack, [], deadline - Date.now()) : undefined;
      // RemoteViews get verified image bytes; never risk a failing network image
      // breaking the whole widget. A simple music note is the final fallback.
      row.currentTrack.coverImage = cover?.uri?.startsWith('data:image') ? cover.uri : undefined;
      if (row.currentTrack.coverImage && onProgress && !progressTimer) progressTimer = setTimeout(() => {
        progressTimer = undefined;
        onProgress({ ...state, tracks: tracks.map(row => ({ ...row, currentTrack: row.currentTrack ? { ...row.currentTrack } : null })) });
      }, 150);
    }
  }));
  clearTimeout(progressTimer);
  return { ...state, tracks };
}
