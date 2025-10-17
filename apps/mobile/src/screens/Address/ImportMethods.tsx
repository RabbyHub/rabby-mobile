/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  ScrollView,
  Keyboard,
} from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Card } from '@/components2024/Card';

import { RootNames } from '@/constant/layout';

import SeedPhraseIcon from '@/assets2024/icons/common/seed-phrase.svg';
import PrivateKeyIcon from '@/assets2024/icons/common/private-key.svg';
import HardWareIcon from '@/assets2024/icons/common/IconHardWare.png';
// TODO: replace to svg
// import HardWareIcon from '@/assets2024/icons/common/IconHardWare.svg';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import IconSyncRabby from '@/assets2024/icons/common/iconSyncExtension.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { trigger } from 'react-native-haptic-feedback';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { IS_IOS } from '@/core/native/utils';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

function ImportMethods(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();
  const { t } = useTranslation();
  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const route =
    useRoute<
      GetNestedScreenRouteProp<'AddressNavigatorParamList', 'ImportMethods'>
    >();
  const state = route.params;

  const onPressCloud = React.useCallback(() => {
    Keyboard.dismiss();
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.RESTORE_FROM_CLOUD,
      shouldRedirect2SetPassword: shouldRedirectToSetPasswordBefore2024,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024]);

  const CloudImageSrc = React.useMemo(() => {
    if (IS_IOS) {
      return require('@/assets2024/icons/common/IconIcloud.png');
    }
    return require('@/assets2024/icons/common/IconGoogleDrive.png');
  }, []);

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
        style={{
          width: '100%',
          height: '100%',
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={StyleSheet.flatten([
            styles.blockView,
            state?.isNotNewUserProc && styles.noMarginTop,
          ])}>
          <View style={styles.section}>
            {state?.isNotNewUserProc && (
              <Text style={styles.titleText}>
                {t('page.nextComponent.importAddress.importTitle')}
              </Text>
            )}
            <Card
              style={styles.importItem}
              // hasArrow={state?.isNotNewUserProc}
              onPress={async () => {
                if (
                  // only has address in this set password
                  state?.isNotNewUserProc &&
                  (await shouldRedirectToSetPasswordBefore2024({
                    backScreen: RootNames.ImportMnemonic2024,
                  }))
                ) {
                  return;
                }

                navigation.dispatch(
                  StackActions.push(RootNames.StackAddress, {
                    screen: RootNames.ImportMnemonic2024,
                    params: {},
                  }),
                );

                !state?.isNotNewUserProc &&
                  preferenceService.setReportActionTs(
                    REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE,
                  );
              }}>
              <SeedPhraseIcon style={styles.icon} />
              <Text style={styles.importType}>
                {t('page.nextComponent.importAddress.seedPhrase')}
              </Text>
            </Card>
            <Card
              // hasArrow={state?.isNotNewUserProc}
              style={styles.importItem}
              onPress={async () => {
                if (
                  state?.isNotNewUserProc &&
                  (await shouldRedirectToSetPasswordBefore2024({
                    backScreen: RootNames.ImportPrivateKey2024,
                  }))
                ) {
                  return;
                }

                navigation.dispatch(
                  StackActions.push(RootNames.StackAddress, {
                    screen: RootNames.ImportPrivateKey2024,
                    params: {},
                  }),
                );

                !state?.isNotNewUserProc &&
                  preferenceService.setReportActionTs(
                    REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_PRIVATE_KEY,
                  );
              }}>
              <PrivateKeyIcon style={styles.icon} />
              <Text style={styles.importType}>
                {t('page.nextComponent.importAddress.privateKey')}
              </Text>
            </Card>
            <Card
              // hasArrow={state?.isNotNewUserProc}
              style={styles.importItem}
              onPress={async () => {
                onPressCloud();
              }}>
              <Image
                style={{
                  width: 40,
                  height: 40,
                }}
                source={CloudImageSrc}
              />

              {/* <PrivateKeyIcon style={styles.icon} /> */}
              <Text style={styles.importType}>
                {t('page.nextComponent.importAddress.ImportCloud', {
                  cloud: IS_IOS ? 'iCloud' : 'Google Drive',
                })}
              </Text>
            </Card>
            {state?.isFromEmptyAddress && (
              <>
                <Card
                  // hasArrow={state?.isNotNewUserProc}
                  style={styles.importItem}
                  onPress={() => {
                    navigation.dispatch(
                      StackActions.push(RootNames.StackAddress, {
                        screen: RootNames.ImportHardwareAddress,
                        params: {},
                      }),
                    );
                  }}>
                  <Image source={HardWareIcon} style={styles.icon} />
                  <Text style={styles.importType}>
                    {t('page.nextComponent.addAddress.hardwareWallet')}
                  </Text>
                </Card>
                <Card
                  // hasArrow={state?.isNotNewUserProc}
                  style={styles.importItem}
                  onPress={() => {
                    navigation.dispatch(
                      StackActions.push(RootNames.Scanner, {
                        syncExtension: true,
                      }),
                    );

                    preferenceService.setReportActionTs(
                      REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION,
                    );
                  }}>
                  <IconSyncRabby style={styles.icon} />
                  <Text style={styles.importType}>
                    {t('page.nextComponent.addAddress.syncRabbyExtension')}
                  </Text>
                </Card>
              </>
            )}
            {state?.isNotNewUserProc && (
              <>
                <Text style={styles.titleText}>
                  {t('page.nextComponent.importAddress.safeTitle')}
                </Text>
                <Card
                  // hasArrow={state?.isNotNewUserProc}
                  style={styles.importItem}
                  onPress={() => {
                    navigation.dispatch(
                      StackActions.push(RootNames.StackAddress, {
                        screen: RootNames.ImportSafeAddress2024,
                        params: {},
                      }),
                    );
                  }}>
                  <WalletIcon
                    type={KEYRING_TYPE.GnosisKeyring}
                    width={40}
                    height={40}
                    style={styles.icon}
                  />
                  <Text style={styles.importType}>
                    {t('page.nextComponent.importAddress.safe')}
                  </Text>
                </Card>
                <Text style={styles.titleText}>
                  {t('page.nextComponent.importAddress.watchOnlyTitle')}
                </Text>
                <Card
                  // hasArrow={state?.isNotNewUserProc}
                  style={styles.importItem}
                  onPress={() => {
                    navigation.dispatch(
                      StackActions.push(RootNames.StackAddress, {
                        screen: RootNames.ImportWatchAddress2024,
                        params: {},
                      }),
                    );
                  }}>
                  <WalletIcon
                    type={KEYRING_TYPE.WatchAddressKeyring}
                    width={40}
                    height={40}
                    style={styles.icon}
                  />
                  <Text style={styles.importType}>
                    {t('page.nextComponent.importAddress.watch')}
                  </Text>
                </Card>
              </>
            )}

            {!state?.isNotNewUserProc && (
              <Card
                // hasArrow={state?.isNotNewUserProc}
                style={styles.importItem}
                onPress={() => {
                  navigation.dispatch(
                    StackActions.push(RootNames.StackAddress, {
                      screen: RootNames.ImportHardwareAddress,
                      params: {},
                    }),
                  );

                  preferenceService.setReportActionTs(
                    REPORT_TIMEOUT_ACTION_KEY.CLICK_CONNECT_HARDWARE,
                  );
                }}>
                <Image source={HardWareIcon} style={styles.icon} />
                <Text style={styles.importType}>
                  {t('page.nextComponent.importAddress.hardWare')}
                </Text>
              </Card>
            )}
          </View>
        </ScrollView>
        {!state?.isNotNewUserProc && (
          <Pressable
            style={styles.tipWrapper}
            onPress={() => {
              const modalId = createGlobalBottomSheetModal2024({
                name: MODAL_NAMES.DESCRIPTION,
                bottomSheetModalProps: {
                  enableDismissOnClose: true,
                  snapPoints: ['40%'],
                  enableContentPanningGesture: true,
                  enablePanDownToClose: true,
                },
                title: t('page.nextComponent.importAddress.tips.title'),
                sections: [
                  {
                    description: t(
                      'page.nextComponent.importAddress.tips.description',
                    ),
                  },
                ],
                nextButtonProps: {
                  title: (
                    <Text style={styles.modalNextButtonText}>
                      {t('page.nextComponent.importAddress.tips.gotIt')}
                    </Text>
                  ),
                  titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
                  onPress: () => {
                    removeGlobalBottomSheetModal2024(modalId);
                  },
                },
              });
            }}>
            <Text style={styles.tip}>
              {t('page.nextComponent.importAddress.tips.entry')}
            </Text>
            <HelpIcon style={styles.tipIcon} />
          </Pressable>
        )}
      </LinearGradient>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  icon: {
    width: 40,
    height: 40,
  },
  noMarginTop: {
    marginTop: 0,
  },
  blockView: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 34,
  },
  section: {
    marginBottom: 20,
  },
  importItem: {
    display: 'flex',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  importType: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tipWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    position: 'absolute',
    bottom: 67,
  },
  tip: {
    color: ctx.colors2024['neutral-info'],
    fontWeight: '400',
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
  },
  tipIcon: {
    width: 16,
    height: 16,
  },
  titleText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'left',
    color: ctx.colors2024['neutral-secondary'],
    marginTop: 20,
    marginBottom: 12,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    backgroundColor: ctx.colors2024['brand-default'],
    color: ctx.colors2024['neutral-InvertHighlight'],
  },
}));

export default ImportMethods;
