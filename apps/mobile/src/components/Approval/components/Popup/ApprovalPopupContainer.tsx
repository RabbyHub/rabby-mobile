import React from 'react';
import { useTranslation } from 'react-i18next';
import { FooterResend } from './FooterResend';
import { FooterButton } from './FooterButton';
import { FooterResendCancelGroup } from './FooterResendCancelGroup';
import TxSucceedSVG from '@/assets/icons/approval/tx-succeed.svg';
import ConnectWiredSVG from '@/assets/icons/approval/connect-wired.svg';
import ConnectBleSVG from '@/assets/icons/approval/connect-ble.svg';
import ConnectLedgerSVG from '@/assets/icons/approval/connect-ledger.svg';
import ConnectWirelessSVG from '@/assets/icons/approval/connect-wireless.svg';
import ConnectQRCodeSVG from '@/assets/icons/approval/connect-qrcode.svg';
import ConnectKeystoneSVG from '@/assets/icons/approval/connect-keystone.svg';
import ConnectOneKeySVG from '@/assets/icons/approval/connect-onekey.svg';
import { FooterDoneButton } from './FooterDoneButton';
import { Dots } from './Dots';
import { noop } from 'lodash';
import { SvgProps } from 'react-native-svg';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useApprovalPopup } from '@/hooks/useApprovalPopup';
import useDebounce from 'react-use/lib/useDebounce';
import { RetryUpdateType } from '@/utils/errorTxRetry';
import TxFailedSVG from '@/assets2024/icons/common/failed-retry.svg';
import { createGetStyles2024 } from '@/utils/styles';

const getStyles = createGetStyles2024(() => ({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mainContainer: {
    position: 'relative',
  },
  mainImage: {
    width: 140,
    height: 140,
  },
  brandIcon: {
    width: 20,
    height: 20,
    position: 'absolute',
    left: 34.6,
    top: 71,
    zIndex: 1,
  },
  oneKeyBrandIcon: {
    left: 38,
    top: 68,
  },

  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hdTitleWrapper: {
    marginTop: 28,
  },
  infoIcon: {
    width: 20,
    height: 20,
    marginRight: 6,
  },
  failedInfoIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  descriptionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 56,
  },
  description: {
    paddingTop: 12,
    paddingBottom: 30,
  },
  noDescription: {
    height: 20,
  },
}));

export interface Props {
  hdType:
    | 'wired'
    | 'wireless'
    | 'qrcode'
    | 'privatekey'
    | 'walletconnect'
    | 'ble'
    | 'keystone'
    | 'onekey'
    | 'ledger'
    | 'trezor';
  status:
    | 'SENDING'
    | 'WAITING'
    | 'RESOLVED'
    | 'REJECTED'
    | 'FAILED'
    | 'SUBMITTING';
  content: ({ contentColor }) => React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  onDone?: () => void;
  onCancel?: () => void;
  onSubmit?: () => void;
  hasMoreDescription?: boolean;
  children?: React.ReactNode;
  showAnimation?: boolean;
  BrandIcon?: React.FC<SvgProps>;
  style?: StyleProp<ViewStyle>;
  retryUpdateType?: RetryUpdateType;
}

