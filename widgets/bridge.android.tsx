import React from 'react';
import { AppRegistry, NativeModules } from 'react-native';
import { getWidgetInfo, registerWidgetTaskHandler, requestWidgetUpdateById, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadListeningState, refreshListeningState } from '../services/listening';
import { ListeningWidget } from './ListeningWidget';
import { withWidgetArtwork } from '../services/widget-artwork';
import type { ListeningState } from '../services/listening-model';

const names = ['FriendListening', 'ListeningCircle'];
let renderRevision = 0;
let liveRefresh: Promise<void> | null = null;
export const widgetsAvailable = () => Boolean(NativeModules.AndroidWidget);
export function registerWidgets() {
  if (!widgetsAvailable()) return;
  registerWidgetTaskHandler(widgetTaskHandler);
  AppRegistry.registerHeadlessTask('LittleFmLiveWidgets', () => refreshLiveWidgets);
}
// The native service owns the timer: JS intervals can be suspended when the
// app is behind the launcher. Share an unfinished check across service ticks.
export function refreshLiveWidgets(): Promise<void> {
  if (liveRefresh) return liveRefresh;
  liveRefresh = (async () => {
    if (!widgetsAvailable()) return;
    const widgets = await Promise.all(names.map(name => getWidgetInfo(name)));
    if (!widgets.some(group => group.length)) return;
    await publishArtwork(await refreshListeningState());
  })().finally(() => { liveRefresh = null; });
  return liveRefresh;
}
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED' || !names.includes(props.widgetInfo.widgetName)) return;
  const circle = props.widgetInfo.widgetName === 'ListeningCircle';
  props.renderWidget(<ListeningWidget state={await withWidgetArtwork(await loadListeningState(), false)} circle={circle} height={props.widgetInfo.height} width={props.widgetInfo.width} />);
  // A resize should reflow immediately, including offline, without starting
  // another Last.fm request for every drag of a launcher resize handle.
  if (props.widgetAction === 'WIDGET_RESIZED') return;
  await publishArtwork(await refreshListeningState(), props);
}
async function renderState(state: ListeningState, origin?: WidgetTaskHandlerProps) {
  const groups = await Promise.all(names.map(async widgetName => ({ widgetName, widgets: await getWidgetInfo(widgetName) })));
  await Promise.all(groups.map(async ({ widgetName, widgets }) => {
    await Promise.all(widgets.map(info => {
      if (origin && widgetName === origin.widgetInfo.widgetName && info.widgetId === origin.widgetInfo.widgetId) {
        origin.renderWidget(<ListeningWidget state={state} circle={widgetName === 'ListeningCircle'} height={info.height} width={info.width} />);
        return Promise.resolve();
      }
      return requestWidgetUpdateById({ widgetName, widgetId: info.widgetId,
        renderWidget: current => <ListeningWidget state={state} circle={widgetName === 'ListeningCircle'} height={current.height} width={current.width} /> });
    }));
  }));
}
async function publishArtwork(state: ListeningState, origin?: WidgetTaskHandlerProps) {
  const revision = ++renderRevision;
  let painting = Promise.resolve();
  const paint = (next: ListeningState) => {
    painting = painting.catch(() => {}).then(async () => { if (revision === renderRevision) await renderState(next, origin); });
    return painting;
  };
  // Publish the new song first; one missing cover must not hold every row back.
  await paint(await withWidgetArtwork(state, false));
  const complete = await withWidgetArtwork(state, true, partial => { void paint(partial).catch(() => {}); });
  await paint(complete);
}
export async function syncWidgets() {
  if (!widgetsAvailable()) return;
  const widgets = await Promise.all(names.map(name => getWidgetInfo(name)));
  if (!widgets.some(group => group.length)) return;
  await publishArtwork(await loadListeningState());
}
