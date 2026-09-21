import { Platform, Dimensions } from 'react-native';
import {
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
} from '@/constant/layout';

const isAndroid = Platform.OS === 'android';

const riskyTipHeight = 32;
const riskyTipArrowOffset = 14;
const contractRowHeight = 122;
const contractCardHeight = 133;

export const IOS_SWIPABLE_LEFT_OFFSET = isAndroid ? 0 : 10;

export const ApprovalsLayouts = {
  tabbarHeight: 40,
  contentInsetTopOffset: isAndroid ? 0 : 40 /* same with tabbarHeight */,
  bottomAreaHeight: isAndroid ? 100 : 120,

  bottomSheetConfirmAreaHeight:
    BOTTOM_BUTTON_TOP_OFFSET +
    BOTTOM_BUTTON_SINGLE_HEIGHT +
    BOTTOM_BUTTON_BOTTOM_OFFSET,

  searchBarMarginOffset: 16,
  searchBarHeight: 46,

  contractRowHeight,
  contractRowHeightWithRiskAlert:
    contractRowHeight + riskyTipHeight + riskyTipArrowOffset,
  contractCardRiskAlertSpace: riskyTipHeight + riskyTipArrowOffset,
  contractCardHeight,
  contractCardHeightWithRiskAlert:
    contractCardHeight + riskyTipHeight + riskyTipArrowOffset,
  contractCardPadding: 16,
  contractCardPaddingVertical: 16,
  contractCardPaddingHorizontal: 24,

  assetsItemHeight: 72,
  assetsItemPadding: 16,

  listFooterComponentHeight: 56,
  innerContainerHorizontalOffset: 16,

  get riskAlertTooltipMaxWidth() {
    return (
      Dimensions.get('window').width -
      (this.innerContainerHorizontalOffset + this.contractCardPadding + 63)
    );
  },
};
