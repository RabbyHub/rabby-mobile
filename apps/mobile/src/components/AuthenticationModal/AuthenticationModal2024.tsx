import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { apisKeychain, apisLock } from '@/core/apis';
import { IS_IOS } from '@/core/native/utils';
import { useThemeStyles } from '@/hooks/theme';
import { usePasswordStatus } from '@/hooks/useLock';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import type { ValidationBehaviorProps } from '@/core/apis/lock';

import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '../GlobalBottomSheetModal';
import {
  GlobalModalViewProps,
  MODAL_NAMES,
} from '../GlobalBottomSheetModal/types';
import { CheckItem } from './CheckItem';
import { noop } from 'lodash';
import { BiometricsIcon } from './BiometricsIcon';
import TouchableView from '../Touchable/TouchableView';
import { useBiometricsComputed } from '@/hooks/biometrics';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { Button } from '../Button';
import { useRefState } from '@/hooks/common/useRefState';
import useMount from 'react-use/lib/useMount';
import usePrevious from 'react-use/lib/usePrevious';
import { BioAuthStage, coerceAuthType, filterAuthTypes } from './hooks';
import AutoLockView from '../AutoLockView';
import { APP_TEST_PWD } from '@/constant';

const SIZES = {
  /* input:(pt:24+h:48) + errorText:(mt:12+h:20) + pb:24 */
  inputAndBioAreaHeight: 128,
  inputHeight: 48,
  inputBioButtonHeight: 48,
  bioAuthContainerHeight: 64,
  bioAuthButtonSize: 48,
};

export interface AuthenticationModalProps extends ValidationBehaviorProps {
  confirmText?: string;
  cancelText?: string;
  title: string;
  description?: string;
  checklist?: string[];
  placeholder?: string;
  onCancel?(): void;
  disableValidation?: boolean;
  authType?:
    | Exclude<apisLock.UIAuthType, 'none'>[]
    | (apisLock.UIAuthType & 'none')[];
  tryBiometricsFirst?: boolean;
}

function BioButton({
  disabled,
  handlePress,
  iconProps,
}: {
  disabled?: boolean;
  handlePress(): void;
  iconProps?: React.ComponentProps<typeof BiometricsIcon>;
}) {
  return (
    <TouchableView
      style={[
        {
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: SIZES.inputBioButtonHeight,
        },
        disabled && { opacity: 0.5 },
      ]}
      disabled={disabled}
      onPress={handlePress}>
      <BiometricsIcon {...iconProps} size={20} />
    </TouchableView>
  );
}

type AuthState = {
  authType: apisLock.UIAuthType;
};

function FooterButtonGroup({
  onCancel,
  onConfirm,
  authState,
  bioActive,
  style,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  authState: AuthState;
  bioActive?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { styles: footerStyles, colors } = useThemeStyles(getFooterStyle);

  const { showConfirm } = useMemo(() => {
    return {
      // showCancel: ['none', 'password', 'biometrics'].includes(currentAuthType),
      showConfirm: ['none', 'password', 'biometrics'].includes(
        authState.authType,
      ),
    };
  }, [authState.authType]);

  return (
    <View style={StyleSheet.flatten([footerStyles.buttonGroup, style])}>
      <Button
        title={t('global.Cancel')}
        containerStyle={footerStyles.btnContainer}
        buttonStyle={footerStyles.cancelStyle}
        titleStyle={footerStyles.cancelTitleStyle}
        onPress={onCancel ?? noop}
      />
      {showConfirm && (
        <>
          <View style={footerStyles.btnGap} />
          <Button
            icon={ctx =>
              authState.authType !== 'biometrics' ? null : (
                <BiometricsIcon
                  size={18}
                  color={bioActive ? '#FF2D55' : ctx.titleStyle?.color}
                />
              )
            }
            iconContainerStyle={footerStyles.confirmIconStyle}
            title={t('global.Confirm')}
            containerStyle={footerStyles.btnContainer}
            buttonStyle={footerStyles.confirmStyle}
            titleStyle={footerStyles.confirmTitleStyle}
            onPress={onConfirm}
            disabled={disabled}
          />
        </>
      )}
    </View>
  );
}

const getFooterStyle = createGetStyles(colors => {
  return {
    buttonGroup: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopColor: colors['neutral-line'],
      // borderTopWidth: StyleSheet.hairlineWidth,
      borderTopWidth: 0.5,
      backgroundColor: colors['neutral-bg1'],
    },

    btnContainer: {
      flex: 1,
      height: 50,
    },

    cancelStyle: {
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: 8,
      height: '100%',
      width: '100%',
    },
    cancelTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['blue-default'],
      flex: 1,
    },
    btnGap: {
      width: 13,
    },
    confirmIconStyle: {
      marginLeft: 0,
      marginRight: 6,
      // ...makeDebugBorder(),
    },
    confirmStyle: {
      backgroundColor: colors['blue-default'],
      borderRadius: 8,
      width: '100%',
      height: '100%',
      // ...makeDebugBorder(),
      justifyContent: 'center',
      flexDirection: 'row',
      alignItems: 'center',
    },
    confirmTitleStyle: {
      // ...makeDebugBorder('yellow'),
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['neutral-title2'],
      // flex: 1,
    },
  };
});

