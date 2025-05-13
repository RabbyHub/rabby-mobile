import React, { useCallback, useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { atom, useAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { DevTestItem } from './testDevUtils';
import { Block } from '../Block';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { useMockBatchRevoke } from '@/hooks/appSettings';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

const devMockBatchRevokeAtom = atom(false);
export function useDevMockBatchRevokeVisible() {
  const [devMockBatchRevoke, setMockBatchRevokeVisible] = useAtom(
    devMockBatchRevokeAtom,
  );

  return {
    devMockBatchRevoke,
    setMockBatchRevokeVisible,
  };
}

export default function MockBatchRevokeModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    mockBatchRevoke: modalRef,
  });
  const { mockBatchRevokeSetting, setMockBatchRevoke } = useMockBatchRevoke();

  const { devMockBatchRevoke: visible, setMockBatchRevokeVisible } =
    useDevMockBatchRevokeVisible();

  useEffect(() => {
    toggleShowSheetModal('mockBatchRevoke', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setMockBatchRevokeVisible(false);
    onCancel?.();
  }, [setMockBatchRevokeVisible, onCancel]);

  const [ethGasUsdLimit, setEthGasAsUsdLimit] = React.useState(
    mockBatchRevokeSetting.DEBUG_ETH_GAS_USD_LIMIT.toString(),
  );
  const [otherChainGasUsdLimit, setOtherChainGasUsdLimit] = React.useState(
    mockBatchRevokeSetting.DEBUG_OTHER_CHAIN_GAS_USD_LIMIT.toString(),
  );

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: mockBatchRevokeSetting.DEBUG_MOCK_SUBMIT
          ? 'Enabled'
          : 'Disabled',
        onPress: () => {
          setMockBatchRevoke(
            'DEBUG_MOCK_SUBMIT',
            !mockBatchRevokeSetting.DEBUG_MOCK_SUBMIT,
          );
        },
        rightNode: (
          <AppSwitch2024
            onValueChange={val => setMockBatchRevoke('DEBUG_MOCK_SUBMIT', val)}
            value={mockBatchRevokeSetting.DEBUG_MOCK_SUBMIT}
          />
        ),
      },
      {
        label: 'ETH_GAS_USD_LIMIT',
        rightNode: (
          <BottomSheetTextInput
            style={styles.textInput}
            placeholder="ETH_GAS_USD_LIMIT"
            enterKeyHint="done"
            returnKeyType="done"
            keyboardType="decimal-pad"
            value={ethGasUsdLimit}
            onChangeText={setEthGasAsUsdLimit}
            onBlur={() => {
              setMockBatchRevoke(
                'DEBUG_ETH_GAS_USD_LIMIT',
                parseFloat(ethGasUsdLimit) || 0,
              );
            }}
          />
        ),
      },
      {
        label: 'OTHER_CHAIN_GAS_USD_LIMIT',
        rightNode: (
          <BottomSheetTextInput
            style={styles.textInput}
            enterKeyHint="done"
            returnKeyType="done"
            placeholder="OTHER_CHAIN_GAS_USD_LIMIT"
            keyboardType="decimal-pad"
            value={otherChainGasUsdLimit}
            onChangeText={setOtherChainGasUsdLimit}
            onBlur={() => {
              setMockBatchRevoke(
                'DEBUG_OTHER_CHAIN_GAS_USD_LIMIT',
                parseFloat(otherChainGasUsdLimit) || 0,
              );
            }}
          />
        ),
      },
      {
        label: 'DEBUG_SIMULATION_FAILED',
        onPress: () => {
          setMockBatchRevoke(
            'DEBUG_SIMULATION_FAILED',
            !mockBatchRevokeSetting.DEBUG_SIMULATION_FAILED,
          );
        },
        rightNode: (
          <AppSwitch2024
            onValueChange={val =>
              setMockBatchRevoke('DEBUG_SIMULATION_FAILED', val)
            }
            value={mockBatchRevokeSetting.DEBUG_SIMULATION_FAILED}
          />
        ),
      },
    ];

    return list.filter(item => item.visible !== false);
  })();

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: getFullHeight(Items.length),
    containerPaddingBottom: SIZES.containerPb,
  });

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      ref={modalRef}
      index={0}
      snapPoints={[safeSizes.sheetHeight]}
      handleStyle={styles.handleStyle}
      onDismiss={handleCancel}
      enableContentPanningGesture={false}>
      <AutoLockView
        as="BottomSheetView"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>Mock Batch Revoke</Text>
        <Block label="">
          {Items.map((item, idx) => {
            const itemKey = `testitem-${item.label}`;

            return <Block.Item key={`${itemKey}`} {...item} />;
          })}
        </Block>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SIZES = {
  ITEM_HEIGHT: 60,
  ITEM_GAP: 12,
  titleMt: 6,
  titleHeight: 24,
  titleMb: 16,
  HANDLE_HEIGHT: 8,
  containerPb: 56,
};

function getFullHeight(itemsLen: number) {
  return (
    SIZES.HANDLE_HEIGHT +
    (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
    (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (itemsLen - 1) +
    SIZES.ITEM_HEIGHT +
    SIZES.containerPb
  );
}
const getStyles = createGetStyles((colors, ctx) => {
  return {
    sheet: {
      backgroundColor: colors['neutral-bg-2'],
    },
    handleStyle: {
      height: 8,
      backgroundColor: colors['neutral-bg-2'],
    },
    container: {
      flex: 1,
      paddingVertical: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      paddingBottom: SIZES.containerPb,
      // ...makeDebugBorder('blue')
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      textAlign: 'center',

      marginTop: SIZES.titleMt,
      minHeight: SIZES.titleHeight,
      marginBottom: SIZES.titleMb,
      // ...makeDebugBorder('red'),
    },
    textInput: {
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: colors['neutral-line'],
      width: 80,
    },
  };
});
