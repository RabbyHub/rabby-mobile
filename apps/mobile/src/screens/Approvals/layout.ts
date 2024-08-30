import { Platform, Dimensions } from 'react-native';

const isAndroid = Platform.OS === 'android';

const riskyTipHeight = 32;
const riskyTipArrowOffset = 14;
const contractRowHeight = 123;
const contractCardHeight = 133;

export const ApprovalsLayouts = {
  tabbarHeight: 40,
  contentInsetTopOffset: isAndroid ? 0 : 40 /* same with tabbarHeight */,
  bottomAreaHeight: isAndroid ? 100 : 120,

  bottomSheetConfirmAreaHeight: isAndroid ? 100 : 120,

  searchBarMarginOffset: 16,
  searchBarHeight: 48,

  contractRowHeight,
  contractRowHeightWithRiskAlert:
    contractRowHeight + riskyTipHeight + riskyTipArrowOffset,
  contractCardRiskAlertSpace: riskyTipHeight + riskyTipArrowOffset,
  contractCardHeight,
  contractCardHeightWithRiskAlert:
    contractCardHeight + riskyTipHeight + riskyTipArrowOffset,
  contractCardPadding: 16,

  assetsItemHeight: 60,
  assetsItemPadding: 16,

  listFooterComponentHeight: 56,
  innerContainerHorizontalOffset: 20,

  get riskAlertTooltipMaxWidth() {
    return (
      Dimensions.get('window').width -
      (this.innerContainerHorizontalOffset + this.contractCardPadding + 63)
    );
  },
};
