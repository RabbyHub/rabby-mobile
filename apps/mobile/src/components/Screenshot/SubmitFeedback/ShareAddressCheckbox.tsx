import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcCheckboxRoundCheckedCC from '@/assets2024/icons/common/checkbox-round-checked-cc.svg';
import RcCheckboxRoundEmptyCC from '@/assets2024/icons/common/checkbox-round-empty-cc.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useScreenshotFeedbackIncludeAddress } from '../hooks';

export const SHARE_ADDRESS_CHECKBOX_TEST_ID =
  'screenshot-feedback-include-address';

const ICON_SIZE = 16;

export function ScreenshotFeedbackShareAddressCheckbox({ style }: RNViewProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { includeAddress, setIncludeAddress } =
    useScreenshotFeedbackIncludeAddress();

  const handlePress = useCallback(() => {
    setIncludeAddress(!includeAddress);
  }, [includeAddress, setIncludeAddress]);

  return (
    <TouchableOpacity
      testID={SHARE_ADDRESS_CHECKBOX_TEST_ID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: includeAddress }}
      activeOpacity={0.6}
      style={[styles.container, style]}
      onPress={handlePress}>
      {includeAddress ? (
        <RcCheckboxRoundCheckedCC
          width={ICON_SIZE}
          height={ICON_SIZE}
          color={colors2024['green-default']}
        />
      ) : (
        <RcCheckboxRoundEmptyCC
          width={ICON_SIZE}
          height={ICON_SIZE}
          color={colors2024['neutral-info']}
        />
      )}
      <Text style={styles.text}>
        {t('component.screenshotModal.includeAddress')}
      </Text>
    </TouchableOpacity>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
