import React, { useCallback } from 'react';
import { StyleProp, TextStyle, TouchableOpacity } from 'react-native';
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

export type ShareAddressCheckboxProps = RNViewProps & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * "Share my addresses to help troubleshoot" row used by every feedback
 * composer. Callers own the state; both composers bind it to the remembered
 * choice, which starts checked.
 */
export function ShareAddressCheckbox({
  checked,
  onChange,
  disabled,
  style,
  textStyle,
  testID = SHARE_ADDRESS_CHECKBOX_TEST_ID,
}: ShareAddressCheckboxProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const handlePress = useCallback(() => {
    onChange(!checked);
  }, [checked, onChange]);

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      activeOpacity={0.6}
      disabled={disabled}
      style={[styles.container, style]}
      onPress={handlePress}>
      {checked ? (
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
      <Text style={[styles.text, textStyle]}>
        {t('component.screenshotModal.includeAddress')}
      </Text>
    </TouchableOpacity>
  );
}

/** Submit modal variant, bound to the screenshot feedback store. */
export function ScreenshotFeedbackShareAddressCheckbox({ style }: RNViewProps) {
  const { includeAddress, setIncludeAddress } =
    useScreenshotFeedbackIncludeAddress();

  return (
    <ShareAddressCheckbox
      checked={includeAddress}
      onChange={setIncludeAddress}
      style={style}
    />
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
