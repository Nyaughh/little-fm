import React from 'react';
import { widgetTaskHandler } from '../../widgets/bridge.android';
import { loadListeningState, refreshListeningState } from '../listening';
import { withWidgetArtwork } from '../widget-artwork';
import { defaultSettings } from '../listening-model';

jest.mock('../listening', () => ({ loadListeningState: jest.fn(), refreshListeningState: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../widget-artwork', () => ({ withWidgetArtwork: jest.fn(state => Promise.resolve(state)) }));
jest.mock('../../widgets/ListeningWidget', () => ({ ListeningWidget: () => null }));
jest.mock('react-native-android-widget', () => ({ registerWidgetTaskHandler: jest.fn() }));

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
