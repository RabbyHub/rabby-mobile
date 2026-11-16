import { StyleSheet } from 'react-native';

// The patched library has no types for its internal style module.
const styleGenerator: (props: Record<string, unknown>) => {
  containerStyle: unknown;
  backgroundStyle: unknown;
  revealStyle: unknown;
} = require('react-native-walkthrough-tooltip/src/styles').default;

function generate(measured: boolean) {
  const styles = styleGenerator({
    adjustedContentSize: measured
      ? { width: 120, height: 40 }
      : { width: 0, height: 0 },
    anchorPoint: { x: 0, y: 0 },
    arrowSize: { width: 16, height: 8 },
    displayInsets: { top: 24, bottom: 24, left: 24, right: 24 },
    measurementsFinished: measured,
    ownProps: { backgroundColor: 'transparent', contentStyle: {} },
    placement: 'top',
    tooltipOrigin: { x: 0, y: 0 },
    topAdjustment: 0,
  });

  return {
    container: StyleSheet.flatten(styles.containerStyle as object) as {
      opacity?: number;
    },
    background: StyleSheet.flatten(styles.backgroundStyle as object) as {
      opacity?: number;
    },
  };
}

// iOS skips views with alpha < 0.01 during hit testing. The tooltip container
// carries the "tap outside to close" handler, so hiding it made a tooltip that
// never measured (for example empty content) an invisible, unclosable Modal.
describe('react-native-walkthrough-tooltip patch', () => {
  it('keeps the tap-to-close container hit-testable before measurement', () => {
    const { container, background } = generate(false);

    expect(container.opacity).toBeUndefined();
    expect(background.opacity).toBe(0);
  });

  it('reveals the tooltip once it is measured', () => {
    const { container, background } = generate(true);

    expect(container.opacity).toBeUndefined();
    expect(background.opacity).toBeUndefined();
  });
});
