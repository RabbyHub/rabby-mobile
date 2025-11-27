import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { useTheme2024 } from '@/hooks/theme';
import { DisplayPoolReserveInfo } from '../type';
import { useMemo } from 'react';
import { Tip } from '@/components';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

interface IProps {
  reserve: DisplayPoolReserveInfo;
  canBeEnabledAsCollateral: boolean;
  isolated: boolean;
  onValueChange: (value: boolean) => void;
}
export const CollateralSwitch: React.FC<IProps> = ({
  reserve,
  canBeEnabledAsCollateral,
  isolated,
  onValueChange,
}) => {
  const { colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isEnabled =
    reserve.usageAsCollateralEnabledOnUser && canBeEnabledAsCollateral;
  const showIsolatedTips = useMemo(() => {
    return isolated && !canBeEnabledAsCollateral;
  }, [isolated, canBeEnabledAsCollateral]);

  if (showIsolatedTips) {
    return (
      <Tip content={t('page.Lending.supplyDetail.isolatedTips')}>
        <AppSwitch2024
          value={false}
          disabled={true}
          backgroundActive={colors2024['green-default']}
          circleBorderActiveColor={colors2024['green-default']}
          onValueChange={onValueChange}
        />
      </Tip>
    );
  }
  return (
    <AppSwitch2024
      value={isEnabled}
      disabled={!canBeEnabledAsCollateral}
      backgroundActive={colors2024['green-default']}
      circleBorderActiveColor={colors2024['green-default']}
      onValueChange={onValueChange}
    />
  );
};

const getStyles = createGetStyles2024(() => ({
  tooltip: {},
}));
