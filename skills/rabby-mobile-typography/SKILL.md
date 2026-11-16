---
name: rabby-mobile-typography
description: Standardize Rabby Mobile native fonts and weights, and diagnose text-rendering problems on specific devices. Use when changing fontFamily, fontWeight, text styles, or font compatibility in apps/mobile; evaluate Web/CSS and SVG fonts according to their own rendering environment.
---

# Rabby Mobile Fonts and Weights

Judge compatibility from the font files, the style transformation path and the final native Text style. Do not treat a weight accepted by React Native types as evidence that the project supports it.

## Standards and source of truth

When business text explicitly sets a weight, use the strings `'400'`, `'500'`, `'700'` and `'900'`. Body text may omit the weight by default; do not change existing fonts or inheritance just to complete a declaration. New code must not use aliases such as `'normal'`, `'bold'` or `'semibold'` for these four tiers. Precise tiers `'100'`–`'800'` are also available and now map to their matching single-weight files.

| Meaning          | Business weight | iOS `ui-rounded` weight | Android SF Pro Rounded file     | Static factory-external style |
| ---------------- | --------------- | ----------------------- | ------------------------------- | ----------------------------- |
| Thin             | `'100'`         | `'100'`                 | `SF-Pro-Rounded-Thin.otf`       | -                             |
| Ultralight       | `'200'`         | `'200'`                 | `SF-Pro-Rounded-Ultralight.otf` | -                             |
| Light            | `'300'`         | `'300'`                 | `SF-Pro-Rounded-Light.otf`      | -                             |
| Regular / body   | `'400'`         | `'400'`                 | `SF-Pro-Rounded-Regular.otf`    | `RoundedFontStyles.regular`   |
| Medium           | `'500'`         | `'500'`                 | `SF-Pro-Rounded-Medium.otf`     | `RoundedFontStyles.medium`    |
| Semibold         | `'600'`         | `'600'`                 | `SF-Pro-Rounded-Semibold.otf`   | -                             |
| Bold             | `'700'`         | `'700'`                 | `SF-Pro-Rounded-Bold.otf`       | `RoundedFontStyles.bold`      |
| Heavy            | `'800'`         | `'800'`                 | `SF-Pro-Rounded-Heavy.otf`      | `RoundedFontStyles.heavy`     |
| Black / emphasis | `'900'`         | `'900'`                 | `SF-Pro-Rounded-Black.otf`      | -                             |

All nine weights are bundled. Use `'800'` (Heavy) when the previous
`RoundedFontStyles.heavy` visual is intended; business `'900'` now resolves to
Black.

Source references:

