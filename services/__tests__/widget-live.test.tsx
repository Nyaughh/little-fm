import { AppRegistry, NativeModules } from 'react-native';
import { getWidgetInfo, registerWidgetTaskHandler, requestWidgetUpdateById } from 'react-native-android-widget';
import { refreshLiveWidgets, registerWidgets } from '../../widgets/bridge.android';
import { refreshListeningState } from '../listening';
import { defaultSettings } from '../listening-model';

jest.mock('../listening', () => ({ loadListeningState: jest.fn(), refreshListeningState: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../widget-artwork', () => ({ withWidgetArtwork: jest.fn(state => Promise.resolve(state)) }));
jest.mock('../../widgets/ListeningWidget', () => ({ ListeningWidget: () => null }));
jest.mock('react-native-android-widget', () => ({ registerWidgetTaskHandler: jest.fn(), getWidgetInfo: jest.fn(), requestWidgetUpdateById: jest.fn() }));

const originalWidgetModule = NativeModules.AndroidWidget;
const state = { usernames: ['mochi'], tracks: [{ username: 'mochi', currentTrack: { title: 'Fresh song', artist: 'Artist', isNowPlaying: true } }], settings: defaultSettings };

beforeEach(() => {
  jest.clearAllMocks();
  NativeModules.AndroidWidget = {};
  (getWidgetInfo as jest.Mock).mockImplementation(name => Promise.resolve([
    { widgetId: name === 'FriendListening' ? 3 : 7, width: 210, height: 140 },
  ]));
  (refreshListeningState as jest.Mock).mockResolvedValue(state);
  (requestWidgetUpdateById as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); NativeModules.AndroidWidget = originalWidgetModule; });

test('registers the native live updater independently of the app screen', () => {
  const register = jest.spyOn(AppRegistry, 'registerHeadlessTask').mockImplementation(() => {});
  registerWidgets();
  expect(registerWidgetTaskHandler).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith('LittleFmLiveWidgets', expect.any(Function));
  expect(register.mock.calls[0][1]()).toBe(refreshLiveWidgets);
});

test('each live check fetches the latest songs and redraws both placed widget sizes', async () => {
  await refreshLiveWidgets();
  expect(refreshListeningState).toHaveBeenCalledTimes(1);
  for (const [widgetName, widgetId] of [['FriendListening', 3], ['ListeningCircle', 7]]) {
    const request = (requestWidgetUpdateById as jest.Mock).mock.calls.find(([value]) => value.widgetId === widgetId)?.[0];
    expect(request).toMatchObject({ widgetName, widgetId });
    expect(request.renderWidget({ width: 316, height: 238 }).props).toMatchObject({ state, width: 316, height: 238, circle: widgetName === 'ListeningCircle' });
  }
});

test('overlapping live ticks share the same unfinished request', async () => {
  let finish!: (value: typeof state) => void;
  (refreshListeningState as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = refreshLiveWidgets();
  const second = refreshLiveWidgets();
  expect(second).toBe(first);
  for (let step = 0; step < 10 && !finish; step++) await Promise.resolve();
  expect(refreshListeningState).toHaveBeenCalledTimes(1);
  finish(state);
  await Promise.all([first, second]);
  await refreshLiveWidgets();
  expect(refreshListeningState).toHaveBeenCalledTimes(2);
});

test('a failed check does not prevent the following tick from trying again', async () => {
  (refreshListeningState as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(refreshLiveWidgets()).rejects.toThrow('storage unavailable');
  await refreshLiveWidgets();
  expect(refreshListeningState).toHaveBeenCalledTimes(2);
  expect(requestWidgetUpdateById).toHaveBeenCalled();
});

test('does not fetch after the last widget is removed', async () => {
  (getWidgetInfo as jest.Mock).mockResolvedValue([]);
  await refreshLiveWidgets();
  expect(refreshListeningState).not.toHaveBeenCalled();
  expect(requestWidgetUpdateById).not.toHaveBeenCalled();
});

test('does not register or fetch when Android widgets are unavailable', async () => {
  NativeModules.AndroidWidget = undefined;
  const register = jest.spyOn(AppRegistry, 'registerHeadlessTask').mockImplementation(() => {});
  registerWidgets();
  await refreshLiveWidgets();
  expect(register).not.toHaveBeenCalled();
  expect(registerWidgetTaskHandler).not.toHaveBeenCalled();
  expect(getWidgetInfo).not.toHaveBeenCalled();
  expect(refreshListeningState).not.toHaveBeenCalled();
});
