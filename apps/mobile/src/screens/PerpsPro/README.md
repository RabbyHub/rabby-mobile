# Perps Pro keyboard accessory

## Renderer compatibility

The Done toolbar uses the native iOS keyboard accessory and an Android Portal.
Choose the iOS implementation from the actual `nativeFabricUIManager` runtime
flag, not a branch name, build channel, or `__DEV__`.

| Runtime                      | Input ID                                     | Native host                                        |
| ---------------------------- | -------------------------------------------- | -------------------------------------------------- |
| iOS Paper                    | Shared `perps-pro-keyboard-accessory`        | One persistent host in `PerpsProKeyboardAccessory` |
| iOS Fabric                   | Stable ID derived from the input's `useId()` | One `PerpsProInputAccessory` next to each input    |
| Android, either architecture | No iOS accessory ID                          | Existing session-owned Portal and 48pt sheet inset |

RN 0.81.6's Paper `RCTBaseTextInputView` looks up the accessory when an input's
`inputAccessoryViewID` is set. Fabric's `RCTInputAccessoryComponentView` instead
searches for the **first** matching input when its host enters the window.
The Fabric input only stores the ID; focusing it does not repeat that lookup.
Consequently, a shared host cannot reliably serve multiple inputs or inputs
mounted later in a Bottom Sheet. This explains Amount retaining Done while
Price and later sheet inputs lose it in the Fabric build of `tmp/20261001`.
See also [React Native issue 47865](https://github.com/react/react-native/issues/47865).

## Adding or changing inputs

- Use `PerpsProDecimalTextInput` for decimal editing. It already registers the
  input and renders the matching local Fabric host, including when `renderInput`
  supplies a presentation wrapper.
- A direct `usePerpsProKeyboardInput` caller must pass `inputAccessoryViewID`,
  compose its focus/blur callbacks, and render
  `<PerpsProInputAccessory nativeID={keyboard.inputAccessoryViewID} />`
  **after** the actual input in the same mount/Portal boundary. The direct
  callers are market search, close-position amount, and transfer amount.
- Keep the host mounted for the input's full lifetime. Do not gate it on focus,
  keyboard visibility, minimum hints, or controlled sheet visibility while the
  native input is still mounted. Host and input identities must stay paired if
  an input is replaced. Do not mount the host only after focus or use timers to
  repair binding.
- Keep the ID stable across edits and focus changes. Do not remount the editor
  to refresh Done: that would discard selection, IME composition, or TP/SL drafts.
- Keep the page-level `PerpsProKeyboardAccessory` in Fabric too. Although it
  renders no iOS host there, it still owns route/AppState activation, keyboard
  events, and trade scrolling.

`PerpsProKeyboardAccessoryBar` preserves the shared 48pt visuals, shadow, minimum
hint and touch handling. `dismissPerpsProKeyboard` reads the current session at
press time, blurs that input, clears its ownership and dismisses the keyboard.
Done does not submit an order or clear drafts. The native iOS keyboard frame
already includes the accessory; do not add Android's extra 48pt compensation.

## Performance and existing fixes

The impact is local to Pro input mounting and focus/minimum changes. Fabric adds
one native accessory subtree per mounted input. The local host is memoized and
subscribes only to its own minimum string/null, so an unrelated focus or hint
update does not rerender it. Inputs add no per-field keyboard/AppState listeners,
timers, layout measurement loops, network calls, or market subscriptions.

Preserve Android's presentation identity through blur/focus hand-off, its sheet
inset, the UI-thread keyboard-target update, and the TP/SL transparent-text fix.
Preserve per-leg TP/SL cancellation resets and the iOS search input's uncontrolled
native text ownership for IME composition.

## Regression evidence

- `iosKeyboardAccessory.integration.test.tsx` uses the real input, accessory,
  session and Portal components. It covers the iOS/Android renderer matrix,
  distinct stable IDs, late sheet/search mounting, reopen, focus hand-off, minimum
  hints, Done, and retained drafts. Renderer flags select JS branches in Jest;
  these are **JS integration tests**, not proof of UIKit attachment.
- `PerpsProKeyboardAccessory.test.tsx` explicitly selects Paper for the shared
  iOS host and also protects the Android overlay behavior.
- Close-position and transfer component tests cover their direct-input wiring;
  the existing decimal-input unit tests isolate editing from accessory rendering.

Required repository checks:

```sh
yarn workspace rabby-mobile lint:cycles
yarn workspace rabby-mobile lint:cycles:eslint
yarn workspace rabby-mobile typecheck
yarn workspace rabby-mobile test --runInBand
yarn workspace rabby-mobile test:integration:ci
```

### Native acceptance matrix

Native acceptance remains required on iOS Paper and Fabric packages. This change
has not yet been verified on a device; passing Jest checks must not be reported
as native keyboard verification. Select the architecture consistently for Pods
and JavaScript tooling and record the actual package's architecture.

1. Start in Market, focus Amount, switch to Limit, then alternate Amount/Price
   without leaving Pro. Repeat with conditional trigger/execution prices and
   trade TP/SL inputs. Each shows exactly one custom Done bar.
2. Open search, position TP/SL (price/PnL/ROI/amount), close-position
   (market amount and later limit price), margin, leverage, open-order edit, and
   transfer sheets after entering Pro. Repeat after closing/reopening each sheet.
3. Check minimum hints only on the appropriate opening Amount input, including
   unit changes. Done must close the keyboard without submitting or discarding
   drafts; sheet position and visible input must recover correctly.
4. Check iOS search IME composition, middle-of-text editing, `0.` drafts, and
   cancelling one TP/SL leg while the other has an edited draft. Leave Pro and
   background/foreground the app; stale owners must not persist.
5. Regress Android with both architectures: Price-to-PnL hand-off retains one
   toolbar and its 48pt inset, search dismissal restores the sheet, and blurred
   TP/SL text does not overlap. Include switching between sheets.
