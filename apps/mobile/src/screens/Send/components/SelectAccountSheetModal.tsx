import { AppBottomSheetModal } from '@/components';
import {
  AccountsPanelInSheetModal,
  SelectAccountSheetModalType,
} from '@/components/AccountSelectModalTx/AccountsPanel';
import AutoLockView from '@/components/AutoLockView';
import { IS_IOS } from '@/core/native/utils';
import { FontWeightEnum } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export function SheetModalSelectAccountSend({
  type,
  // visible = __DEV__ ? type === 'SendTo' : false,
  visible,
  onVisibleChange,
  onSelectAccount,
}: {
  type: SelectAccountSheetModalType;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  onSelectAccount?: React.ComponentProps<
    typeof AccountsPanelInSheetModal
  >['onSelectAccount'];
}) {
  const { styles } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(null);

  useEffect(() => {
    toggleShowSheetModal(!!visible);
  }, [visible, toggleShowSheetModal]);

  const { t } = useTranslation();

  const { FULL_HEIGHT } = useMemo(() => {
    return {
      FULL_HEIGHT:
        SIZES.HANDLE_HEIGHT +
        (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
        (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (8 - 1) +
        SIZES.ITEM_HEIGHT +
        SIZES.containerPt +
        SIZES.containerPb +
        SIZES.listBottomSpace,
    };
  }, []);

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: FULL_HEIGHT,
    containerBottomSpace: SIZES.containerPb,
  });

  const { modalTitle } = useMemo(() => {
    const ret = {
      modalTitle: '',
    };
    switch (type) {
      default:
      case 'SendFrom': {
        ret.modalTitle = t('page.selectAccountSheetModal.title.sendFrom');
        break;
      }
      case 'SendTo': {
        ret.modalTitle = t('page.selectAccountSheetModal.title.sendTo');
        break;
      }
    }

    return ret;
  }, [type, t]);

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      snapPoints={['80%']}
      enablePanDownToClose={!__DEV__}
      onChange={index => {
        const isVisible = index >= 0;
        onVisibleChange?.(isVisible);
      }}>
      <AutoLockView
        as="View"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerBottomSpace,
          },
        ]}>
        <Text style={styles.title}>{modalTitle}</Text>
        <View style={styles.mainContainer}>
          <AccountsPanelInSheetModal
            scene="SendTo"
            onSelectAccount={onSelectAccount}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SIZES = {
  ITEM_HEIGHT: 72,
  ITEM_GAP: 12,
  titleMt: 6,
  titleHeight: 24,
  titleMb: 0,
  HANDLE_HEIGHT: 8,
  containerPt: 20,
  containerPb: 42,
  listBottomSpace: 48,
};
const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      flex: 1,
      paddingVertical: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      paddingTop: SIZES.containerPt,
      paddingBottom: SIZES.containerPb,
      // ...makeDebugBorder('blue')
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: FontWeightEnum.heavy,
      lineHeight: 24,
      color: ctx.colors2024['neutral-title-1'],
      textAlign: 'center',

      marginTop: SIZES.titleMt,
      minHeight: SIZES.titleHeight,
      marginBottom: SIZES.titleMb,
      // ...makeDebugBorder('red'),
    },
    mainContainer: {
      width: '100%',
      paddingHorizontal: 0,
    },
  };
});
