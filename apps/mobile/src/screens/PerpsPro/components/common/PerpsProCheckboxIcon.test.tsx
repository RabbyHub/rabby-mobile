import { transformSync } from '@babel/core';
import { readFileSync } from 'fs';
import path from 'path';
import { runInNewContext } from 'vm';
import React from 'react';
import { StyleSheet } from 'react-native';
import { ThemeColors2024 } from '@/constant/theme';
import { PerpsProCheckboxIcon } from './PerpsProCheckboxIcon';
import { PERPS_PRO_DIALOG_TOKENS } from './perpsProDialogVisual';

// This placeholder exposes the real caller props. The asset itself is compiled
// below by the production SVG transformer, rather than replaced with a View.
jest.mock('@/assets2024/icons/perps/PerpsProInfoCheckboxChecked.svg', () =>
  jest.fn(),
);

type SvgElement = React.ReactElement<Record<string, unknown>>;
let renderCheckedAsset: (props: Record<string, unknown>) => SvgElement;

beforeAll(async () => {
  const filename = path.resolve(
    __dirname,
    '../../../../assets2024/icons/perps/PerpsProInfoCheckboxChecked.svg',
  );
  const { createTransformer } = require('react-native-svg-transformer');
  const transformer = createTransformer({
    transform: ({ src }: { src: string }) => src,
  });
  const jsx = await transformer({
    filename,
    src: readFileSync(filename, 'utf8'),
  });
  const compiled = transformSync(jsx, {
    babelrc: false,
    configFile: false,
    plugins: [
      '@babel/plugin-transform-react-jsx',
      '@babel/plugin-transform-modules-commonjs',
    ],
  });
  const assetModule = { exports: {} as { default: typeof renderCheckedAsset } };
  runInNewContext(compiled!.code!, {
    exports: assetModule.exports,
    module: assetModule,
    require: (name: string) => {
      if (name === 'react') {
        return React;
      }
      if (name === 'react-native-svg') {
        // Only the native drawing hosts are substituted. Root inheritance and
        // each shape's paint attributes remain visible to these assertions.
        return { __esModule: true, default: 'svg', Rect: 'rect', Path: 'path' };
      }
      throw new Error(`Unexpected SVG dependency: ${name}`);
    },
  });
  renderCheckedAsset = assetModule.exports.default;
});

describe('PerpsProCheckboxIcon asset paint boundaries', () => {
  it.each(['light', 'dark'] as const)(
    'keeps the %s white checkmark paint off the root and green rectangle',
    mode => {
      const checkColor = ThemeColors2024[mode]['neutral-InvertHighlight'];
      const icon = PerpsProCheckboxIcon({ checked: true, checkColor });
      const svg = renderCheckedAsset(icon.props);
      const shapes = React.Children.toArray(
        svg.props.children as React.ReactNode,
      ) as SvgElement[];
      const rectangle = shapes.find(shape => shape.type === 'rect')!;
      const checkmark = shapes.find(shape => shape.type === 'path')!;

      // A root stroke would be inherited by the rectangle on both native platforms.
      expect(svg.props.stroke).toBeUndefined();
      expect(svg.props).toMatchObject({
        color: PERPS_PRO_DIALOG_TOKENS.actionBackground,
        fill: 'none',
        height: 20,
        width: 20,
        viewBox: '0 0 20 20',
      });
      expect(rectangle.props).toMatchObject({
        x: 2,
        y: 2,
        width: 16,
        height: 16,
        rx: 4,
        fill: 'currentColor',
      });
      expect(rectangle.props.stroke).toBeUndefined();
      expect(checkmark.props).toMatchObject({
        stroke: checkColor,
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      });
    },
  );

  it('retains the unchecked frame and border geometry', () => {
    const icon = PerpsProCheckboxIcon({
      checked: false,
      checkColor: ThemeColors2024.dark['neutral-InvertHighlight'],
    });
    expect(StyleSheet.flatten(icon.props.style)).toMatchObject({
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(StyleSheet.flatten(icon.props.children.props.style)).toMatchObject({
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1.25,
      borderColor: PERPS_PRO_DIALOG_TOKENS.checkboxBorder,
    });
  });
});
