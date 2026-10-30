import React from 'react';
import { getWidgetInfo } from 'react-native-android-widget';
import { widgetTaskHandler } from '../../widgets/bridge.android';
import { loadListeningState, refreshListeningState } from '../listening';
import { withWidgetArtwork } from '../widget-artwork';
import { defaultSettings } from '../listening-model';

jest.mock('../listening', () => ({ loadListeningState: jest.fn(), refreshListeningState: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../widget-artwork', () => ({ withWidgetArtwork: jest.fn(state => Promise.resolve(state)) }));
jest.mock('../../widgets/ListeningWidget', () => ({ ListeningWidget: () => null }));
jest.mock('react-native-android-widget', () => ({ registerWidgetTaskHandler: jest.fn(), getWidgetInfo: jest.fn(), requestWidgetUpdateById: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test.each(['FriendListening', 'ListeningCircle'])('resizing an already placed %s renders its saved data at the new size without a network request', async widgetName => {
  const state = { usernames: ['mochi'], tracks: [], settings: defaultSettings };
  (loadListeningState as jest.Mock).mockResolvedValue(state);
  const renderWidget = jest.fn();
  await widgetTaskHandler({ widgetAction: 'WIDGET_RESIZED', widgetInfo: { widgetName, width: 210, height: 140 }, renderWidget } as any);
  expect(renderWidget).toHaveBeenCalledTimes(1);
  expect((renderWidget.mock.calls[0][0] as React.ReactElement).props).toMatchObject({ width: 210, height: 140, state, circle: widgetName === 'ListeningCircle' });
  expect(withWidgetArtwork).toHaveBeenCalledWith(state, false);
  expect(refreshListeningState).not.toHaveBeenCalled();
});

test('a slow refresh uses the latest placed size instead of restoring the layout from before a resize', async () => {
  const state = { usernames: ['mochi'], tracks: [], settings: defaultSettings };
  (loadListeningState as jest.Mock).mockResolvedValue(state);
  (refreshListeningState as jest.Mock).mockResolvedValue(state);
  (getWidgetInfo as jest.Mock).mockResolvedValue([{ widgetId: 5, width: 210, height: 140 }]);
  const renderWidget = jest.fn();
  await widgetTaskHandler({ widgetAction: 'WIDGET_UPDATE', widgetInfo: { widgetName: 'ListeningCircle', widgetId: 5, width: 316, height: 238 }, renderWidget } as any);
  expect(renderWidget.mock.calls.map(([element]) => ({ width: element.props.width, height: element.props.height }))).toEqual([{ width: 316, height: 238 }, { width: 210, height: 140 }, { width: 210, height: 140 }]);
  (getWidgetInfo as jest.Mock).mockResolvedValue([]);
  renderWidget.mockClear();
  await widgetTaskHandler({ widgetAction: 'WIDGET_UPDATE', widgetInfo: { widgetName: 'ListeningCircle', widgetId: 5, width: 316, height: 238 }, renderWidget } as any);
  expect(renderWidget).toHaveBeenCalledTimes(1);
});

test('new songs reach the widget before a delayed artwork lookup finishes', async () => {
  const state = { usernames: ['mochi'], tracks: [], settings: defaultSettings };
  const fresh = { ...state, tracks: [{ username: 'mochi', currentTrack: { title: 'New song', artist: 'Artist', isNowPlaying: true } }] };
  (loadListeningState as jest.Mock).mockResolvedValue(state);
  (refreshListeningState as jest.Mock).mockResolvedValue(fresh);
  (getWidgetInfo as jest.Mock).mockImplementation(name => Promise.resolve(name === 'ListeningCircle' ? [{ widgetId: 5, width: 316, height: 238 }] : []));
  let finishArtwork!: () => void;
  (withWidgetArtwork as jest.Mock).mockImplementation((next, network) => network
    ? new Promise(resolve => { finishArtwork = () => resolve(next); }) : Promise.resolve(next));
  const renderWidget = jest.fn();
  const task = widgetTaskHandler({ widgetAction: 'WIDGET_UPDATE', widgetInfo: { widgetName: 'ListeningCircle', widgetId: 5, width: 316, height: 238 }, renderWidget } as any);
  for (let step = 0; step < 20 && !finishArtwork; step++) await Promise.resolve();
  expect(renderWidget.mock.calls.some(([element]) => element.props.state.tracks[0]?.currentTrack.title === 'New song')).toBe(true);
  finishArtwork();
  await task;
  (withWidgetArtwork as jest.Mock).mockImplementation(next => Promise.resolve(next));
});

test('generated widget resize minimums survive prebuild and match the native resources', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { withMinimums, minimums } = require('../../scripts/with-widget-min-sizes.cjs');
  for (const [name, size] of Object.entries(minimums) as [string, { width: number; height: number }][]) {
    const file = path.join(__dirname, '../../android/app/src/main/res/xml', `widgetprovider_${name}.xml`);
    const xml = fs.readFileSync(file, 'utf8');
    const generated = withMinimums('<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minResizeWidth="999dp" />', size);
    expect(generated).toContain(`android:minResizeWidth="${size.width}dp"`);
    expect(generated).toContain(`android:minResizeHeight="${size.height}dp"`);
    expect(withMinimums(generated, size)).toBe(generated);
    expect(xml).toContain(`android:minResizeWidth="${size.width}dp"`);
    expect(xml).toContain(`android:minResizeHeight="${size.height}dp"`);
    expect(xml).toContain('android:resizeMode="horizontal|vertical"');
  }
});
