import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';

const ConfirmAddressScreen = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const onCancel = () => {
    console.log('🔍 CUSTOM_LOGGER:=>: onCancel');
  };
  const handleConfirm = () => {
    console.log('🔍 CUSTOM_LOGGER:=>: handleConfirm');
  };
  return (
    <FooterButtonScreenContainer
      as="View"
      buttonGroupProps={{
        onCancel,
        onConfirm: handleConfirm,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <Text>address popover</Text>
      <Text>edit address card</Text>
      <Text>add whitelist</Text>
      <Text>alert group</Text>
    </FooterButtonScreenContainer>
  );
};

export default ConfirmAddressScreen;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    borderWidth: 1,
    borderColor: 'red',
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
