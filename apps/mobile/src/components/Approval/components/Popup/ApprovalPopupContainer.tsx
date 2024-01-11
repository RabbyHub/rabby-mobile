import React from 'react';
import { useTranslation } from 'react-i18next';
import { FooterResend } from './FooterResend';
import { FooterButton } from './FooterButton';
import { FooterResendCancelGroup } from './FooterResendCancelGroup';
import TxFailedSVG from '@/assets/icons/approval/tx-failed.svg';
import TxSucceedSVG from '@/assets/icons/approval/tx-succeed.svg';
import ConnectWiredSVG from '@/assets/icons/approval/connect-wired.svg';
import ConnectWirelessSVG from '@/assets/icons/approval/connect-wireless.svg';
import ConnectQRCodeSVG from '@/assets/icons/approval/connect-qrcode.svg';
import ConnectWalletConnectSVG from '@/assets/icons/approval/connect-walletconnect.svg';
import { FooterDoneButton } from './FooterDoneButton';
import { Dots } from './Dots';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { noop } from 'lodash';
import { SvgProps } from 'react-native-svg';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

const PRIVATE_KEY_ERROR_HEIGHT = 217;
const OTHER_ERROR_HEIGHT = 392;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
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
    titleWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoIcon: {
      width: 20,
      height: 20,
      marginRight: 6,
    },
    descriptionText: {
      fontSize: 15,
      fontWeight: '400',
      marginTop: 12,
    },
    footer: {},
  });

export interface Props {
  hdType: 'wired' | 'wireless' | 'qrcode' | 'privatekey' | 'walletconnect';
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
}) => {
  const [iconColor, setIconColor] = React.useState('');
  const [contentColor, setContentColor] = React.useState('');
  const { t } = useTranslation();
  const { setHeight, height } = useCommonPopupView();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const SendSVG = React.useMemo(() => {
    switch (hdType) {
      case 'wired':
        return ConnectWiredSVG;
      case 'wireless':
        return ConnectWirelessSVG;
      case 'privatekey':
        return;
      case 'walletconnect':
        return ConnectWalletConnectSVG;
      case 'qrcode':
      default:
        return ConnectQRCodeSVG;
    }
  }, [hdType]);

  React.useEffect(() => {
    switch (status) {
      case 'SENDING':
        setIconColor('bg-blue-light');
        setContentColor('neutral-title-1');
        break;
      case 'WAITING':
      case 'SUBMITTING':
        setIconColor('bg-blue-light');
        setContentColor('neutral-title-1');
        break;
      case 'FAILED':
      case 'REJECTED':
        setIconColor('bg-red-forbidden');
        setContentColor('red-default');
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

  const lastNormalHeight = React.useRef(0);

  React.useEffect(() => {
    if (
      height !== lastNormalHeight.current &&
      height !== OTHER_ERROR_HEIGHT &&
      height !== PRIVATE_KEY_ERROR_HEIGHT
    ) {
      lastNormalHeight.current = height;
    }
  }, [height]);

  React.useEffect(() => {
    if (status === 'FAILED' || status === 'REJECTED') {
      if (hdType === 'privatekey') {
        setHeight(PRIVATE_KEY_ERROR_HEIGHT);
      } else {
        setHeight(OTHER_ERROR_HEIGHT);
      }
    } else {
      setHeight(lastNormalHeight.current);
    }
  }, [setHeight, hdType, status]);

  return (
    <View style={styles.wrapper}>
      {SendSVG ? (
        <View style={styles.mainContainer}>
          {BrandIcon && <BrandIcon style={styles.brandIcon} />}
          <SendSVG style={styles.mainImage} />
        </View>
      ) : null}
      <View style={styles.titleWrapper}>
        {InfoSVG ? <InfoSVG style={styles.infoIcon} /> : null}
        <View>{content({ contentColor })}</View>
        {(status === 'SENDING' || status === 'WAITING') && showAnimation ? (
          <Dots color={contentColor} />
        ) : null}
      </View>
      <ScrollView style={{ height: 36 }}>
        <Text
          style={[
            styles.descriptionText,
            {
              color: colors[contentColor],
            },
          ]}>
          {description}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        {status === 'SENDING' && <FooterResend onResend={onRetry} />}
        {status === 'WAITING' && <FooterResend onResend={onRetry} />}
        {status === 'FAILED' && (
          <FooterResendCancelGroup onCancel={onCancel} onResend={onRetry} />
        )}
        {status === 'RESOLVED' && <FooterDoneButton onDone={onDone} hide />}
        {status === 'REJECTED' && (
          <FooterResendCancelGroup onCancel={onCancel} onResend={onRetry} />
        )}
        {status === 'SUBMITTING' && (
          <FooterButton
            text={t('page.signFooterBar.submitTx')}
            onClick={onSubmit}
          />
        )}
      </View>
      {children}
    </View>
  );
};
