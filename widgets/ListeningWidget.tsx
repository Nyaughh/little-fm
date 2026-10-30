import React from 'react';
import { FlexWidget, ImageWidget, ListWidget, OverlapWidget, SvgWidget, TextWidget, type ImageWidgetSource } from 'react-native-android-widget';
import { tones, widgetRows, widgetStatusLabel, type ListeningState } from '../services/listening-model';
import { coverFallbackSvg, widgetTexture } from '../components/doodles';
import { circleLayout, circleViewportHeight, friendLayout } from '../services/widget-layout';

export function ListeningWidget({ state, circle = false, height = 238, width = 316 }: { state: ListeningState; circle?: boolean; height?: number; width?: number }) {
  const palette = tones[state.settings.tone];
  const rows = widgetRows(state, circle);
  const layout = friendLayout(width, height);
  const horizontal = circle || layout.horizontal;
  const padding = circle ? circleLayout.padding : layout.padding;
  const cover = (uri: string | undefined, size: number) => uri
    ? <ImageWidget image={uri as ImageWidgetSource} imageWidth={size} imageHeight={size} radius={9} style={{ width: size, height: size }} />
    : <SvgWidget svg={coverFallbackSvg(palette.muted, palette.background)} style={{ width: size, height: size }} />;
  const cards = rows.map(row => (
    <FlexWidget key={row.username} clickAction="OPEN_APP" style={{ width: 'match_parent', height: circle ? circleLayout.rowHeight : 'wrap_content', flexDirection: horizontal ? 'row' : 'column', alignItems: horizontal ? 'center' : 'flex-start', paddingVertical: circle ? 8 : 0 }}>
      {cover(row.currentTrack?.coverImage, circle ? 46 : layout.coverSize)}
      <FlexWidget style={{ ...(horizontal ? { flex: 1, width: 0 } : { width: 'match_parent' as const }), marginLeft: circle ? 12 : horizontal ? 10 : 0, marginTop: horizontal ? 0 : 10 }}>
        <TextWidget text={row.currentTrack?.title || (row.error ? 'Could not load' : 'Quiet for now')} style={{ fontSize: circle ? 13 : 15, color: palette.ink, fontWeight: 'bold' }} maxLines={circle ? 1 : 2} truncate="END" />
        <TextWidget text={row.currentTrack?.artist || 'No recent songs'} style={{ fontSize: 11, color: palette.muted, marginTop: 3 }} maxLines={1} truncate="END" />
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <FlexWidget style={{ flex: 1, width: 0 }}><TextWidget text={row.username} style={{ width: 'match_parent', fontSize: 10, color: palette.accent }} maxLines={1} truncate="END" /></FlexWidget>
          <TextWidget text={` · ${widgetStatusLabel(row, Date.now(), !circle && height < 210)}`} style={{ fontSize: 10, color: palette.muted }} maxLines={1} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  ));
  return <OverlapWidget style={{ width: 'match_parent', height: 'match_parent', borderRadius: 24, overflow: 'hidden', backgroundColor: palette.background }}>
    <SvgWidget svg={widgetTexture(width, height, palette.ink, palette.background, state.settings.pattern, circle)} style={{ width, height }} />
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', paddingTop: padding, paddingHorizontal: padding, paddingBottom: circle ? 0 : padding }}>
      <FlexWidget style={{ height: circle ? circleLayout.headerHeight : 'wrap_content', flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'center', marginBottom: circle ? circleLayout.headerGap : 12 }}>
        <FlexWidget style={{ flex: 1, width: 0 }}><TextWidget clickAction="OPEN_APP" text={circle ? 'listening circle' : 'a little listening'} style={{ width: 'match_parent', fontSize: 12, color: palette.ink, fontWeight: 'bold' }} maxLines={1} truncate="END" /></FlexWidget>
        <TextWidget text="↻" clickAction="REFRESH" style={{ fontSize: 21, color: palette.accent, paddingLeft: 8, paddingRight: 4 }} />
      </FlexWidget>
      {rows.length === 0 ? <TextWidget clickAction="OPEN_APP" text="Add a friend in the app. A little music will find its way here." style={{ color: palette.muted, fontSize: 13 }} maxLines={4} />
        : circle ? <ListWidget style={{ width: 'match_parent', height: circleViewportHeight(height) }}>{cards}</ListWidget> : cards}
    </FlexWidget>
  </OverlapWidget>;
}
