import React from 'react';
import { Text, View } from 'react-native';

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
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

function ImportMethods(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { shouldRedirectToSetPasswordBefore } = useSetPasswordFirst();

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <View style={[styles.blockView]}>
        <View style={styles.section}>
          <Card
            style={styles.importItem}
            onPress={() => {
              if (
                shouldRedirectToSetPasswordBefore({
                  screen: RootNames.ImportMnemonic,
                })
              ) {
                return;
              }
              navigate(RootNames.StackAddress, {
                screen: RootNames.ImportMnemonic,
              });
            }}>
            <SeedPhraseIcon style={styles.icon} />
            <Text style={styles.importType}>Import Seed Phrase</Text>
          </Card>
          <Card
            style={styles.importItem}
            onPress={() => {
              if (
                shouldRedirectToSetPasswordBefore({
                  screen: RootNames.ImportPrivateKey,
                })
              ) {
                return;
              }

              navigate(RootNames.StackAddress, {
                screen: RootNames.ImportPrivateKey,
              });
            }}>
            <PrivateKeyIcon style={styles.icon} />
            <Text style={styles.importType}>Import Private Key</Text>
          </Card>
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
        </View>
      </View>
      <View style={styles.tipWrapper}>
        <Text style={styles.tip}>Is it safe to import into Rabby</Text>
        <HelpIcon
          style={styles.tipIcon}
          onPress={() => {
            createGlobalBottomSheetModal2024({
              name: MODAL_NAMES.DESCRIPTION,
              title: 'Is it safe to import it in Rabby?',
              sections: [
                {
                  title: 'Unique Identifier',
                  description:
                    'A Web3 wallet address is a unique string of characters that represents your identity on the blockchain.',
                },
                {
                  title: 'Send and Receive Crypto',
                  description:
                    'It allows you to send, receive, and store cryptocurrencies securely.',
                },
                {
                  title: 'Access dApps',
                  description:
                    'Your wallet address is used to connect to decentralized applications (dApps) and interact with blockchain-based services.',
                },
                {
                  title: 'Ownership and Control',
                  description:
                    'You fully own and control the assets linked to your address, with access secured by private keys or recovery phrases.',
                },
              ],
            });
          }}
        />
      </View>
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
}));

export default ImportMethods;
