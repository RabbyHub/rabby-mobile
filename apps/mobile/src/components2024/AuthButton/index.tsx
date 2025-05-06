import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useCallback } from 'react';
import { useBiometrics } from '@/hooks/biometrics';
import { apisKeychain, apisLock } from '@/core/apis';
import { RequestGenericPurpose } from '@/core/apis/keychain';
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { useTranslation } from 'react-i18next';
import { Button, ButtonProps } from '../Button';
import RcIconLock from '@/assets2024/icons/common/lock-cc.svg';
import RcIconKeychainFaceIdCC from '@/assets2024/icons/common/fack_id.svg';
import RcIconKeychainFingerprintCC from '@/assets2024/icons/common/fingerprint.svg';

export type IAuthButtonProps = Omit<ButtonProps, 'onPress'> & {
  onFinished?: () => void;
};

const AuthButton: React.FC<IAuthButtonProps> = ({ onFinished, ...props }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const {
    computed: { isBiometricsEnabled, isFaceID },
  } = useBiometrics({ autoFetch: true });

  const validationHandler = password => {
    return apisLock.throwErrorIfInvalidPwd(password);
  };
  const unlockWithBiometrics = useCallback(async () => {
    if (!isBiometricsEnabled) {
      AuthenticationModal2024.show({
        title: t('page.addressDetail.add-to-whitelist'),
        authType: ['password'],
        onFinished: () => {
          onFinished?.();
        },
        validationHandler(password) {
          return apisLock.throwErrorIfInvalidPwd(password);
        },
      });
    }
    try {
      await apisKeychain.requestGenericPassword({
        purpose: RequestGenericPurpose.DECRYPT_PWD,
        onPlainPassword: async password => {
          await validationHandler?.(password);
          onFinished?.();
        },
      });
    } catch (error: any) {
      if (__DEV__) {
        console.error(error);
      }
      AuthenticationModal2024.show({
        title: t('page.addressDetail.add-to-whitelist'),
        authType: ['password'],
        onFinished: () => {
          onFinished?.();
        },
        validationHandler(password) {
          return apisLock.throwErrorIfInvalidPwd(password);
        },
      });
    }
  }, [isBiometricsEnabled, onFinished, t]);

  return (
    <Button
      icon={
        isBiometricsEnabled ? (
          isFaceID ? (
            <RcIconKeychainFaceIdCC
              color={colors2024['neutral-InvertHighlight']}
              style={styles.lockIcon}
            />
          ) : (
            <RcIconKeychainFingerprintCC
              color={colors2024['neutral-InvertHighlight']}
              style={styles.lockIcon}
            />
          )
        ) : (
          // <BiometricsIcon isFaceID={isFaceID} size={22} />
          <RcIconLock
            color={colors2024['neutral-InvertHighlight']}
            style={styles.lockIcon}
          />
        )
      }
      onPress={unlockWithBiometrics}
      {...props}
    />
  );
};

export default AuthButton;

const getStyle = createGetStyles2024(ctx => ({
  text: {
    color: 'red',
  },
  biometricsWrapper: {
    width: '100%',
    paddingHorizontal: 16,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 86,
    // ...makeDebugBorder('yellow'),
  },

  biometricsBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    // ...makeDebugBorder('yellow'),
  },
  lockIcon: {
    width: 22,
    height: 22,
  },
}));
