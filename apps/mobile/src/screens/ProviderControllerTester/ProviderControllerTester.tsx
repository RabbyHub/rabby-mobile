/**
 * Sample React Native ProviderControllerTester
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import type { PropsWithChildren } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
} from 'react-native/Libraries/NewAppScreen';

import { useGetAppThemeMode, useThemeColors } from '@/hooks/theme';
import { Button } from '@/components';
import { sendRequest } from '@/core/apis/sendRequest';
import { useDapps } from '@/hooks/useDapps';
import { CHAINS_ENUM } from '@debank/common';
import { toast } from '@/components/Toast';
import { useCurrentAccount } from '@/hooks/account';
import { apisWalletConnect } from '@/core/apis';

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({ children, title }: SectionProps): JSX.Element {
  const isDarkMode = useGetAppThemeMode() === 'dark';

  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function StyledButton({
  title,
  onPress,
  disabled,
}: {
  disabled?: boolean;
  title: string;
  onPress?: () => void;
}) {
  const colors = useThemeColors();

  const buttonStyles = {
    backgroundColor: colors['blue-default'],
    color: colors['neutral-title-2'],
    margin: 5,
    padding: 10,
  };
  return (
    <Button
      disabled={disabled}
      onPress={onPress}
      titleStyle={{ color: colors['neutral-title-2'] }}
      buttonStyle={buttonStyles}
      type="primary"
      title={title}
    />
  );
}

const TEST_DAPP_INFO = {
  description:
    'Galxe is the leading platform for building Web3 community. With over 14 million active users, Galxe has propelled the growth of Optimism, Polygon, Arbitrum, and more than 4000 partners with reward-based loyalty programs.',
  id: 'metamask.github.io',
  logo_url:
    'https://static.debank.com/image/project/logo_url/galxe/90baa6ae2cb97b4791f02fe66abec4b2.png',
  name: 'Metamask',
  tags: [],
  user_range: 'User >10k',
};

const TEST_SESSION = {
  origin: TEST_DAPP_INFO.id,
  name: TEST_DAPP_INFO.name,
  icon: TEST_DAPP_INFO.logo_url,
};

function ProviderControllerTester(): JSX.Element {
  const isDarkMode = useGetAppThemeMode() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const { addDapp } = useDapps();
  const [account, setAccount] = React.useState<string>();
  const { currentAccount } = useCurrentAccount();
  const [connectStatus, setConnectStatus] = React.useState<string>();

  const handleConnect = React.useCallback(() => {
    sendRequest(
      {
        method: 'eth_requestAccounts',
      },
      TEST_SESSION,
    )
      .then(res => {
        console.log(res);
        setAccount(res[0]);
      })
      .catch(e => {
        console.error(e);
      });
  }, []);

  const handlePersonalSign = React.useCallback(() => {
    sendRequest(
      {
        method: 'personal_sign',
        params: [
          '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
          account,
          'Example password',
        ],
      },
      TEST_SESSION,
    )
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  }, [account]);

  const handleSendEth = React.useCallback(() => {
    sendRequest(
      {
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: '0x0c54FcCd2e384b4BB6f2E405Bf5Cbc15a017AaFb',
            value: '0x0',
            gasLimit: '0x5028',
            maxFeePerGas: '0x2540be400',
            maxPriorityFeePerGas: '0x3b9aca00',
          },
        ],
      },
      TEST_SESSION,
    )
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  }, [account]);

  React.useEffect(() => {
    addDapp({
      info: TEST_DAPP_INFO,
      chainId: CHAINS_ENUM.ETH,
    });
  }, [addDapp]);

  React.useEffect(() => {
    if (account && currentAccount && currentAccount.type === 'WalletConnect') {
      apisWalletConnect
        .checkClientIsCreate(currentAccount)
        .then(res => {
          setConnectStatus(res ?? 'DISCONNECTED');
        })
        .catch(e => {
          console.error(e);
        });
    } else {
      setConnectStatus('CONNECTED');
    }
  }, [account, currentAccount]);

  const isClientCreated = React.useMemo(() => {
    return !!connectStatus;
  }, [connectStatus]);

  return (
    <SafeAreaView style={backgroundStyle}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <Header />
        <View>
          <Section title="Basic Actions">
            <StyledButton onPress={handleConnect} title="CONNECT" />
            <Text>{account}</Text>
            <Text>Connect status: {connectStatus}</Text>
          </Section>
          <Section title="Personal Sign">
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handlePersonalSign}
              title="SIGN"
            />
          </Section>
          <Section title="Send Eth">
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleSendEth}
              title="Send EIP 1559 Transaction"
            />
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default ProviderControllerTester;
