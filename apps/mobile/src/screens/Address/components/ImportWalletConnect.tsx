import { Text } from '@/components';
import { apisWalletConnect } from '@/core/apis';
import React from 'react';
import { View } from 'react-native';

export const ImportWalletConnect = () => {
  const [uri, setUri] = React.useState<string>();
  React.useEffect(() => {
    apisWalletConnect.getUri('WalletConnect').then(setUri);
  }, []);
  return (
    <View>
      <Text>{uri}</Text>
      <Text>haha</Text>
    </View>
  );
};
