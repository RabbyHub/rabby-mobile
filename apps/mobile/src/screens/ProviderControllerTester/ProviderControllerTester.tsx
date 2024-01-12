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
    height: 50,
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

  const handlSignTransaction = React.useCallback(() => {
    sendRequest(
      {
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: account,
            value: '0x0',
            chainId: 1,
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

  const handleTypedDataSign = React.useCallback(() => {
    sendRequest(
      {
        method: 'eth_signTypedData',
        params: [
          [
            {
              type: 'string',
              name: 'Message',
              value: 'Hi, Alice!',
            },
            {
              type: 'uint32',
              name: 'A number',
              value: '1337',
            },
          ],
          account,
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

  const handleSellNFT = React.useCallback(() => {
    sendRequest(
      {
        method: 'eth_signTypedData_v4',
        params: [
          account,
          '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"OrderComponents":[{"name":"offerer","type":"address"},{"name":"zone","type":"address"},{"name":"offer","type":"OfferItem[]"},{"name":"consideration","type":"ConsiderationItem[]"},{"name":"orderType","type":"uint8"},{"name":"startTime","type":"uint256"},{"name":"endTime","type":"uint256"},{"name":"zoneHash","type":"bytes32"},{"name":"salt","type":"uint256"},{"name":"conduitKey","type":"bytes32"},{"name":"counter","type":"uint256"}],"OfferItem":[{"name":"itemType","type":"uint8"},{"name":"token","type":"address"},{"name":"identifierOrCriteria","type":"uint256"},{"name":"startAmount","type":"uint256"},{"name":"endAmount","type":"uint256"}],"ConsiderationItem":[{"name":"itemType","type":"uint8"},{"name":"token","type":"address"},{"name":"identifierOrCriteria","type":"uint256"},{"name":"startAmount","type":"uint256"},{"name":"endAmount","type":"uint256"},{"name":"recipient","type":"address"}]},"primaryType":"OrderComponents","domain":{"name":"Seaport","version":"1.5","chainId":"1","verifyingContract":"0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC"},"message":{"offerer":"0xF08C90C7f470B640a21DD9B3744eca3d1d16a044","offer":[{"itemType":"2","token":"0xF75FD01D2262b07D92dcA7f19bD6A3457060d7db","identifierOrCriteria":"3626","startAmount":"1","endAmount":"1"}],"consideration":[{"itemType":"1","token":"0xfe1ef2b469846d1832b25095ff51b004f090e0c6","identifierOrCriteria":"0","startAmount":"900000000000000000","endAmount":"900000000000000000","recipient":"0x5853ed4f26a3fcea565b3fbc698bb19cdf6deb85"},{"itemType":"1","token":"0xfe1ef2b469846d1832b25095ff51b004f090e0c6","identifierOrCriteria":"0","startAmount":"25000000000000000","endAmount":"25000000000000000","recipient":"0x0000a26b00c1F0DF003000390027140000fAa719"},{"itemType":"1","token":"0xfe1ef2b469846d1832b25095ff51b004f090e0c6","identifierOrCriteria":"0","startAmount":"75000000000000000","endAmount":"75000000000000000","recipient":"0xaa5a6eec8F785F8C4fEeb28057f1f4F37EC33C44"}],"startTime":"1686477774","endTime":"1689069774","orderType":"0","zone":"0x5853ed4f26a3fcea565b3fbc698bb19cdf6deb85","zoneHash":"0x0000000000000000000000000000000000000000000000000000000000000000","salt":"24446860302761739304752683030156737591518664810215442929806870165851630445366","conduitKey":"0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000","totalOriginalConsiderationItems":"3","counter":"0"}}',
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
      origin: TEST_DAPP_INFO.id,
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
          <Section title="Sign Typed Data">
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleTypedDataSign}
              title="SIGN"
            />
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleSellNFT}
              title="SELL NFT"
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
