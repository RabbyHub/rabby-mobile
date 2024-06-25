import React from 'react';
import LogoWithText from './LogoWithText';
import IconEditPenSVG from '@/assets/icons/sign/edit-pen-cc.svg';
import * as Values from './Values';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { TouchableOpacity } from 'react-native';

interface Props {
  amount: number;
  logoUrl: string;
  onEdit?: () => void;
}

export const TokenAmountItem: React.FC<Props> = ({
  amount,
  logoUrl,
  onEdit,
}) => {
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
              maxWidth: 200,
              overflow: 'hidden',
            })}>
            <View>
              <Values.TokenAmount value={amount} />
            </View>
            {onEdit ? (
              <IconEditPenSVG
                style={StyleSheet.flatten({ marginLeft: 4 })}
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
