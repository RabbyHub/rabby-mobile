import React from 'react';
import { StackActions } from '@react-navigation/native';

import TouchableText from '@/components/Touchable/TouchableText';
import { isNonPublicProductionEnv } from '@/constant';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export function WelcomeLocalDataLink(): JSX.Element | null {
  const navigation = useRabbyAppNavigation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  if (!isNonPublicProductionEnv) {
    return null;
  }

  return (
    <TouchableText
      style={[styles.link, { color: colors2024['orange-default'] }]}
      onPress={() => {
        navigation.dispatch(
          StackActions.push(RootNames.StackTestkits, {
            screen: RootNames.LocalDataViewer,
          }),
        );
      }}>
      {'(Test Only) View Local Data >'}
    </TouchableText>
  );
}

const getStyle = createGetStyles2024(() => ({
  link: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
}));
