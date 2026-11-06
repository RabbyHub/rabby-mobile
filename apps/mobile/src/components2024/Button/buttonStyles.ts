import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  getBottomButtonCenteredTitleStyle,
} from '@/constant/layout';

export const buttonTitleStyles = {
  single: getBottomButtonCenteredTitleStyle(BOTTOM_BUTTON_SINGLE_HEIGHT),
  double: getBottomButtonCenteredTitleStyle(BOTTOM_BUTTON_DOUBLE_HEIGHT),
};
