import { Image } from 'react-native';

// The browser can decode cross-origin covers even when their CDN forbids fetch().
export function loadCoverImage(uri: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Artwork timed out')); return; }
    const cancel = () => { cleanup(); reject(new Error('Artwork timed out')); };
    const cleanup = () => signal.removeEventListener('abort', cancel);
    signal.addEventListener('abort', cancel, { once: true });
    Image.getSize(uri, (width, height) => {
      cleanup();
      if (width > 1 && height > 1) resolve(uri); else reject(new Error('Empty cover'));
    }, () => { cleanup(); reject(new Error('Cover unavailable')); });
  });
}
