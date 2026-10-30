export const circleLayout = { padding: 16, headerHeight: 28, headerGap: 4, rowHeight: 74 } as const;

export function circleViewportHeight(widgetHeight: number) {
  // The scrolling content extends all the way to the card's bottom edge.
  return Math.max(0, widgetHeight - circleLayout.padding - circleLayout.headerHeight - circleLayout.headerGap);
}
