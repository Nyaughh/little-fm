import { Image } from 'react-native';

// Cache decoded image bytes so a widget can render without another network request.
export async function loadCoverImage(uri: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(uri, { signal });
  if (!response.ok) throw new Error('Cover unavailable');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || !blob.size || blob.size > 64000) throw new Error('Unsupported cover');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') { signal.removeEventListener('abort', cancel); reject(new Error('Invalid cover')); return; }
      const data = reader.result;
      Image.getSize(data, (width, height) => {
        signal.removeEventListener('abort', cancel);
        if (width > 1 && height > 1) resolve(data); else reject(new Error('Empty cover'));
      }, () => { signal.removeEventListener('abort', cancel); reject(new Error('Invalid cover')); });
    };
    reader.onerror = () => { signal.removeEventListener('abort', cancel); reject(new Error('Invalid cover')); };
    const cancel = () => { reader.abort(); reject(new Error('Artwork timed out')); };
    if (signal.aborted) { reject(new Error('Artwork timed out')); return; }
    signal.addEventListener('abort', cancel, { once: true });
    reader.readAsDataURL(blob);
  });
}
