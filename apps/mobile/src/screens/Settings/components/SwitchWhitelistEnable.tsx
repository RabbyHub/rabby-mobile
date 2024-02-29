import { AppSwitch } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useWhitelist } from '@/hooks/whitelist';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { ConfirmBottomSheetModal } from './ConfirmBottomSheetModal';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { atom, useAtomValue, useSetAtom } from 'jotai';

const disabledText = {
  title: 'Disable Whitelist',
  desc: 'You can send assets to any address once disabled',
};

const enableWhitelistText = {
  title: 'Enable Whitelist',
  desc: 'Once enabled, you can only send assets to the addresses in the whitelist using Rabby.',
};

const switchWhitelistSheetModalPresentAtom = atom<
  BottomSheetModalMethods['present'] | null
>(null);

export const SwitchWhitelistEnable = () => {
  const { enable, toggleWhitelist } = useWhitelist();
  const colors = useThemeColors();
  const sheetModalRef = useRef<BottomSheetModal>(null);
  const setRefAtom = useSetAtom(switchWhitelistSheetModalPresentAtom);

  useEffect(() => {
    setRefAtom(pre => {
      if (sheetModalRef.current && pre !== sheetModalRef.current.present) {
        return sheetModalRef.current?.present;
      }
      return pre;
    });
    return () => {
      setRefAtom(null);
    };
  });
  return (
    <>
      <AppSwitch
        value={!!enable}
        changeValueImmediately={false}
        onValueChange={() => {
          sheetModalRef?.current?.dismiss();
          sheetModalRef?.current?.present();
        }}
        backgroundActive={colors['green-default']}
        circleBorderActiveColor={colors['green-default']}
      />
      <ConfirmBottomSheetModal
        ref={sheetModalRef}
        onConfirm={() => toggleWhitelist(!enable)}
        height={298}
        {...(enable ? disabledText : enableWhitelistText)}
      />
    </>
  );
};

SwitchWhitelistEnable.usePresent = () =>
  useAtomValue(switchWhitelistSheetModalPresentAtom);
