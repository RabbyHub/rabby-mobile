import { View } from 'react-native';

const SPACING_HEIGHT = 8;
const FOOTER_HEIGHT = 158;
const HEADER_PADDING_HEIGHT = 2;

export const ListRenderSeparator = () => {
  return <View style={{ height: SPACING_HEIGHT }} />;
};
export const ListRenderFooter = () => {
  return <View style={{ height: FOOTER_HEIGHT }} />;
};
export const ListHeaderComponent = () => {
  return <View style={{ height: HEADER_PADDING_HEIGHT }} />;
};
