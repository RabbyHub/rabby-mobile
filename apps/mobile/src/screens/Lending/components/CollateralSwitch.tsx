import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { useTheme2024 } from '@/hooks/theme';
import { DisplayPoolReserveInfo } from '../type';
import { Tip } from '@/components';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

interface IProps {
  label?: React.ReactNode;
  reserve: DisplayPoolReserveInfo;
  canBeEnabledAsCollateral: boolean;
  onValueChange: (value: boolean) => void;
}
const HIT_SLOP = { top: 5, bottom: 5, left: 50, right: 0 };
export const CollateralSwitch: React.FC<IProps> = ({
  label,
  reserve,
  canBeEnabledAsCollateral,
  onValueChange,
}) => {
  const { colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isEnabled =
    reserve.usageAsCollateralEnabledOnUser && canBeEnabledAsCollateral;

  if (!canBeEnabledAsCollateral) {
    return (
      <Tip
        as="RNGHPressable"
        content={t('page.Lending.supplyDetail.isolatedTips')}>
        <AppSwitch2024
          value={false}
          disabled={true}
          barHeight={18}
          circleSize={18}
          backgroundActive={colors2024['green-default']}
          circleBorderActiveColor={colors2024['green-default']}
          onValueChange={onValueChange}
          hitSlop={HIT_SLOP}
        />
      </Tip>
    );
  }
  return (
    <AppSwitch2024
      value={isEnabled}
      barHeight={18}
      circleSize={18}
      disabled={!canBeEnabledAsCollateral}
      backgroundActive={colors2024['green-default']}
      circleBorderActiveColor={colors2024['green-default']}
      onValueChange={onValueChange}
      hitSlop={HIT_SLOP}
    />
  );
};

const getStyles = createGetStyles2024(() => ({
  tooltip: {},
}));
