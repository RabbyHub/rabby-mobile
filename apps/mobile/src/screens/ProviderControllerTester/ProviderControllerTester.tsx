/**
 * Sample React Native ProviderControllerTester
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import type { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
} from 'react-native/Libraries/NewAppScreen';

import {
  useGetBinaryMode,
  useThemeColors,
  useThemeStyles,
} from '@/hooks/theme';
import { Button } from '@/components';
import { sendRequest } from '@/core/apis/sendRequest';
import { useDapps } from '@/hooks/useDapps';
import { CHAINS_ENUM } from '@/constant/chains';
import { createGetStyles } from '@/utils/styles';
import { preferenceService } from '@/core/services';

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({ children, title }: SectionProps): JSX.Element {
  const isDarkMode = useGetBinaryMode() === 'dark';

  return (
    <View style={sectionStyles.sectionContainer}>
      <Text
        style={[
          sectionStyles.sectionTitle,
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

const sectionStyles = StyleSheet.create({
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
  description: 'test rabby',
  id: 'https://tester.rabby.io',
  logo_url:
    'https://static.debank.com/image/project/logo_url/galxe/90baa6ae2cb97b4791f02fe66abec4b2.png',
  name: 'Rabby Tester',
  tags: [],
  user_range: 'User >10k',
  chain_ids: [CHAINS_ENUM.ETH],
};

const TEST_SESSION = {
  origin: TEST_DAPP_INFO.id,
  name: TEST_DAPP_INFO.name,
  icon: TEST_DAPP_INFO.logo_url,
};

function ProviderControllerTester(): JSX.Element {
  const isDarkMode = useGetBinaryMode() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const { addDapp } = useDapps();
  const [account, setAccount] = React.useState<string>();
  const currentAccount = preferenceService.getFallbackAccount();
  const [connectStatus, setConnectStatus] = React.useState<string>();
  const { styles } = useThemeStyles(getStyles);

  const handleConnect = React.useCallback(() => {
    sendRequest({
      data: {
        method: 'eth_requestAccounts',
      },
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
        setAccount(res[0]);
      })
      .catch(e => {
        console.error(e);
      });
  }, [currentAccount]);

  const handlSignTransaction = React.useCallback(() => {
    sendRequest({
      data: {
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
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  }, [account, currentAccount]);

  const handlePersonalSign = React.useCallback(() => {
    sendRequest({
      data: {
        method: 'personal_sign',
        params: [
          '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
          account,
          'Example password',
        ],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  }, [account, currentAccount]);

  const handleTypedDataSign = React.useCallback(() => {
    sendRequest({
      data: {
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
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  }, [account, currentAccount]);

  const handleSellNFT = React.useCallback(() => {
    sendRequest({
      data: {
        method: 'eth_signTypedData_v4',
        params: [
          account,
          '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"OrderComponents":[{"name":"offerer","type":"address"},{"name":"zone","type":"address"},{"name":"offer","type":"OfferItem[]"},{"name":"consideration","type":"ConsiderationItem[]"},{"name":"orderType","type":"uint8"},{"name":"startTime","type":"uint256"},{"name":"endTime","type":"uint256"},{"name":"zoneHash","type":"bytes32"},{"name":"salt","type":"uint256"},{"name":"conduitKey","type":"bytes32"},{"name":"counter","type":"uint256"}],"OfferItem":[{"name":"itemType","type":"uint8"},{"name":"token","type":"address"},{"name":"identifierOrCriteria","type":"uint256"},{"name":"startAmount","type":"uint256"},{"name":"endAmount","type":"uint256"}],"ConsiderationItem":[{"name":"itemType","type":"uint8"},{"name":"token","type":"address"},{"name":"identifierOrCriteria","type":"uint256"},{"name":"startAmount","type":"uint256"},{"name":"endAmount","type":"uint256"},{"name":"recipient","type":"address"}]},"primaryType":"OrderComponents","domain":{"name":"Seaport","version":"1.5","chainId":"1","verifyingContract":"0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC"},"message":{"offerer":"0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85","offer":[{"itemType":"2","token":"0xF75FD01D2262b07D92dcA7f19bD6A3457060d7db","identifierOrCriteria":"3626","startAmount":"1","endAmount":"1"}],"consideration":[{"itemType":"1","token":"0xfe1ef2b469846d1832b25095ff51b004f090e0c6","identifierOrCriteria":"0","startAmount":"900000000000000000","endAmount":"900000000000000000","recipient":"0x5853ed4f26a3fcea565b3fbc698bb19cdf6deb85"},{"itemType":"1","token":"0xfe1ef2b469846d1832b25095ff51b004f090e0c6","identifierOrCriteria":"0","startAmount":"25000000000000000","endAmount":"25000000000000000","recipient":"0x0000a26b00c1F0DF003000390027140000fAa719"},{"itemType":"1","token":"0xfe1ef2b469846d1832b25095ff51b004f090e0c6","identifierOrCriteria":"0","startAmount":"75000000000000000","endAmount":"75000000000000000","recipient":"0xaa5a6eec8F785F8C4fEeb28057f1f4F37EC33C44"}],"startTime":"1686477774","endTime":"1689069774","orderType":"0","zone":"0x5853ed4f26a3fcea565b3fbc698bb19cdf6deb85","zoneHash":"0x0000000000000000000000000000000000000000000000000000000000000000","salt":"24446860302761739304752683030156737591518664810215442929806870165851630445366","conduitKey":"0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000","totalOriginalConsiderationItems":"3","counter":"0"}}',
        ],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  }, [account, currentAccount]);

  const handleSendEth = React.useCallback(() => {
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: '0xf89e7B1D6d5462FdCb9c3E68954AF80D13676E46',
            value: '0x0',
            gasLimit: '0x5028',
            maxFeePerGas: '0x2540be400',
            maxPriorityFeePerGas: '0x3b9aca00',
          },
        ],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  }, [account, currentAccount]);

  const handleSwap = React.useCallback(() => {
    const tx = {
      chainId: 1,
      from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      to: '0x1111111254eeb25477b68fb85ed929f73a960582',
      value: '0x2386f26fc10000',
      data: '0x0502b1c50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000017f6aaf0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000180000000000000003b6d0340b4e16d0168e52d35cacd2c6185b44281ec28c9dc10d1df6e',
      gas: '0x2a5d8',
      maxFeePerGas: '0x4e3b29200',
      maxPriorityFeePerGas: '0x4e3b29200',
      nonce: '0xc2',
    };
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const handleApproveNFT = () => {
    const tx = {
      chainId: 1,
      from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      to: '0x79fcdef22feed20eddacbb2587640e45491b757f',
      data: '0x095ea7b3000000000000000000000000341a1fbd51825e5a107db54ccb3166deba1454790000000000000000000000000000000000000000000000000000000000000479',
      gas: '0x1205c',
      maxFeePerGas: '0x773594000',
      maxPriorityFeePerGas: '0x773594000',
      nonce: '0xc2',
    };
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    })
      .then(res => {
        console.log(res);
      })
      .catch(e => {
        console.error(e);
      });
  };

  const handleApproveCollection = () => {
    const tx = {
      chainId: 1,
      from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      to: '0x79fcdef22feed20eddacbb2587640e45491b757f',
      data: '0xa22cb465000000000000000000000000341a1fbd51825e5a107db54ccb3166deba1454790000000000000000000000000000000000000000000000000000000000000001',
      gas: '0x111e9',
      maxFeePerGas: '0x89d5f3200',
      maxPriorityFeePerGas: '0x89d5f3200',
      nonce: '0xc2',
    };
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    });
  };

  const handleCrossToken = () => {
    const tx = {
      chainId: 1,
      from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      to: '0x150f94b44927f078737562f0fcf3c95c01cc2376',
      value: '0x165fa13c58de92a',
      data: '0x1114cd2a000000000000000000000000000000000000000000000000000000000000006e000000000000000000000000f08c90c7f470b640a21dd9b3744eca3d1d16a04400000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000016345785d8a000000000000000000000000000000000000000000000000000001617eb90b26c0000000000000000000000000000000000000000000000000000000000000000014f08c90c7f470b640a21dd9b3744eca3d1d16a044000000000000000000000000',
      gas: '0xa40a5',
      maxFeePerGas: '0x861c46800',
      maxPriorityFeePerGas: '0x861c46800',
      nonce: '0xc2',
    };
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    });
  };

  const handleCrossSwapToken = () => {
    const tx = {
      chainId: 1,
      from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      to: '0x8731d54e9d02c286767d56ac03e8037c07e01e98',
      value: '0x2b49b6803e92a',
      data: '0x9fbf10fc000000000000000000000000000000000000000000000000000000000000006e00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000341a1fbd51825e5a107db54ccb3166deba1454790000000000000000000000000000000000000000000000000000000000989680000000000000000000000000000000000000000000000000000000000097d330000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000014341a1fbd51825e5a107db54ccb3166deba1454790000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      gas: '0x8ea18',
      maxFeePerGas: '0x773594000',
      maxPriorityFeePerGas: '0x773594000',
      nonce: '0x65',
    };
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    });
  };

  const handleContractCall = () => {
    const tx = {
      chainId: 1,
      from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      to: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      data: '0x8456cb59',
      gas: '0x8b17',
      maxFeePerGas: '0x89d5f3200',
      maxPriorityFeePerGas: '0x89d5f3200',
      nonce: '0xc2',
    };
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    });
  };

  const handleSendNFT = () => {
    const tx = {
      chainId: 1,
      from: '0x341a1fbd51825e5a107db54ccb3166deba145479',
      to: '0xbba4115ecb1f811061ecb5a8dc8fcdee2748ceba',
      data: '0x42842e0e000000000000000000000000341a1fbd51825e5a107db54ccb3166deba145479000000000000000000000000f5d5b661f9c3d8b5244f00ef25cf25b61f5a1f7d000000000000000000000000000000000000000000000000000000000000010e',
      gas: '0x26a75',
      maxFeePerGas: '0x737be7600',
      maxPriorityFeePerGas: '0x737be7600',
      nonce: '0x74',
    };
    sendRequest({
      data: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
      session: TEST_SESSION,
      account: currentAccount!,
    });
  };

  React.useEffect(() => {
    addDapp({
      info: TEST_DAPP_INFO,
      chainId: CHAINS_ENUM.ETH,
      origin: TEST_DAPP_INFO.id,
      name: TEST_DAPP_INFO.name,
    });
  }, [addDapp]);

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
            <Text style={styles.text}>Connect status: {connectStatus}</Text>
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
          <Section title="Swap">
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleSwap}
              title="Swap Transaction"
            />
          </Section>
          <Section title="NFT">
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleApproveNFT}
              title="Approve NFT"
            />
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleApproveCollection}
              title="Approve Collection"
            />
            <StyledButton
              disabled={!account || !isClientCreated}
              title="Send NFT(前端测试账号)"
              onPress={handleSendNFT}
            />
          </Section>
          <Section title="Cross Chain">
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleCrossToken}
              title="Cross Token"
            />
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleCrossSwapToken}
              title="Cross Swap"
            />
            <StyledButton
              disabled={!account || !isClientCreated}
              onPress={handleContractCall}
              title="Contract Call"
            />
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    text: {
      color: colors['neutral-body'],
    },
  };
});

export default ProviderControllerTester;
