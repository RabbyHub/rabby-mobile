/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { StyleSheet, Text, View, Pressable, Image } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Card } from '@/components2024/Card';

import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

import SeedPhraseIcon from '@/assets2024/icons/common/seed-phrase.svg';
import PrivateKeyIcon from '@/assets2024/icons/common/private-key.svg';
import HardWareIcon from '@/assets2024/icons/common/IconHardWare.png';
// TODO: replace to svg
// import HardWareIcon from '@/assets2024/icons/common/IconHardWare.svg';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useNavigationState } from '@react-navigation/native';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { trigger } from 'react-native-haptic-feedback';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';

function ImportMethods(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();
  const { t } = useTranslation();

  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ImportMethods)?.params,
  ) as
    | {
        isNotNewUserProc?: boolean; // if has address
      }
    | undefined;
  // const state = undefined;

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
        <View
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
              hasArrow={state?.isNotNewUserProc}
              onPress={async () => {
                trigger('impactLight', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
                if (
                  // only has address in this set password
                  state?.isNotNewUserProc &&
                  (await shouldRedirectToSetPasswordBefore2024({
                    backScreen: RootNames.ImportMnemonic2024,
                  }))
                ) {
                  return;
                }

                navigate(RootNames.StackAddress, {
                  screen: RootNames.ImportMnemonic2024,
                });
              }}>
              <SeedPhraseIcon style={styles.icon} />
              <Text style={styles.importType}>
                {t('page.nextComponent.importAddress.seedPhrase')}
              </Text>
            </Card>
            <Card
              hasArrow={state?.isNotNewUserProc}
              style={styles.importItem}
              onPress={async () => {
                trigger('impactLight', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
                if (
                  state?.isNotNewUserProc &&
                  (await shouldRedirectToSetPasswordBefore2024({
                    backScreen: RootNames.ImportPrivateKey2024,
                  }))
                ) {
                  return;
                }

                navigate(RootNames.StackAddress, {
                  screen: RootNames.ImportPrivateKey2024,
                });
              }}>
              <PrivateKeyIcon style={styles.icon} />
              <Text style={styles.importType}>
                {t('page.nextComponent.importAddress.privateKey')}
              </Text>
            </Card>
            {state?.isNotNewUserProc && (
              <>
                <Text style={styles.titleText}>
                  {t('page.nextComponent.importAddress.safeTitle')}
                </Text>
                <Card
                  hasArrow={state?.isNotNewUserProc}
                  style={styles.importItem}
                  onPress={() => {
                    trigger('impactLight', {
                      enableVibrateFallback: true,
                      ignoreAndroidSystemSettings: false,
                    });

                    navigate(RootNames.StackAddress, {
                      screen: RootNames.ImportSafeAddress2024,
                    });
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
                  hasArrow={state?.isNotNewUserProc}
                  style={styles.importItem}
                  onPress={() => {
                    trigger('impactLight', {
                      enableVibrateFallback: true,
                      ignoreAndroidSystemSettings: false,
                    });

                    navigate(RootNames.StackAddress, {
                      screen: RootNames.ImportWatchAddress2024,
                    });
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
                hasArrow={state?.isNotNewUserProc}
                style={styles.importItem}
                onPress={() => {
                  trigger('impactLight', {
                    enableVibrateFallback: true,
                    ignoreAndroidSystemSettings: false,
                  });

                  navigate(RootNames.StackAddress, {
                    screen: RootNames.ImportHardwareAddress,
                  });
                }}>
                <Image source={HardWareIcon} style={styles.icon} />
                <Text style={styles.importType}>
                  {t('page.nextComponent.importAddress.hardWare')}
                </Text>
              </Card>
            )}
          </View>
        </View>
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
