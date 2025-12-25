import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useTheme2024 } from '@/hooks/theme';
import {
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { CompositeScreenProps, useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect } from 'react';
import {
  apisLending,
  useFetchLendingData,
  useLendingRemoteData,
} from '../hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

type SwapRouteProps = CompositeScreenProps<
  NativeStackScreenProps<TransactionNavigatorParamList, 'Lending'>,
  NativeStackScreenProps<RootStackParamsList>
>;

export const useInitOpenDetail = () => {
  const { colors2024, isLight } = useTheme2024();
  const route = useRoute<SwapRouteProps['route']>();

  const { tokenAddress, direction } = route.params || {};
  const { reserves } = useLendingRemoteData();

  const openSupplyDetail = useCallback(
    (address: string) => {
      const reserve = reserves?.reservesData?.find(item =>
        isSameAddress(item.underlyingAsset, address),
      );
      if (!reserve) {
        apisLending.setLoading(true, { address });
      }
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SUPPLY_DETAIL,
        underlyingAsset: address,
        onClose: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
      });
    },
    [colors2024, isLight, reserves?.reservesData],
  );

  const openBorrowDetail = useCallback(
    (address: string) => {
      const reserve = reserves?.reservesData?.find(item =>
        isSameAddress(item.underlyingAsset, address),
      );
      if (!reserve) {
        apisLending.setLoading(true, { address });
      }
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.BORROW_DETAIL,
        underlyingAsset: address,
        onClose: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
      });
    },
    [colors2024, isLight, reserves?.reservesData],
  );

  useEffect(() => {
    if (tokenAddress) {
      if (direction === 'supply') {
        openSupplyDetail(tokenAddress);
        return;
      }
      if (direction === 'borrow') {
        openBorrowDetail(tokenAddress);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
