import React from 'react';
import LogoWithText from './LogoWithText';
import IconEditPenSVG from '@/assets/icons/sign/edit-pen-cc.svg';
import * as Values from './Values';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { TouchableOpacity } from 'react-native';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';
import DeviceUtils from '@/core/utils/device';
import { isNil } from 'lodash';
import BigNumber from 'bignumber.js';

interface Props {
  amount: number | string;
  logoUrl: string;
  onEdit?: () => void;
  balance?: string;
}

const WIDTH = DeviceUtils.getDeviceWidth();

export const TokenAmountItem: React.FC<Props> = ({
  amount,
  logoUrl,
  onEdit,
  balance,
}) => {
  const commonStyle = useCommonStyle();
  const hideTooltip = isNil(balance);
  const isExceed = hideTooltip ? false : new BigNumber(amount).gt(balance);
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      disabled={!onEdit}
      onPress={onEdit}
      style={StyleSheet.flatten({
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 7,
        borderWidth: 0.5,
        borderColor: colors['neutral-line'],
      })}>
      <LogoWithText
        logo={logoUrl}
        text={
          <View
            style={StyleSheet.flatten({
              alignItems: 'center',
              flexDirection: 'row',
              flex: 1,
              overflow: 'hidden',
            })}>
            <View>
              <Values.TokenAmount
                style={StyleSheet.flatten({
                  ...commonStyle.subRowText,
                  maxWidth: (WIDTH - 60) / 2,
                  color: isExceed
                    ? colors['red-default']
                    : commonStyle.subRowText.color,
                })}
                value={amount}
              />
            </View>
            {onEdit ? (
              <IconEditPenSVG
                style={StyleSheet.flatten({
                  marginLeft: 4,
                  flex: 1,
                  flexShrink: 0,
                })}
                width={16}
                color={colors['blue-default']}
              />
            ) : null}
          </View>
        }
      />
    </TouchableOpacity>
  );
};