export const ApprovalPopupContainer: React.FC<Props> = ({
  hdType,
  status,
  content,
  description,
  onRetry = noop,
  onDone = noop,
  onCancel = noop,
  onSubmit = noop,
  hasMoreDescription,
  children,
  showAnimation,
  BrandIcon,
  style,
  retryUpdateType = 'origin',
}) => {
  const [iconColor, setIconColor] = React.useState('');
  const [contentColor, setContentColor] = React.useState<
    keyof AppColorsVariants
  >(
    // @ts-expect-error
    '', // FIXME
  );
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });

  const SendSVG = React.useMemo(() => {
    switch (hdType) {
      case 'wired':
        return ConnectWiredSVG;
      case 'wireless':
        return ConnectWirelessSVG;
      case 'privatekey':
        return;
      case 'ble':
        return ConnectBleSVG;
      case 'ledger':
        return ConnectLedgerSVG;
      case 'keystone':
        return ConnectKeystoneSVG;
      case 'onekey':
        return ConnectOneKeySVG;
      case 'trezor':
        return;
      case 'qrcode':
      default:
        return ConnectQRCodeSVG;
    }
  }, [hdType]);

  React.useEffect(() => {
    switch (status) {
      case 'SENDING':
        setIconColor('blue-light-1');
        setContentColor('neutral-title-1');
        break;
      case 'WAITING':
      case 'SUBMITTING':
        setIconColor('blue-light-1');
        setContentColor('neutral-title-1');
        break;
      case 'FAILED':
      case 'REJECTED':
        setIconColor('orange-default');
        setContentColor('neutral-title-1');

        break;
      case 'RESOLVED':
        setIconColor('bg-green');
        setContentColor('green-default');
        break;
      default:
        break;
    }
  }, [status]);

  const InfoSVG = React.useMemo(() => {
    switch (status) {
      case 'SENDING':
      case 'WAITING':
      case 'SUBMITTING':
        return;
      case 'FAILED':
      case 'REJECTED':
        return TxFailedSVG;
      case 'RESOLVED':
        return TxSucceedSVG;
      default:
        return;
    }
  }, [status]);
  // const { snapToIndexPopup } = useApprovalPopup();

  // useDebounce(
  //   () => {
  //     if ((status === 'FAILED' || status === 'REJECTED') && description) {
  //       // snapToIndexPopup(1);
  //     } else {
  //       // snapToIndexPopup(0);
  //     }
  //   },
  //   10,
  //   [snapToIndexPopup, hdType, status, description],
  // );
  // const isHD = hdType === 'ledger';
  const isFailedOrRejected = status === 'FAILED' || status === 'REJECTED';

  const showSendSvg = retryUpdateType === 'origin' && !isFailedOrRejected;

  const isOneKey = hdType === 'onekey';

  return (
    <View style={StyleSheet.flatten([styles.wrapper, style])}>
      {SendSVG && showSendSvg ? (
        <View style={styles.mainContainer}>
          {BrandIcon && (
            <View
              style={[styles.brandIcon, isOneKey && styles.oneKeyBrandIcon]}>
              <BrandIcon width={'100%'} height={'100%'} />
            </View>
          )}
          <SendSVG style={styles.mainImage} />
        </View>
      ) : null}
      <View
        style={StyleSheet.flatten([
          styles.titleWrapper,
          styles.hdTitleWrapper,
        ])}>
        {InfoSVG ? (
          <InfoSVG
            style={StyleSheet.flatten([
              styles.infoIcon,
              isFailedOrRejected && styles.failedInfoIcon,
            ])}
          />
        ) : null}
        <View>{content({ contentColor })}</View>
        {(status === 'SENDING' || status === 'WAITING') && showAnimation ? (
          <Dots color={contentColor} />
        ) : null}
      </View>
      <ScrollView
        style={StyleSheet.flatten([
          styles.description,
          !description && styles.noDescription,
        ])}>
        <Text
          style={[
            styles.descriptionText,
            {
              color: colors2024['neutral-secondary'],
            },
          ]}>
          {description}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        {status === 'SENDING' && <FooterResend onResend={onRetry} />}
        {status === 'WAITING' && <FooterResend onResend={onRetry} />}
        {status === 'FAILED' && (
          <FooterResendCancelGroup
            retryUpdateType={retryUpdateType}
            BrandIcon={BrandIcon}
            onCancel={onCancel}
            onResend={onRetry}
          />
        )}
        {status === 'RESOLVED' && <FooterDoneButton onDone={onDone} hide />}
        {status === 'REJECTED' && (
          <FooterResendCancelGroup
            retryUpdateType={retryUpdateType}
            BrandIcon={BrandIcon}
            onCancel={onCancel}
            onResend={onRetry}
          />
        )}
        {status === 'SUBMITTING' && (
          <FooterButton
            text={t('page.signFooterBar.submitTx')}
            onClick={onSubmit}
          />
        )}
      </View>
      {/* {children} */}
    </View>
  );
};
