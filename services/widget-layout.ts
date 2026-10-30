export const circleLayout = { padding: 16, headerHeight: 28, headerGap: 4, rowHeight: 74 } as const;

export function circleViewportHeight(widgetHeight: number) {
  // The scrolling content extends all the way to the card's bottom edge.
  return Math.max(0, widgetHeight - circleLayout.padding - circleLayout.headerHeight - circleLayout.headerGap);
}

export function friendLayout(width: number, height: number) {
  const compact = height < 210;
  const horizontal = compact || width >= 280;
  return { horizontal, padding: compact ? 12 : 16, coverSize: compact ? 36 : 60 };
}
