import React from 'react';
import { ScrollView, Text } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

/**
 * Non-production probe for screen-level prop injection.
 *
 * It renders the props it received (minus React Navigation's own) so a device
 * can prove that `debug-open-screen&props={"foo":"bar"}` reached the component.
 * Never registered in a shipping build path.
 */
function DevScreenInjectionProbe(props: Record<string, unknown>) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const {
    navigation: _navigation,
    route,
    ...rest
  } = props as {
    navigation?: unknown;
    route?: { name?: string; params?: unknown };
    [key: string]: unknown;
  };

  const payload = {
    route: route?.name ?? '(none)',
    routeParams: route?.params ?? null,
    injectedProps: Object.fromEntries(
      Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };

  return (
    <NormalScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Screen injection probe</Text>
        <Text selectable style={styles.body}>
          {JSON.stringify(payload, null, 2)}
        </Text>
      </ScrollView>
    </NormalScreenContainer>
  );
}

export default DevScreenInjectionProbe;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  title: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
  },
  body: {
    color: colors2024['neutral-body'],
    fontSize: 12,
    marginTop: 12,
  },
}));
