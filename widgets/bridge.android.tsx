import React from 'react';
import { NativeModules } from 'react-native';
import { getWidgetInfo, registerWidgetTaskHandler, requestWidgetUpdateById, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadListeningState, refreshListeningState } from '../services/listening';
import { ListeningWidget } from './ListeningWidget';
import { withWidgetArtwork } from '../services/widget-artwork';

const names = ['FriendListening', 'ListeningCircle'];
export const widgetsAvailable = () => Boolean(NativeModules.AndroidWidget);
export function registerWidgets() {
  if (widgetsAvailable()) registerWidgetTaskHandler(widgetTaskHandler);
}
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED' || !names.includes(props.widgetInfo.widgetName)) return;
  const circle = props.widgetInfo.widgetName === 'ListeningCircle';
  props.renderWidget(<ListeningWidget state={await withWidgetArtwork(await loadListeningState(), false)} circle={circle} height={props.widgetInfo.height} width={props.widgetInfo.width} />);
  // A resize should reflow immediately, including offline, without starting
  // another Last.fm request for every drag of a launcher resize handle.
  if (props.widgetAction === 'WIDGET_RESIZED') return;
  const state = await withWidgetArtwork(await refreshListeningState());
  props.renderWidget(<ListeningWidget state={state} circle={circle} height={props.widgetInfo.height} width={props.widgetInfo.width} />);
}
export async function syncWidgets() {
  if (!widgetsAvailable()) return;
  const groups = await Promise.all(names.map(async widgetName => ({ widgetName, widgets: await getWidgetInfo(widgetName) })));
  if (!groups.some(group => group.widgets.length)) return;
  const state = await withWidgetArtwork(await loadListeningState());
  await Promise.all(groups.map(async ({ widgetName, widgets }) => {
    await Promise.all(widgets.map(({ widgetId }) => requestWidgetUpdateById({
      widgetName, widgetId,
      renderWidget: info => <ListeningWidget state={state} circle={widgetName === 'ListeningCircle'} height={info.height} width={info.width} />,
    })));
  }));
}