- [Font assets](../../apps/mobile/assets/fonts) and [native resource config](../../apps/mobile/react-native.config.js): the nine standalone files are for Android only. iOS must not bundle Apple fonts (ITMS-91182), and must not register these files through `UIAppFonts` or WebView.
- iOS relies on the **newArch / Fabric** built-in `ui-rounded` support. Do not add RN native patches, global font handlers or private system font names for legacy font names or oldArch. Validate the font branch against the newArch branch; do not carry it into an oldArch packaging branch on its own.
- [fonts.ts](../../apps/mobile/src/core/utils/fonts.ts): `getRoundedFontStyle` produces the complete platform family/weight pair. `'900'` maps to Black and `'800'` maps to Heavy. `RoundedFontStyles` exposes four semantic static objects (`regular` / `medium` / `bold` / `heavy`); `heavy` is pinned to `'800'`. `FontNames.sf_pro` is iOS `System` / Android `Roboto`. `getFontWeightType` returns exact tiers.
- [styles.ts](../../apps/mobile/src/utils/styles.ts): `mutateStyles` selects the Android file through `getRoundedFontStyle`'s exact tier; `'900'` reaches Black and `'800'` reaches Heavy.
- [PR #2206](https://github.com/RabbyHub/rabby-mobile/pull/2206): business Rounded weights were previously corrected from `'800'` to `'900'`. With all nine files available, `'900'` is Black; use `RoundedFontStyles.heavy` (`'800'`) for the old Heavy visual. Do not describe the Heavy font file's own metadata as 900.
- [Legacy Text](../../apps/mobile/src/components/Text.tsx): Android Roboto uses `'500'` to express the old business semibold intent. That component's historical tolerance does not mean every text component corrects weights.

When migrating existing styles, decide the final font first: change Rounded `'600'` to `'700'`; change system-default and legacy SF Pro/Roboto `'600'` to `'500'` following the project convention; use `'800'` for Heavy and `'900'` for Black. Do not blindly replace every `'600'` with the same value. `FontWeightEnum` and the generic classifier may keep the full native weight enum; accepting an input does not mean business styles should use it.

## Style transformation boundaries

Prefer the existing component font system. 2024 theme styles use `SF Pro Rounded` as the logical family; the theme factory emits iOS `ui-rounded` or an Android single-weight file. Legacy `SF Pro` styles become iOS `System` / Android `Roboto`; do not redesign legacy page fonts as a side effect.

Import text components from [Typography](../../apps/mobile/src/components/Typography.tsx), including `Text`, `TextInput`, `AnimatedText` and others. It defaults `allowFontScaling: false` and **does not transform fontFamily/fontWeight or validate fonts**.

Plain styles created by `createGetStyles` and `createGetStyles2024` pass through `mutateStyles`:

- iOS emits `ui-rounded` with the matching system weight at the existing style-creation boundary; it does not scan styles in Typography or on every render.
- Android emits the matching single-weight file name and clears `fontWeight`.
- Transformation runs per style object and does not merge a Text style array first. Every style object that changes a Rounded weight must declare both family and weight.
- The `reanimatedStyles` function returned by `createGetStyles2024` does not pass through this transformation. Plain `StyleSheet.create`, inline styles, animated styles and third-party text/title/input styles must not be assumed transformed.

Theme style example:

```tsx
import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  label: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    color: colors2024['neutral-title-1'],
  },
  selectedLabel: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
}));

// styles comes from useTheme2024({ getStyle: getStyles }).
// Each override receives the correct Android font file independently.
<Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>;
```

Do not use `[styles.label, { fontWeight: '700' }]` to embolden an already transformed Android single-weight family, and do not split family and weight into two separately transformed styles.

When you must bypass the theme factory, use a complete static style. Do not use legacy PostScript aliases and do not append a business `fontWeight` on its own:

```tsx
import { StyleSheet } from 'react-native';
import { RoundedFontStyles } from '@/core/utils/fonts';

const textStyles = StyleSheet.create({
  amount: { ...RoundedFontStyles.heavy, fontSize: 32 },
});
```

`mutateStyles` no longer rewrites an already-resolved Android single-weight family to Roboto, and does not regroup a resolved iOS `ui-rounded / 800` as Bold; repeated transformation is idempotent. For raw styles that need a dynamic weight, call `getRoundedFontStyle` at the existing memo or style-creation stage. `cleanSpecialSoloWeightFont` only removes the redundant weight from an Android single-weight file and preserves the required iOS `ui-rounded` weight.

Style-array overrides must also use complete styles: `[styles.label, RoundedFontStyles.heavy]`, not an appended `{ fontWeight: '900' }`. The latter becomes Black again on iOS and overrides the single-weight-file contract on Android.

Track the final style merge order, default family and default weight for third-party text components; changing a call-site weight alone does not prove the final style is correct. For Reanimated numeric text, keep static fonts in the existing static style and do not add per-frame work for a font fix.

## Investigation scope and exceptions

Search from the repository root, including props, conditional expressions, styles passed into third-party components and NativeWind class names. Then follow the component call chain to confirm inheritance and overrides:

```bash
rg -n 'fontWeight|fontFamily|font-weight|font-family' apps/mobile/src
rg -n 'font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)' apps/mobile
rg --files apps/mobile/assets/fonts
```

A zero-hit search for one literal is not proof of complete coverage. Also inspect numeric values, enums, dynamic props, platform branches and later style overrides. Migrations belong at business call sites; do not edit generic enums or invalid-input test cases just to clear search results.

- WebView HTML/CSS, `apps/mobile-local-pages` and SVG text use different font-resolution paths. Do not mechanically apply the RN Rounded rules; inspect their `@font-face`, actual assets or SVG font dependency first.
- Native navigation titles in react-native-svg and react-native-screens may still use the legacy `RCTFont`. Do not infer `ui-rounded` support from the app already running newArch. Fixed icon text (for example GAS) uses paths and does not embed fonts; ordinary iOS rounded navigation titles render through application RN Text while preserving the native navigation container and existing custom titles. Confirm support separately when adding large titles or other native text components, and do not add native compatibility patches.
- Pro K-line [perps-pro-font.ts](../../apps/mobile-local-pages/src/pages/tradingview-candle-chart/perps-pro-font.ts): iOS uses CSS `ui-rounded` and loads no font file; Android registers `400 / 500 / 700` for `Rabby SF Pro Rounded`. Use `500` for crosshair labels and `700` for Pro tooltip emphasis. Do not write `510` or `600`, and do not copy the native `900` directly. The legacy chart branch and demo in the same file use system Web fonts; their `600` is not the native Rounded missing-tier problem.
- System/monospace fonts such as `System`, `Roboto`, `monospace` and `Menlo` are not converted to Rounded. Ordinary business weights still follow the four tiers; when another system or monospace weight is genuinely required, keep an exception with a clear product purpose and evidence of target-platform font support, and document it near the code.
- Font asset upgrades or new weights must also check Android resources and iOS system-font resolution; adding a CSS number or enum value alone is not enough. Xcode's `Check bundled system fonts` phase inspects the actual `.app`; do not disable that check to bypass a font problem.

## Validation and performance

Limited static-style migrations should preserve existing components, theme factories, subscription boundaries and layout logic. Do not add a full style scan in Typography or on every render, and do not replace a call-site fix by changing global weight classification. For Home and lists, still check for style-object recreation, extra subscriptions and render spread; a pure literal fix usually needs no performance benchmark.

After changing `apps/mobile` code, run the full required validation set from [AGENTS.md](../../AGENTS.md):

```bash
yarn workspace rabby-mobile lint:cycles
yarn workspace rabby-mobile lint:cycles:eslint
yarn workspace rabby-mobile typecheck
yarn workspace rabby-mobile test --runInBand
yarn workspace rabby-mobile test:integration:ci
```

Static checks and Jest cannot prove native glyph rendering. Check affected ordinary text, amounts/numbers, inputs, buttons, animated text and truncated layouts on real iOS and Android devices. Prioritize the original failing device and matching content; compare the four weight tiers, mixed Chinese/English text, and long text for missing glyphs, fallback or clipping. In delivery, state the platforms and scenarios actually verified and the remaining unverified items; do not claim all devices are fixed without real-device evidence.

Targeted validation for iOS system fonts and bundling boundaries:

When switching from a bundled-font release for the first time, an old incremental `.app` may still contain fonts removed from the resource list. If the check hits an old build product, clean that build configuration's output and rebuild; do not skip the audit or modify the package after signing.

```bash
yarn workspace rabby-mobile test:ios-fonts
yarn workspace rabby-mobile check:ios-fonts /absolute/path/RabbyMobile.app
```

`fonts.test.ts` / `styles.test.ts` validate JS mapping, factory boundaries and idempotence; they do not prove native glyphs. The targeted package test validates resource exclusion and the final package audit, and does not replace newArch real-device visual checks. After native navigation titles move to RN Text, they no longer have the system native title transition animation; observe that difference during acceptance.
