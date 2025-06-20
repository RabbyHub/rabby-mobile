import { useTranslation } from 'react-i18next';
import React from 'react';
import { NoActionBody } from './NoActionBody';
import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { openapi } from '@/core/request';
import RcIconAlert from '@/assets/icons/sign/tx/alert-currentcolor.svg';
import { Account } from '@/core/services/preference';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 6,
      padding: 15,
    },
    text: {
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 18,
      color: colors['neutral-body'],
    },
    iconAlert: {
      width: 15,
      height: 15,
      marginRight: 4,
      marginTop: 2,
      color: colors['neutral-body'],
    },
    textWrapper: {
      alignItems: 'flex-start',
      flexDirection: 'row',
    },
  });

type SupportOrigin = {
  origin: string;
  text: string;
};

type SupportSelector = {
  chainId: string;
  contractAddress?: string;
  selector?: string;
};

interface Props {
  data: SupportOrigin | SupportSelector;
  account: Account;
}

export const NoActionAlert: React.FC<Props> = ({
  data,
  account: currentAccount,
}) => {
  const { t } = useTranslation();
  const [isRequested, setIsRequested] = React.useState<boolean>(false);
  const [requestedCount, setRequestedCount] = React.useState<number>(1);
  const [isRequesting, setIsRequesting] = React.useState<boolean>(false);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const handleRequest = React.useCallback(() => {
    setIsRequesting(true);
    let promise;
    if ('origin' in data) {
      promise = openapi.walletSupportOrigin({
        origin: data.origin,
        user_addr: currentAccount!.address,
        text: data.text,
      });
    } else {
      promise = openapi.walletSupportSelector({
        chain_id: data.chainId,
        contract_id: data.contractAddress ?? '',
        selector: (data.selector ?? '').slice(0, 10),
        user_addr: currentAccount!.address,
      });
    }

    promise.then(res => {
      setRequestedCount(res.count ? res.count : 1);
      setIsRequested(true);
    });
  }, [data, currentAccount]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.textWrapper}>
        <RcIconAlert style={styles.iconAlert} />
        <Text style={styles.text}>{t('page.signTx.sigCantDecode')}</Text>
      </View>
      <NoActionBody
        requestedCount={requestedCount}
        handleRequest={handleRequest}
        isRequested={isRequested}
        isRequesting={isRequesting}
      />
    </View>
  );
};