const DFLT_VALIDATE = async (password: string) => {
  return apisLock.throwErrorIfInvalidPwd(password);
};

export const AuthenticationModal = ({
  title,
  onFinished,
  validationHandler = DFLT_VALIDATE,
  description,
  placeholder,
  $createParams,
  checklist,
  // disableValidation: propNoValidation = !validationHandler,
  authType: authTypes = /* propNoValidation ? ['none'] :  */ [
    'biometrics',
    'password',
  ],
}: GlobalModalViewProps<
  MODAL_NAMES.AUTHENTICATION,
  AuthenticationModalProps
>) => {
  const { t } = useTranslation();
  const { styles, colors } = useThemeStyles(getStyle);
  const { safeSizes } = useSafeAndroidBottomSizes({
    footerButtonGroupMb: 12,
  });

  const { isUseCustomPwd } = usePasswordStatus();
  const bioComputed = useBiometricsComputed();

  const [checklistState, setChecklistState] = React.useState<boolean[]>(
    checklist?.map(() => (__DEV__ ? true : false)) ?? [],
  );
  const hasCheckFailed = checklistState.includes(false);

  const [password, setPassword] = React.useState(APP_TEST_PWD);
  const [error, setError] = React.useState<string>();

  const onFinishedReturnBase = useMemo(
    () => ({ hasSetupCustomPassword: isUseCustomPwd }),
    [isUseCustomPwd],
  );

  const { availableAuthTypes, disableValidation } = useMemo(() => {
    return filterAuthTypes(authTypes, {
      isBiometricsEnabled: bioComputed.isBiometricsEnabled,
      isUseCustomPwd,
    });
  }, [authTypes, isUseCustomPwd, bioComputed.isBiometricsEnabled]);

  const { stateRef: bioAuthRef, setRefState: setBioAuth } = useRefState({
    stage: BioAuthStage.idle,
    restCount: 0,
  });
  const [currentAuthType, setCurrentAuthType] = React.useState<
    AuthState['authType']
  >(coerceAuthType(availableAuthTypes[0], availableAuthTypes));

  const handleSubmitForm = React.useCallback(async () => {
    if (hasCheckFailed) return;

    try {
      if (!disableValidation) {
        await validationHandler?.(password);
        apisLock.updateUnlockTime();
      }
      onFinished?.({
        ...onFinishedReturnBase,
        authType: 'password',
        getValidatedPassword: () => password,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  }, [
    hasCheckFailed,
    disableValidation,
    onFinishedReturnBase,
    onFinished,
    password,
    validationHandler,
  ]);

  const handleSwitchToBioAndPrepare = React.useCallback(
    (noPrepare = true) => {
      setCurrentAuthType('biometrics');
      !noPrepare &&
        setBioAuth(prev => ({
          ...prev,
          stage: BioAuthStage['prepare'],
          restCount: 0,
        }));
    },
    [setCurrentAuthType, setBioAuth],
  );

  React.useEffect(() => {
    setError('');
  }, [password]);

  // useMount(() => {
  //   if (currentAuthType === 'biometrics' && !hasCheckFailed) {
  //     setBioAuth(prev => ({
  //       ...prev,
  //       // stage: BioAuthStage['prepare'],
  //       restCount: 0,
  //     }));
  //   }
  // });

  const handleAuthWithBiometrics = React.useCallback(async () => {
    if (hasCheckFailed) return;

    if (bioAuthRef.current.stage === BioAuthStage['authenticating']) return;

    setBioAuth(prev => ({ ...prev, stage: BioAuthStage['authenticating'] }));

    try {
      if (!disableValidation) {
        await apisKeychain.requestGenericPassword({
          purpose: apisKeychain.RequestGenericPurpose.DECRYPT_PWD,
          onPlainPassword: async password => {
            await validationHandler?.(password);
            onFinished?.({
              ...onFinishedReturnBase,
              authType: 'biometrics',
              getValidatedPassword: () => password,
            });
          },
        });
      }
    } catch (err: any) {
      console.error(err);
      setCurrentAuthType('password');
      // setError(err.message);
    } finally {
      setBioAuth(prev => ({
        ...prev,
        stage: BioAuthStage['idle'],
        restCount: 0,
      }));
    }
  }, [
    hasCheckFailed,
    bioAuthRef,
    setBioAuth,
    disableValidation,
    validationHandler,
    onFinished,
    onFinishedReturnBase,
  ]);

  const handleConfirm = useCallback(() => {
    if (currentAuthType === 'biometrics') {
      setBioAuth(prev => ({
        ...prev,
        stage: BioAuthStage['prepare'],
        restCount: 1,
      }));
      setTimeout(handleAuthWithBiometrics, 100);
    } else {
      handleSubmitForm();
    }
  }, [currentAuthType, setBioAuth, handleAuthWithBiometrics, handleSubmitForm]);

  const prevHasCheckFailed = usePrevious(hasCheckFailed);
  React.useEffect(() => {
    if (!bioComputed.isBiometricsEnabled) return;
    if (currentAuthType !== 'biometrics') return;
    if (bioAuthRef.current.restCount <= 0) return;

    if (prevHasCheckFailed && !hasCheckFailed) {
      setBioAuth(prev => ({ ...prev, stage: BioAuthStage['prepare'] }));
    }

    const timer = setTimeout(handleAuthWithBiometrics, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [
    bioAuthRef,
    bioComputed.isBiometricsEnabled,
    currentAuthType,
    handleAuthWithBiometrics,

    prevHasCheckFailed,
    hasCheckFailed,
    setBioAuth,
  ]);

  return (
    <AutoLockView>
      <AppBottomSheetModalTitle style={styles.modalTitle} title={title} />

      <View style={styles.main}>
        {description && (
          <View style={styles.descWrapper}>
            <Text style={styles.description}>{description}</Text>
          </View>
        )}

        {checklist && checklist?.length > 0 && (
          <View style={styles.checklist}>
            {checklist.map((item, index) => (
              <CheckItem
                onPress={() => {
                  const newState = [...checklistState];
                  newState[index] = !newState[index];
                  setChecklistState(newState);
                }}
                checked={checklistState[index]}
                label={item}
                key={index}
              />
            ))}
          </View>
        )}

        <View
          style={[
            styles.inputAndBioArea,
            currentAuthType === 'password' && styles.inputAreaWithPwd,
            currentAuthType === 'biometrics' && styles.inputAreaWithBio,
            disableValidation && styles.noValidationArea,
          ]}>
          {!disableValidation && currentAuthType === 'password' && (
            <>
              <View style={styles.inputWrapper}>
                <BottomSheetTextInput
                  secureTextEntry
                  returnKeyLabel={t('global.Confirm')}
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor={colors['neutral-foot']}
                  style={StyleSheet.flatten([
                    styles.input,
                    bioComputed.isBiometricsEnabled && styles.inputWithAddOn,
                    error ? styles.errorInput : {},
                    // makeDebugBorder('yellow')
                  ])}
                  placeholder={
                    placeholder ??
                    t('component.AuthenticationModal.passwordPlaceholder')
                  }
                />
                {__DEV__ && bioComputed.isBiometricsEnabled && (
                  <BioButton
                    disabled={hasCheckFailed}
                    handlePress={handleSwitchToBioAndPrepare}
                  />
                )}
              </View>
              <Text style={styles.errorText}>{error}</Text>
            </>
          )}
          {/* {!disableValidation && currentAuthType === 'biometrics' && (
            <View style={styles.bioIconWrapper}>
              <BioButton
                disabled={hasCheckFailed}
                handlePress={handleSwitchToBioAndPrepare}
                iconProps={{
                  color:
                    bioAuthRef.current.stage !== BioAuthStage['idle']
                      ? 'blue-default'
                      : 'neutral-body',
                  style: {
                    height: SIZES.bioAuthButtonSize,
                    width: SIZES.bioAuthButtonSize,
                  },
                }}
              />
            </View>
          )} */}
        </View>
      </View>
      <FooterButtonGroup
        authState={{ authType: currentAuthType }}
        // bioActive={bioAuthRef.current.stage !== BioAuthStage['idle']}
        style={StyleSheet.flatten([
          styles.footerButtonGroup,
          { marginBottom: safeSizes.footerButtonGroupMb },
        ])}
        onCancel={$createParams.onCancel ?? noop}
        onConfirm={handleConfirm}
        disabled={hasCheckFailed}
      />
    </AutoLockView>
  );
};

AuthenticationModal.show = async (
  showConfig: AuthenticationModalProps & {
    closeDuration?: number;
  },
) => {
  const { closeDuration = IS_IOS ? 0 : 300, onCancel, ...props } = showConfig;
  let disableValidation = showConfig.disableValidation;
  const lockInfo = await apisLock.getRabbyLockInfo();
  if (!lockInfo.isUseCustomPwd) {
    // enforce disableValidation to be false if the app doesn't have a custom password
    disableValidation = true;
  } else if (typeof showConfig.disableValidation !== 'boolean') {
    disableValidation = false;
  }

  const id = createGlobalBottomSheetModal({
    name: MODAL_NAMES.AUTHENTICATION,
    bottomSheetModalProps: {
      enableDynamicSizing: true,
    },
    ...props,
    onCancel: () => {
      try {
        onCancel?.();
      } catch (err) {
        console.error(err);
      }
      hideModal();
    },
    disableValidation,
    onFinished(ctx) {
      hideModal();
      props.onFinished?.(ctx);
    },
  });

  const hideModal = () => {
    return removeGlobalBottomSheetModal(id, { duration: closeDuration });
  };
  return { hideModal };
};

const getStyle = createGetStyles(colors => {
  return {
    modalTitle: { marginBottom: 0, paddingTop: 12 },
    description: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: 'center',
    },
    checklist: {
      gap: 12,
      marginBottom: 24,
    },
    main: {
      paddingHorizontal: 20,
      minHeight: 40,
      // ...makeDebugBorder(),
    },
    descWrapper: {
      marginTop: 16,
    },
    inputAndBioArea: {
      // ...makeDebugBorder(),
    },
    inputAreaWithPwd: {
      paddingTop: 24,
      paddingBottom: 24,
      height: SIZES.inputAndBioAreaHeight,
    },
    inputAreaWithBio: {
      height: 12,
    },
    noValidationArea: {
      paddingTop: 0,
      paddingBottom: 0,
      height: 12,
    },
    inputWrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      height: SIZES.inputHeight,
      borderStyle: 'solid',
      backgroundColor: colors['neutral-card-2'],
      padding: 15,
      borderRadius: 8,
      width: '100%',
      paddingVertical: 0,
      paddingHorizontal: 0,
      // ...makeDebugBorder(),
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
      backgroundColor: 'transparent',
      borderRadius: 8,
      marginBottom: 0,
      color: colors['neutral-title-1'],
      height: '100%',
      width: '100%',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    inputWithAddOn: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      padding: 0,
      paddingRight: 10,
    },
    errorInput: {
      borderColor: colors['red-default'],
    },
    errorText: {
      color: colors['red-default'],
      marginTop: 12,
      fontSize: 14,
      minHeight: 20,
    },

    bioIconWrapper: {
      height: SIZES.bioAuthContainerHeight,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    footerButtonGroup: {
      // ...makeDebugBorder('yellow'),
    },
  };
});
