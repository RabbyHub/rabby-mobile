import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Card } from '@/components2024/Card';

import { useSetPasswordFirst } from '@/hooks/useLock';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

import SeedPhraseIcon from '@/assets2024/icons/common/seed-phrase.svg';
import PrivateKeyIcon from '@/assets2024/icons/common/private-key.svg';
import HardWareIcon from '@/assets2024/icons/common/hardward.svg';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useNavigationState } from '@react-navigation/native';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

function ImportMethods(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ImportMethods)?.params,
  ) as
    | {
        hasCurrentAddress?: boolean; // if has address
      }
    | undefined;
  // const state = undefined;

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <View
        style={StyleSheet.flatten([
          styles.blockView,
          state?.hasCurrentAddress && styles.noMarginTop,
        ])}>
        <View style={styles.section}>
          {state?.hasCurrentAddress && (
            <Text style={styles.titleText}>Import Address</Text>
          )}
          <Card
            style={styles.importItem}
            onPress={() => {
              if (
                shouldRedirectToSetPasswordBefore2024({
                  backScreen: RootNames.ImportMnemonic2024,
                })
              ) {
                return;
              }
              navigate(RootNames.StackAddress, {
                screen: RootNames.ImportMnemonic2024,
              });
            }}>
            <SeedPhraseIcon style={styles.icon} />
            <Text style={styles.importType}>Import Seed Phrase</Text>
          </Card>
          <Card
            style={styles.importItem}
            onPress={() => {
              if (
                shouldRedirectToSetPasswordBefore2024({
                  backScreen: RootNames.ImportPrivateKey2024,
                })
              ) {
                return;
              }

              navigate(RootNames.StackAddress, {
                screen: RootNames.ImportPrivateKey2024,
              });
            }}>
            <PrivateKeyIcon style={styles.icon} />
            <Text style={styles.importType}>Import Private Key</Text>
          </Card>
          {state?.hasCurrentAddress && (
            <>
              <Text style={styles.titleText}>Import Safe Address</Text>
              <Card
                style={styles.importItem}
                onPress={() => {
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
                <Text style={styles.importType}>Safe</Text>
              </Card>
              <Text style={styles.titleText}>Import Watch-only Address</Text>
              <Card
                style={styles.importItem}
                onPress={() => {
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
                <Text style={styles.importType}>Watch-only Address</Text>
              </Card>
            </>
          )}

          {!state?.hasCurrentAddress && (
            <Card
              style={styles.importItem}
              onPress={() => {
                navigate(RootNames.StackAddress, {
                  screen: RootNames.ImportHardwareAddress,
                });
              }}>
              <HardWareIcon style={styles.icon} />
              <Text style={styles.importType}>Connect Hardware Wallets</Text>
            </Card>
          )}
        </View>
      </View>
      {!state?.hasCurrentAddress && (
        <View style={styles.tipWrapper}>
          <Text style={styles.tip}>Is it safe to import into Rabby</Text>
          <HelpIcon
            style={styles.tipIcon}
            onPress={() => {
              const modalId = createGlobalBottomSheetModal2024({
                name: MODAL_NAMES.DESCRIPTION,
                bottomSheetModalProps: {
                  enableDismissOnClose: true,
                  snapPoints: ['40%'],
                },
                title: 'Is it safe to import it in Rabby?',
                sections: [
                  {
                    description:
                      'Your data is securely encrypted and stored locally on your device. Rabby does not have access to your private information, and it is never shared with third parties.',
                  },
                ],
                nextButtonProps: {
                  title: (
                    <Text style={styles.modalNextButtonText}>I Got It.</Text>
                  ),
                  titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
                  onPress: () => {
                    removeGlobalBottomSheetModal2024(modalId);
                  },
                },
              });
            }}
          />
        </View>
      )}
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
    width: '92%',
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
  },
  tipWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    position: 'absolute',
    bottom: 67,
  },
  tip: {
    color: ctx.colors2024['neutral-info'],
    fontWeight: '400',
    fontSize: 16,
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
