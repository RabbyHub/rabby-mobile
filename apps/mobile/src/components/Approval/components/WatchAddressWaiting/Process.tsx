import { AppColorsVariants } from '@/constant/theme';
import { Account } from '@/core/services/preference';
import { useThemeColors } from '@/hooks/theme';
import {
  useDisplayBrandName,
  WALLET_BRAND_NAME_KEY,
} from '@/hooks/walletconnect/useDisplayBrandName';
import { WALLET_INFO } from '@/utils/walletInfo';
import { CHAINS_ENUM } from '@debank/common';
import { WALLETCONNECT_STATUS_MAP } from '@rabby-wallet/eth-walletconnect-keyring/type';
import { useInterval } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  ApprovalPopupContainer,
  Props as ApprovalPopupContainerProps,
} from '../Popup/ApprovalPopupContainer';

type Valueof<T> = T[keyof T];
const INIT_SENDING_COUNTER = 60;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    brandIcon: {
      width: 20,
      height: 20,
      marginRight: 6,
    },
    titleWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      justifyContent: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    content: {
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
    },
    contentWrapper: {
      flexDirection: 'row',
    },
  });

const Process = ({
  status,
  account,
  error,
  onRetry,
  onCancel,
  onDone,
  chain,
}: {
  chain: CHAINS_ENUM;
  result: string;
  status: Valueof<typeof WALLETCONNECT_STATUS_MAP>;
  account: Account;
  error: { code?: number; message?: string } | null;
  onRetry(): void;
  onCancel(): void;
  onDone(): void;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [displayBrandName] = useDisplayBrandName(account.brandName);
  const { t } = useTranslation();
  const BrandSVG = React.useMemo(() => {
    return (
      WALLET_INFO[displayBrandName]?.icon ||
      WALLET_INFO[WALLET_BRAND_NAME_KEY[displayBrandName]]?.icon ||
      WALLET_INFO.UnknownWallet.icon
    );
  }, []);
  const [sendingCounter, setSendingCounter] =
    React.useState(INIT_SENDING_COUNTER);
  const [content, setContent] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [statusProp, setStatusProp] =
    React.useState<ApprovalPopupContainerProps['status']>('SENDING');

  const handleRetry = () => {
    onRetry();
    setSendingCounter(INIT_SENDING_COUNTER);
  };
  const handleCancel = () => {
    onCancel();
  };

  useInterval(() => {
    setSendingCounter(prev => prev - 1);
  }, 1000);

  const mergedStatus = React.useMemo(() => {
    if (sendingCounter <= 0 && status === WALLETCONNECT_STATUS_MAP.CONNECTED) {
      return WALLETCONNECT_STATUS_MAP.FAILD;
    }
    return status;
  }, [status, sendingCounter]);

  React.useEffect(() => {
    switch (mergedStatus) {
      case WALLETCONNECT_STATUS_MAP.CONNECTED:
        setContent(t('page.signFooterBar.walletConnect.sendingRequest'));
        setDescription('');
        setStatusProp('SENDING');
        break;
      case WALLETCONNECT_STATUS_MAP.WAITING:
        setContent(t('page.signFooterBar.walletConnect.sendingRequest'));
        setDescription('');
        setStatusProp('WAITING');
        break;
      case WALLETCONNECT_STATUS_MAP.FAILD:
        setContent(t('page.signFooterBar.walletConnect.requestFailedToSend'));
        setDescription(error?.message || '');
        setStatusProp('FAILED');
        break;
      case WALLETCONNECT_STATUS_MAP.SIBMITTED:
        setContent(t('page.signFooterBar.qrcode.sigCompleted'));
        setDescription('');
        setStatusProp('RESOLVED');
        break;
      case WALLETCONNECT_STATUS_MAP.REJECTED:
        setContent(t('page.signFooterBar.ledger.txRejected'));
        setDescription(error?.message || '');
        setStatusProp('REJECTED');
        break;
    }
  }, [mergedStatus, error]);

  const renderContent = React.useCallback(
    ({ contentColor }) => (
      <View style={styles.contentWrapper}>
        <Text
          style={StyleSheet.flatten([
            styles.content,
            {
              color: colors[contentColor],
            },
          ])}>
          {content}
        </Text>
        {mergedStatus === WALLETCONNECT_STATUS_MAP.CONNECTED && (
          <Text
            style={StyleSheet.flatten([
              styles.content,
              {
                color: colors[contentColor],
              },
            ])}>
            ({sendingCounter}s)
          </Text>
        )}
      </View>
    ),
    [colors, content, mergedStatus, sendingCounter, styles.content],
  );

  return (
    <View>
      <View style={styles.titleWrapper}>
        <BrandSVG style={styles.brandIcon} />
        <Text style={styles.title}>
          {t('page.signFooterBar.qrcode.signWith', { brand: displayBrandName })}
        </Text>
      </View>
      <ApprovalPopupContainer
        hdType="walletconnect"
        showAnimation
        BrandIcon={BrandSVG}
        status={statusProp}
        onRetry={handleRetry}
        onDone={onDone}
        onCancel={handleCancel}
        description={description}
        hasMoreDescription={!!description}
        content={renderContent}
      />
    </View>
  );
};

export default Process;
