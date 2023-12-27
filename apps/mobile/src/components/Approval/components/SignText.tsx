import { Button } from '@/components/Button';
import { Account } from '@/core/services/preference';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { CHAINS_ENUM } from '@debank/common';
import React from 'react';
import { Text, View } from 'react-native';
import { WaitingSignMessageComponent } from './map';

interface SignTextProps {
  data: string[];
  session: {
    origin: string;
    icon: string;
    name: string;
  };
  isGnosis?: boolean;
  account?: Account;
  method?: string;
}

export const SignText = ({ params }: { params: SignTextProps }) => {
  const [, resolveApproval, rejectApproval] = useApproval();
  const { currentAccount } = useCurrentAccount();
  const colors = useThemeColors();

  const handleAllow = async () => {
    // TODO
    //  if (activeApprovalPopup()) {
    //    return;
    //  }
    if (
      currentAccount?.type &&
      WaitingSignMessageComponent[currentAccount?.type]
    ) {
      resolveApproval({
        uiRequestComponent: WaitingSignMessageComponent[currentAccount?.type],
        type: currentAccount.type,
        address: currentAccount.address,
        extra: {
          brandName: currentAccount.brandName,
          signTextMethod: 'personalSign',
        },
      });

      return;
    }
    resolveApproval({});
  };

  return (
    <View>
      <Text
        style={{
          fontSize: 30,
        }}>
        SignText
      </Text>
      <Text>{JSON.stringify(params, null, ' ')}</Text>
      <Button
        onPress={handleAllow}
        title="Sign"
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
