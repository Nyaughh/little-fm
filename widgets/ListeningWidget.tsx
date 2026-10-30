import React from 'react';
import { FlexWidget, ImageWidget, ListWidget, OverlapWidget, SvgWidget, TextWidget, type ImageWidgetSource } from 'react-native-android-widget';
import { tones, widgetRows, type ListeningState } from '../services/listening-model';
import { coverFallbackSvg, widgetTexture } from '../components/doodles';
import { circleLayout, circleViewportHeight } from '../services/widget-layout';

export function ListeningWidget({ state, circle = false, height = 238, width = 316 }: { state: ListeningState; circle?: boolean; height?: number; width?: number }) {
  const palette = tones[state.settings.tone];
  const rows = widgetRows(state, circle);
  const cover = (uri: string | undefined, size: number) => uri
    ? <ImageWidget image={uri as ImageWidgetSource} imageWidth={size} imageHeight={size} radius={9} style={{ width: size, height: size }} />
    : <SvgWidget svg={coverFallbackSvg(palette.muted, palette.background)} style={{ width: size, height: size }} />;
  const cards = rows.map(row => (
    <FlexWidget key={row.username} clickAction="OPEN_APP" style={{ width: 'match_parent', height: circle ? circleLayout.rowHeight : 'wrap_content', flexDirection: circle ? 'row' : 'column', alignItems: circle ? 'center' : 'flex-start', paddingVertical: circle ? 8 : 0 }}>
      {cover(row.currentTrack?.coverImage, circle ? 46 : 60)}
      <FlexWidget style={{ ...(circle ? { flex: 1, width: 0 } : { width: 'match_parent' as const }), marginLeft: circle ? 12 : 0, marginTop: circle ? 0 : 10 }}>
        <TextWidget text={row.currentTrack?.title || (row.error ? 'Could not load' : 'Quiet for now')} style={{ fontSize: circle ? 13 : 15, color: palette.ink, fontWeight: 'bold' }} maxLines={circle ? 1 : 2} truncate="END" />
        <TextWidget text={row.currentTrack?.artist || 'No recent songs'} style={{ fontSize: 11, color: palette.muted, marginTop: 3 }} maxLines={1} truncate="END" />
        <TextWidget text={row.username + (row.error ? ' · offline' : '')} style={{ fontSize: 10, color: palette.accent, marginTop: 4 }} maxLines={1} truncate="END" />
      </FlexWidget>
    </FlexWidget>
  ));
  return <OverlapWidget style={{ width: 'match_parent', height: 'match_parent', borderRadius: 24, overflow: 'hidden', backgroundColor: palette.background }}>
    <SvgWidget svg={widgetTexture(width, height, palette.ink, palette.background, state.settings.pattern, circle)} style={{ width, height }} />
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', paddingTop: circleLayout.padding, paddingHorizontal: circleLayout.padding, paddingBottom: circle ? 0 : circleLayout.padding }}>
      <FlexWidget style={{ height: circle ? circleLayout.headerHeight : 'wrap_content', flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'center', marginBottom: circle ? circleLayout.headerGap : 12 }}>
        <TextWidget clickAction="OPEN_APP" text={circle ? 'listening circle' : 'a little listening'} style={{ fontSize: 12, color: palette.ink, fontWeight: 'bold' }} maxLines={1} />
        <TextWidget text="↻" clickAction="REFRESH" style={{ fontSize: 21, color: palette.accent, paddingLeft: 8, paddingRight: 4 }} />
      </FlexWidget>
      {rows.length === 0 ? <TextWidget clickAction="OPEN_APP" text="Add a friend in the app. A little music will find its way here." style={{ color: palette.muted, fontSize: 13 }} maxLines={4} />
        : circle ? <ListWidget style={{ width: 'match_parent', height: circleViewportHeight(height) }}>{cards}</ListWidget> : cards}
    </FlexWidget>
  </OverlapWidget>;
}
