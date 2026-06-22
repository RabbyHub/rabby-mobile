---
name: mobile-bottom-buttons
description: When adding or adjusting fixed bottom buttons, bottom-sheet footer buttons, modal action buttons, or footer button spacing in `apps/mobile`, reuse the shared bottom button constants from `src/constant/layout.ts` and follow the Rabby Mobile PR #1761 bottom-button style cleanup.
---

# Mobile Bottom Buttons

Use this playbook for bottom action areas in `apps/mobile`, including:

- fixed screen footer buttons
- `AppBottomSheetModal` or Gorhom bottom-sheet footer buttons
- modal primary/secondary action rows
- scroll content that needs bottom padding to clear a footer button

## Reference

The canonical cleanup is [RabbyHub/rabby-mobile#1761](https://github.com/RabbyHub/rabby-mobile/pull/1761), `feat/bottom-button`, merged on 2026-05-29.

That PR centralized bottom button sizing and spacing in [`src/constant/layout.ts`](../src/constant/layout.ts). Check that file before introducing any new footer button dimensions.

## Rules

1. Reuse shared constants from `@/constant/layout`.

   Prefer:

   - `BOTTOM_BUTTON_SINGLE_HEIGHT`
   - `BOTTOM_BUTTON_DOUBLE_HEIGHT`
   - `BOTTOM_BUTTON_TITLE_STYLE`
   - `BOTTOM_BUTTON_WITH_ICON_TITLE_STYLE`
   - `BOTTOM_BUTTON_TOP_OFFSET`
   - `BOTTOM_BUTTON_BOTTOM_OFFSET`
   - `BOTTOM_BUTTON_GAP`
   - `getBottomButtonBottomOffset`

   Do not add local `56`, `52`, `48`, `36`, or `Math.max(bottom, 36)` footer sizing unless the surrounding component has a documented special-case layout.

2. Use the 2024 button style for new 2024 UI.

   ```tsx
   <Button
     type="primary"
     height={BOTTOM_BUTTON_SINGLE_HEIGHT}
     titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
     title={t('global.ok')}
     onPress={onConfirm}
   />
   ```

3. Put footer spacing on the footer container, not the button.

   ```ts
   footer: {
     paddingHorizontal: 20,
     paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
     paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
   }
   ```

4. For two-button rows, use the double-button height and shared gap.

   - Primary action: `type="primary"`
   - Secondary/cancel action: prefer `type="plain"` unless the local design already uses a legacy button component.
   - Row gap: `BOTTOM_BUTTON_GAP`
   - Button height: `BOTTOM_BUTTON_DOUBLE_HEIGHT`

5. For scrollable content behind a fixed footer, reserve footer height in the scroll content.

   ```ts
   scrollContent: {
     paddingBottom:
       BOTTOM_BUTTON_TOP_OFFSET +
       BOTTOM_BUTTON_SINGLE_HEIGHT +
       getBottomButtonBottomOffset(safeAreaInsets.bottom),
   }
   ```

6. For Gorhom `footerComponent`, let the footer root participate in normal footer layout.

   Do not absolutely position the footer root with `position: 'absolute'`, `bottom: 0`, `left: 0`, and `right: 0` inside `footerComponent`; it can break footer measurement and leave the button hidden or clipped. If content can scroll underneath it, add `contentContainerStyle` bottom padding using the shared constants.

7. Let `Button` own default visual treatment when possible.

   Avoid re-declaring button title font size, line height, radius, disabled color, or primary background in each screen. Pass `height` and `titleStyle`, and only add local style for genuinely local width/layout constraints.

## Current References

- [`src/constant/layout.ts`](../src/constant/layout.ts)
- [`src/components2024/Button/index.tsx`](../src/components2024/Button/index.tsx)
- [`src/components/Screenshot/FeedbackEntryOnHeader.tsx`](../src/components/Screenshot/FeedbackEntryOnHeader.tsx)
- [`src/screens/GasAccount/components/WithDrawPopup.tsx`](../src/screens/GasAccount/components/WithDrawPopup.tsx)
- [`src/screens/Perps/components/PerpsHistorySection/PerpsHistoryDetailPopup.tsx`](../src/screens/Perps/components/PerpsHistorySection/PerpsHistoryDetailPopup.tsx)
