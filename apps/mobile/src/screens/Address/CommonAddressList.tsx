import React, { useCallback } from 'react';
import { View, FlatList } from 'react-native';
import Animated from 'react-native-reanimated';
import { updateRNRToastOnUI } from '@/components/RNRToast';
import {
  KeyringAccountWithAlias,
  storeApiAccounts,
  useAccountRemovingVisualStageSV,
  useAccountRemovingToastBridge,
  useAccounts,
  useIsRemovingAccount,
} from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/AddressItem';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { createGetStyles2024 } from '@/utils/styles';
import { useSortAddressList } from './useSortAddressList';
import { Card } from '@/components2024/Card';
import PlusSVG from '@/assets2024/icons/common/plus-cc.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Typography';
import {
  useDeletingCollapseStyle,
  useDeletingOpacity,
} from '@/hooks/useDeletingOpacity';

interface Props {
  type: KeyringTypeName;
  footerButtonText: string;
  footerButtonPress: () => void;
}

const ADDRESS_ROW_HEIGHT = 78;
const ADDRESS_ROW_GAP = 12;

const AddressListRow = ({
  account,
  expandedMarginTop,
}: {
  account: KeyringAccountWithAlias;
  expandedMarginTop: number;
}) => {
  const isRemoving = useIsRemovingAccount(account);
  const removingVisualStageSV = useAccountRemovingVisualStageSV(account);
  const removingToastBridge = useAccountRemovingToastBridge(account);
  const removingToastId = removingToastBridge?.toastId;
  const removingSuccessMessage = removingToastBridge?.successMessage;
  const handleRemovingVisualFinished = useCallback(() => {
    storeApiAccounts.markRemovingToastTransitioned(account);
    storeApiAccounts.finishRemovingAccountVisual(account).catch(error => {
      console.error('finish removing account visual failed', error);
    });
  }, [account]);
  const handleRemovingToastFinishedOnUI = useCallback(() => {
    'worklet';

    if (!removingToastId || !removingSuccessMessage) {
      return;
    }

    updateRNRToastOnUI(removingToastId, {
      duration: 2000,
      kind: 'success',
      message: removingSuccessMessage,
      position: 'top',
    });
  }, [removingSuccessMessage, removingToastId]);
  const deletingOpacityStyle = useDeletingOpacity(removingVisualStageSV);
  const collapseStyle = useDeletingCollapseStyle({
    stage: removingVisualStageSV,
    expandedHeight: ADDRESS_ROW_HEIGHT,
    expandedMarginTop,
    onFinish: handleRemovingVisualFinished,
    onFinishUI:
      removingToastId && removingSuccessMessage
        ? handleRemovingToastFinishedOnUI
        : undefined,
  });

  return (
    <Animated.View
      pointerEvents={isRemoving ? 'none' : 'auto'}
      style={collapseStyle}>
      <Animated.View style={deletingOpacityStyle}>
        <AddressItemEntry account={account} />
      </Animated.View>
    </Animated.View>
  );
};

export const CommonAddressList: React.FC<Props> = ({
  type,
  footerButtonText,
  footerButtonPress,
}) => {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
    includeRemoving: true,
    includeFinishingVisual: true,
  });
  const { bottom } = useSafeAreaInsets();

  const { styles, colors2024 } = useTheme2024({ getStyle });
  const filterAccounts = React.useMemo(
    () => [...accounts].filter(a => a.type === type),
    [accounts, type],
  );
  const list = useSortAddressList(filterAccounts);

  return (
    <FlatList
      data={list}
      keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
      style={styles.listContainer}
      renderItem={({ item, index }) => (
        <AddressListRow
          account={item}
          expandedMarginTop={index === 0 ? 0 : ADDRESS_ROW_GAP}
        />
      )}
      ListFooterComponent={
        <>
          <Card style={styles.footer} onPress={footerButtonPress}>
            <View style={styles.footerMain}>
              <PlusSVG
                width={20}
                height={20}
                color={colors2024['neutral-secondary']}
              />
              <Text style={styles.footerText}>{footerButtonText}</Text>
            </View>
          </Card>
          <View style={{ height: bottom }} />
        </>
      }
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));
