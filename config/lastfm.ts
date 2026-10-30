import Constants from 'expo-constants';

const LISTENING_API_URL: string = Constants.expoConfig?.extra?.listeningApiUrl ?? '';
type ReadMethod = 'user.getrecenttracks' | 'album.getInfo' | 'track.getInfo' | 'album.search';
export const getLastFmApiUrl = (method: ReadMethod, fields: Record<string, string>) => {
  const localDevelopment = typeof __DEV__ !== 'undefined' && __DEV__ && /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?\//.test(LISTENING_API_URL);
  if (!LISTENING_API_URL.startsWith('https://') && !localDevelopment) throw new Error('The listening service is not configured. Please update the app.');
  const params = new URLSearchParams({ method, ...fields });
  return `${LISTENING_API_URL}?${params.toString()}`;
};
