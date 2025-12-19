import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { useTheme2024 } from '@/hooks/theme';

import { useAccounts } from '@/hooks/account';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { CompositeScreenProps, useRoute } from '@react-navigation/native';
import { addressUtils } from '@rabby-wallet/base-utils';

import {
  AddressNavigatorParamList,
  RootStackParamsList,
} from '@/navigation-type';
import { noop } from 'lodash';
import { AddressDetailInner } from '@/components2024/AddressDetail/AddressDetailInner';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useQrCodeModal } from '@/components2024/QrCodeModal/useQrCodeModal';
import QrcodeSVG from '@/assets2024/icons/common/qrcode-cc.svg';
import { resetNavigationTo } from '@/hooks/navigation';
import { useTranslation } from 'react-i18next';

type AddressDetailProps = CompositeScreenProps<
  NativeStackScreenProps<AddressNavigatorParamList, 'AddressDetail'>,
  NativeStackScreenProps<RootStackParamsList>
>;

function AddressDetailScreen(): JSX.Element {
  const { colors2024 } = useTheme2024();
  const { params } = useRoute<AddressDetailProps['route']>();
  const { setNavigationOptions, navigation } = useSafeSetNavigationOptions();
  const qrCodeModal = useQrCodeModal();
  const { t } = useTranslation();
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

  const headerRight = useCallback(
    () => (
      <TouchableOpacity
        hitSlop={10}
        onPress={() => {
          qrCodeModal.show(address);
        }}>
        <QrcodeSVG width={20} height={20} color={colors2024['neutral-body']} />
      </TouchableOpacity>
    ),
    [address, colors2024, qrCodeModal],
  );

  useLayoutEffect(() => {
    setNavigationOptions({
      headerRight,
    });
  }, [headerRight, setNavigationOptions]);

  return (
    <NormalScreenContainer
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-0'],
      }}>
      <ScrollView>
        {account ? (
          <AddressDetailInner
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
