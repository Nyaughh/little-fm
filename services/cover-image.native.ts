import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Cache decoded image bytes so a widget can render without another network request.
export async function loadCoverImage(uri: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(uri, { signal });
  if (!response.ok) throw new Error('Cover unavailable');
  const blob = await response.blob();
  // Android's RN BlobModule omits type on network response blobs. Restore it
  // from the HTTP header before FileReader creates the cached image data URI.
  const mime = (blob.type || response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('image/') || !blob.size || blob.size > 2 * 1024 * 1024) throw new Error('Unsupported cover');
  const image = blob.type ? blob : blob.slice(0, blob.size, mime);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') { signal.removeEventListener('abort', cancel); reject(new Error('Invalid cover')); return; }
      const data = reader.result;
      Image.getSize(data, async (width, height) => {
        if (signal.aborted) return;
        try {
          if (width <= 1 || height <= 1 || width * height > 16777216) throw new Error('Empty or oversized cover');
          if (width <= 192 && height <= 192 && blob.size <= 64000) { resolve(data); return; }
          const size = width >= height ? { width: 192 } : { height: 192 };
          const resized = await manipulateAsync(data, [{ resize: size }], { compress: .75, format: SaveFormat.JPEG, base64: true });
          if (!resized.base64 || resized.base64.length > 90000) throw new Error('Invalid resized cover');
          if (!signal.aborted) resolve(`data:image/jpeg;base64,${resized.base64}`);
        } catch (error) { reject(error); }
        finally { signal.removeEventListener('abort', cancel); }
      }, () => { signal.removeEventListener('abort', cancel); reject(new Error('Invalid cover')); });
    };
    reader.onerror = () => { signal.removeEventListener('abort', cancel); reject(new Error('Invalid cover')); };
    const cancel = () => { reader.abort(); reject(new Error('Artwork timed out')); };
    if (signal.aborted) { reject(new Error('Artwork timed out')); return; }
    signal.addEventListener('abort', cancel, { once: true });
    reader.readAsDataURL(image);
  });
}
