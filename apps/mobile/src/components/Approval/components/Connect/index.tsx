import { Button } from '@/components/Button';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { CHAINS_ENUM } from '@debank/common';
import React from 'react';
import { Text, View } from 'react-native';

export const Connect = () => {
  const [, resolveApproval, rejectApproval] = useApproval();
  const currentUser = useCurrentAccount();
  const colors = useThemeColors();
  const [defaultChain, setDefaultChain] = React.useState(CHAINS_ENUM.ETH);

  const handleAllow = async () => {
    resolveApproval({
      defaultChain,
    });
  };

  return (
    <View>
      <Text
        style={{
          fontSize: 30,
        }}>
        Connect
      </Text>
      <Text>{currentUser.currentAccount?.address}</Text>
      <Button
        onPress={handleAllow}
        title="Connect"
        titleStyle={{
          color: colors['neutral-title-2'],
        }}
        buttonStyle={{
          backgroundColor: colors['blue-default'],
          padding: 10,
        }}
      />
    </View>
  );
};
