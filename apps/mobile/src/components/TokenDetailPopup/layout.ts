import { Dimensions } from 'react-native';

export const TOKEN_DETAIL_HISTORY_SIZES = {
  sheetModalHorizontalPercentage: 0.8,
  horizontalPadding: 20,
  buttonGap: 12,
  containerPt: 8,
  headerHeight: 100,
  headerTokenLogo: 24,
  get maxEmptyHeight() {
    const modalHeight = Math.floor(
      Dimensions.get('window').height * this.sheetModalHorizontalPercentage,
    );

    return (
      modalHeight -
      12 /* handlebar height */ -
      this.containerPt -
      this.headerHeight
    );
  },

  opButtonHeight: 40,
};
