import { Pressable, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useCallback, useState } from 'react';
import { useBiometrics } from '@/hooks/biometrics';
import { apisKeychain, apisLock } from '@/core/apis';
import { RequestGenericPurpose } from '@/core/apis/keychain';
import { BiometricsIcon } from '@/screens/Unlock/Unlock';
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { useTranslation } from 'react-i18next';
import { Button, ButtonProps } from '../Button';
import RcIconLock from '@/assets2024/icons/bridge/IconLock.svg';

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
          <BiometricsIcon isFaceID={isFaceID} size={26} />
        ) : (
          <RcIconLock
            color={colors2024['neutral-foot']}
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
  biometricsBtn: {
    width: 26,
    height: 26,
  },
  lockIcon: {
    width: 46,
    height: 46,
  },
}));
