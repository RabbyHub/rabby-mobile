import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';

import { PerpsModeSwitch } from '../PerpsShared/components/PerpsModeSwitch';

export type PerpsProScreenProps = {
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
};

export const PerpsProScreen: React.FC<PerpsProScreenProps> = ({
  isModeSwitching,
  onSwitchToSimple,
}) => {
  const navigation = useRabbyAppNavigation();
  const { styles } = useTheme2024({ getStyle });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleSelectMode = (viewMode: PerpsViewMode) => {
    if (viewMode === 'simple') {
      onSwitchToSimple();
    }
  };

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <HeaderBackPressable style={styles.backButton} />
        <View style={styles.headerContent}>
          <RcIconHyper />
          <View style={styles.modeSwitch}>
            <PerpsModeSwitch
              activeMode="pro"
              disabled={isModeSwitching}
              onSelectMode={handleSelectMode}
            />
          </View>
        </View>
      </View>
      <View style={styles.content} />
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(() => ({
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginLeft: 0,
    paddingLeft: 0,
  },
  headerContent: {
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeSwitch: {
    marginLeft: 16,
  },
  content: {
    flex: 1,
  },
}));
