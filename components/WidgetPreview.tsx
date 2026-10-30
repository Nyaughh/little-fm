import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { tones, widgetRows, widgetStatusLabel, type ListeningState } from '../services/listening-model';
import { AlbumCover } from './AlbumCover';
import { widgetTexture } from './doodles';
import { circleLayout, circleViewportHeight } from '../services/widget-layout';

export function WidgetPreview({ state, circle = false, onRefresh, maxWidth = 316 }: { state: ListeningState; circle?: boolean; onRefresh?: () => void; maxWidth?: number }) {
  const palette = tones[state.settings.tone];
  const rows = widgetRows(state, circle);
  const width = circle ? Math.min(316, maxWidth) : 184;
  const height = 238;
  const rowCards = rows.map(row => <View key={row.username} style={{ height: circle ? circleLayout.rowHeight : undefined, flexShrink: 0, flexDirection: circle ? 'row' : 'column', gap: circle ? 12 : 10, alignItems: circle ? 'center' : 'flex-start', paddingVertical: circle ? 8 : 0 }}>
    <AlbumCover track={row.currentTrack} size={circle ? 46 : 66} radius={circle ? 9 : 12} />
    <View style={{ ...(circle ? { flex: 1 } : { width: '100%' }), gap: 4 }}>
      <Text numberOfLines={circle ? 1 : 2} style={{ color: palette.ink, fontSize: circle ? 13 : 16, fontWeight: '600', letterSpacing: -.2 }}>{row.currentTrack?.title || (row.error ? 'Could not load' : 'Quiet for now')}</Text>
      <Text numberOfLines={1} style={{ color: palette.muted, fontSize: 11 }}>{row.currentTrack?.artist || 'No recent songs'}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text numberOfLines={1} style={{ color: palette.accent, fontSize: 10, flexShrink: 1 }}>{row.username}</Text>
        <Text numberOfLines={1} style={{ color: palette.muted, fontSize: 10, marginLeft: 6 }}>{widgetStatusLabel(row)}</Text>
      </View>
    </View>
  </View>);
  return <View style={{ width, height, borderRadius: 24, overflow: 'hidden', backgroundColor: palette.background }}>
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}><SvgXml xml={widgetTexture(width, height, palette.ink, palette.background, state.settings.pattern, circle)} width={width} height={height} /></View>
    <View style={{ flex: 1, paddingTop: circleLayout.padding, paddingHorizontal: circleLayout.padding, paddingBottom: circle ? 0 : circleLayout.padding }}>
      <View style={{ height: circle ? circleLayout.headerHeight : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: circle ? circleLayout.headerGap : 12 }}>
        <Text style={{ color: palette.ink, fontSize: 12, fontWeight: '700' }}>{circle ? 'listening circle' : 'a little listening'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh widget" onPress={onRefresh} hitSlop={8}><Text style={{ color: palette.accent, fontSize: 21 }}>↻</Text></Pressable>
      </View>
      {circle ? <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ height: circleViewportHeight(height), flexShrink: 0 }}>{rowCards}</ScrollView> : rowCards}
    </View>
  </View>;
}
