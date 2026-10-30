import React from 'react';
import { AppState, Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { AlbumCover } from '../AlbumCover';
import { resolveArtwork } from '../../services/artwork';
jest.mock('../../services/artwork', () => ({ immediateArtwork: (track: any) => track?.image, resolveArtwork: jest.fn() }));
jest.mock('react-native-svg', () => ({ SvgXml: () => null }));
const track = { title: 'Song', artist: 'Artist', isNowPlaying: false, image: 'https://cover.test/direct.jpg' };
const appState = AppState.currentState;
beforeEach(() => { jest.useFakeTimers(); AppState.currentState = 'active'; (resolveArtwork as jest.Mock).mockReset(); });
afterEach(() => { jest.useRealTimers(); AppState.currentState = appState; });

test('the supplied image is rendered immediately without waiting for metadata or cache work', async () => {
  (resolveArtwork as jest.Mock).mockReturnValue(new Promise(() => {}));
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<AlbumCover track={track} />); });
  expect(tree.root.findByType(Image).props.source.uri).toBe(track.image);
  act(() => tree.unmount());
});

test('a failed lookup automatically retries when its short backoff expires', async () => {
  (resolveArtwork as jest.Mock).mockResolvedValueOnce({ expires: Date.now() + 5000 }).mockResolvedValueOnce({ uri: 'https://cover.test/retried.jpg' });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<AlbumCover track={{ ...track, image: undefined }} />); });
  await act(async () => { jest.advanceTimersByTime(5001); });
  expect(resolveArtwork).toHaveBeenCalledTimes(2);
  expect(tree.root.findByType(Image).props.source.uri).toContain('retried');
  act(() => tree.unmount());
});

test('a late cover for the previous song cannot overwrite the new song image', async () => {
  let finishOld!: (value: any) => void;
  (resolveArtwork as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({ uri: 'https://cover.test/new.jpg' });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<AlbumCover track={track} />); });
  await act(async () => { tree.update(<AlbumCover track={{ ...track, title: 'New song', image: 'https://cover.test/new.jpg' }} />); });
  await act(async () => { finishOld({ uri: 'https://cover.test/old.jpg' }); });
  expect(tree.root.findByType(Image).props.source.uri).toContain('new.jpg');
  act(() => tree.unmount());
});
