import { Image } from 'react-native';
import { loadCoverImage } from '../cover-image.native';

const originalReader = global.FileReader;
const read = jest.fn();
beforeEach(() => {
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => { success?.(174, 174); });
  global.FileReader = class {
    result = 'data:image/jpeg;base64,VALID';
    onload?: () => void;
    readAsDataURL(blob: Blob) { read(blob); this.onload?.(); }
    abort() {}
  } as unknown as typeof FileReader;
});
afterEach(() => { global.FileReader = originalReader; jest.restoreAllMocks(); read.mockClear(); });

test('Android network blobs with no type use the response MIME type and produce a widget-safe data URI', async () => {
  const typed = { type: 'image/jpeg', size: 7000 };
  const blob = { type: '', size: 7000, slice: jest.fn(() => typed) };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => 'image/jpeg; charset=binary' }, blob: async () => blob });
  expect(await loadCoverImage('https://cover.test/album.jpg', new AbortController().signal)).toBe('data:image/jpeg;base64,VALID');
  expect(blob.slice).toHaveBeenCalledWith(0, 7000, 'image/jpeg');
  expect(read).toHaveBeenCalledWith(typed);
});

test('a non-image response is rejected before it can reach the Android widget renderer', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => 'text/html' }, blob: async () => ({ type: '', size: 900 }) });
  await expect(loadCoverImage('https://cover.test/missing.jpg', new AbortController().signal)).rejects.toThrow('Unsupported cover');
  expect(read).not.toHaveBeenCalled();
});
