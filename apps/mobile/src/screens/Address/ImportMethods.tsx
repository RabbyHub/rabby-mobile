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
          <Card style={styles.importItem}>
            <HardWareIcon style={styles.icon} />
            <Text style={styles.importType}>Connect Hardware Wallets</Text>
          </Card>
        </View>
      </View>
      <View style={styles.tipWrapper}>
        <Text style={styles.tip}>Is it safe to import into Rabby</Text>
        {/* TODO: show BottomSheet */}
        <HelpIcon style={styles.tipIcon} />
      </View>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
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
