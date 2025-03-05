import React from 'react';
import { GasLessNotEnough } from './GasLessNotEnough';
import { GasLessActivityToSign } from './GasLessActivityToSign';
import { GasAccountTips } from './GasAccountTips';

export { GasLessAnimatedWrapper } from './GasLessAnimatedWrapper';

export type GasLessConfig = {
  button_text: string;
  before_click_text: string;
  after_click_text: string;
  logo: string;
  theme_color: string;
  dark_color: string;
};
