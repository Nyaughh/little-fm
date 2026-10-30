import React from 'react';
import renderer from 'react-test-renderer';
import { ImageWidget, ListWidget, TextWidget } from 'react-native-android-widget';
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
