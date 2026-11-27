import React, { useMemo } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { useTheme2024 } from '@/hooks/theme';

import { useAccounts } from '@/hooks/account';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import {
  CompositeScreenProps,
  useIsFocused,
  useRoute,
} from '@react-navigation/native';
import { addressUtils } from '@rabby-wallet/base-utils';

import {
  AddressNavigatorParamList,
  RootStackParamsList,
} from '@/navigation-type';
import { noop } from 'lodash';
import { AddressDetailInner } from '@/components2024/AddressDetail/AddressDetailInner';
import { useQrCodeModal } from '@/components2024/QrCodeModal/useQrCodeModal';
import QrcodeSVG from '@/assets2024/icons/common/qrcode-cc.svg';
import { resetNavigationTo } from '@/hooks/navigation';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';

type AddressDetailProps = CompositeScreenProps<
  NativeStackScreenProps<AddressNavigatorParamList, 'AddressDetail'>,
  NativeStackScreenProps<RootStackParamsList>
>;

/**
 * Route-level trailing action (P6): the screen no longer installs headerRight
 * from a layout effect.
 */
export function AddressDetailHeaderRight({ address }: { address?: string }) {
  const { colors2024 } = useTheme2024();
  const qrCodeModal = useQrCodeModal();

  return (
    <TouchableOpacity
      hitSlop={10}
      onPress={() => {
        if (address) {
          qrCodeModal.show(address);
        }
      }}>
      <QrcodeSVG width={20} height={20} color={colors2024['neutral-body']} />
    </TouchableOpacity>
  );
}

function AddressDetailScreen(): JSX.Element {
  const { colors2024 } = useTheme2024();
  const isFocused = useIsFocused();
  const { params } = useRoute<AddressDetailProps['route']>();
  const { navigation } = useSafeSetNavigationOptions();
  const { address, type, brandName } = params;
  const { accounts } = useAccounts();
  const account = useMemo(
    () =>
      accounts.find(
        e =>
          addressUtils.isSameAddress(e.address, address) &&
          e.brandName === brandName &&
          e.type === type,
      ),
    [accounts, address, type, brandName],
  );

  return (
    <NormalScreenContainer
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-0'],
      }}>
      <ScrollView>
        {account ? (
          <AddressDetailInner
            active={isFocused}
            account={account}
            onCancel={() => noop}
            onDelete={() => {
              resetNavigationTo(navigation, 'Home');
            }}
          />
        ) : null}
      </ScrollView>
    </NormalScreenContainer>
  );
}

export default AddressDetailScreen;
