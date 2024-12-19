import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { StyleProp, TextStyle } from 'react-native';

type TFunc = ReturnType<typeof useTranslation>['t'];
export function I18nRouteScreenTitle({
  i18nTitle,
  style,
}: {
  i18nTitle: ((ctx: { t: TFunc }) => string) | string;
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const titleText = useMemo(() => {
    if (typeof i18nTitle === 'string') {
      return i18nTitle;
    }

    return i18nTitle({ t });
  }, [t, i18nTitle]);

  return (
    <Text style={StyleSheet.flatten([styles.text2024, style])}>
      {titleText}
    </Text>
  );
}

const getStyle = createGetStyles2024(ctx => {
  return {
    classcialText: {
      fontWeight: '500',
      fontSize: 20,
      color: ctx.colors['neutral-title-1'],
    },
    text2024: {
      color: ctx.colors2024['neutral-title-1'],
      fontWeight: '800',
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
    },
  };
});
