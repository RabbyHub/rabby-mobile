import React from 'react';
import { View } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';

function ImportRabbyWallet(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <View style={styles.container}>
        <Text style={styles.title}>Import Rabby Wallet</Text>
        <Text style={styles.subtitle}>
          This screen will handle the "I already use Rabby" flow.
        </Text>
      </View>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    flex: 1,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
  },
}));

export default ImportRabbyWallet;
