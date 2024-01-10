import { Button } from '@/components/Button';
import { Account } from '@/core/services/preference';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import React from 'react';
import { Text, View } from 'react-native';
import { WaitingSignMessageComponent } from './map';
import { RcRabbyBrandIcon, RcViewRawRight } from '../icons';
import TouchableView from '@/components/Touchable/TouchableView';
import clsx from 'clsx';
import { styled } from 'styled-components/native';

const FloorContainer = styled(View)`
  padding-left: 20px;
  padding-right: 20px;
`;

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
    <View className="py-[8] h-[100%] bg-r-neutral-bg2">
      <FloorContainer
        className={clsx('flex-row justify-between items-center', 'px-[20]')}>
        <Text
          className="text-r-neutral-title1 font-[500]"
          style={{
            fontSize: 16,
          }}>
          SignText
        </Text>

        <TouchableView
          className="flex-row items-center"
          onPress={() => {
            // TODO
          }}>
          <Text
            className="text-r-neutral-foot font-[400]"
            style={{
              fontSize: 13,
            }}>
            View Raw
          </Text>
          <RcViewRawRight className="ml-[8] w-[14] h-[14]" />
        </TouchableView>
      </FloorContainer>

      <FloorContainer>
        <View
          className={clsx(
            'mt-[8] mb-[12] px-[12] py-[13] min-h-[44] w-[100%]',
            'flex-row justify-between items-center',
            'bg-r-blue-default rounded-[6px]',
          )}>
          <Text
            className="text-r-neutral-title2 font-[500]"
            style={{
              fontSize: 16,
            }}>
            Send Text
          </Text>
          <View>
            <RcRabbyBrandIcon className="w-[20] h-[20]" />
          </View>
        </View>
      </FloorContainer>

      <View className="relative items-center justify-center mb-[12]">
        {/* dashed line */}
        <View
          className={clsx(
            'absolute w-[100%] h-[1] top-[50%] left-[0] right-[0]',
            'border-[1px] border-dashed border-rabby-neutral-line',
          )}
        />
        <View
          className={clsx(
            // same with bottom-sheet's background color
            'bg-r-neutral-bg2',
            'pl-[13] pr-[13]',
          )}>
          <Text
            className="text-r-neutral-foot font-[400]"
            style={{
              fontSize: 13,
            }}>
            Message
          </Text>
        </View>
      </View>

      <FloorContainer>
        <View className="bg-r-neutral-card3 rounded-[6px] p-[12]">
          <Text>{JSON.stringify(params, null, '  ')}</Text>
        </View>
      </FloorContainer>

      <FloorContainer className="mt-[13]">
        <Button
          onPress={handleAllow}
          title="Sign"
          titleStyle={{
            color: colors['neutral-title-2'],
          }}
          containerStyle={{
            width: '100%',
            height: 44,
          }}
          buttonStyle={{
            backgroundColor: colors['blue-default'],
            // padding: 10,
          }}
        />
      </FloorContainer>
    </View>
  );
};
