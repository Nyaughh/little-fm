import React from 'react';
import renderer from 'react-test-renderer';
import { FlexWidget, ImageWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { ListeningWidget } from '../../widgets/ListeningWidget';
import { defaultSettings } from '../../services/listening-model';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const usernames = ['one', 'two', 'three', 'four', 'five', 'six'];
const state = {
  usernames, settings: defaultSettings,
  tracks: usernames.map(username => ({ username, currentTrack: { title: username + ' song', artist: 'Artist', isNowPlaying: false, coverImage: 'data:image/png;base64,valid' } })),
};
test('the Android circle is a native scrolling list containing every friend', () => {
  const tree = renderer.create(<ListeningWidget state={state} circle />);
  const list = tree.root.findByType(ListWidget);
  expect(list.props.children).toHaveLength(6);
  expect(tree.root.findAllByType(ImageWidget)).toHaveLength(6);
  expect(tree.root.findAllByType(TextWidget).some(node => node.props.text.includes('Tap refresh'))).toBe(false);
  tree.unmount();
});
test('the small widget uses the selected friend and does not render refresh instructions', () => {
  const tree = renderer.create(<ListeningWidget state={{ ...state, settings: { ...defaultSettings, friend: 'four' } }} />);
  expect(tree.root.findAllByType(ListWidget)).toHaveLength(0);
  expect(tree.root.findAllByType(ImageWidget)).toHaveLength(1);
  expect(tree.root.findAllByType(TextWidget).some(node => node.props.text === 'four song')).toBe(true);
  tree.unmount();
});

test.each([[238, 190], [280, 232], [340, 292]])('the %s-high circle fills the card down to its bottom border', (height, viewportHeight) => {
  const tree = renderer.create(<ListeningWidget state={state} circle height={height} />);
  const list = tree.root.findByType(ListWidget);
  expect(list.props.style.height).toBe(viewportHeight);
  expect(list.parent?.props.style.paddingBottom).toBe(0);
  expect(list.props.children).toHaveLength(6);
  expect(list.props.children.every((row: React.ReactElement) => row.props.style.height === 74)).toBe(true);
  tree.unmount();
});

test.each([[150, 140], [316, 140], [400, 340]])('the resized %s-by-%s single widget reflows the cover beside the text', (width, height) => {
  const tree = renderer.create(<ListeningWidget state={state} width={width} height={height} />);
  const cover = tree.root.findByType(ImageWidget);
  expect(cover.parent?.type).toBe(FlexWidget);
  expect(cover.parent?.props.style.flexDirection).toBe('row');
  expect(cover.props.imageHeight).toBe(height < 210 ? 36 : 60);
  tree.unmount();
});

test('a tall narrow single widget keeps the artwork above the text', () => {
  const tree = renderer.create(<ListeningWidget state={state} width={184} height={340} />);
  expect(tree.root.findByType(ImageWidget).parent?.props.style.flexDirection).toBe('column');
  tree.unmount();
});

test('status shares the username line and stays visible for a long username', () => {
  const username = 'averylonglastfmusername';
  const tree = renderer.create(<ListeningWidget state={{ ...state, usernames: [username], tracks: [{ ...state.tracks[0], username, currentTrack: { ...state.tracks[0].currentTrack, playedAt: Date.now() - 12 * 60000 } }] }} />);
  const name = tree.root.findAllByType(TextWidget).find(node => node.props.text === username)!;
  expect(name.props.truncate).toBe('END');
  expect(name.parent?.parent?.findAllByType(TextWidget).map(node => node.props.text)).toEqual([username, ' · 12m ago']);
  tree.unmount();
});
