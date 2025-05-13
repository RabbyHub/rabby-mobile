import { Dimensions, View } from 'react-native';
import { MaterialTabBar } from 'react-native-collapsible-tab-view';
import { Indicator } from './CustomIndicator';

const screenWidth = Dimensions.get('window').width;
export const CustomMaterialTabBar = (props: any) => {
  return (
    <View>
      <MaterialTabBar {...props} indicatorStyle={{ height: 0 }} />
      <Indicator
        indexDecimal={props.indexDecimal}
        style={props.indicatorStyle}
        itemsLayout={[
          {
            width: screenWidth / 4,
            x: screenWidth / 8,
          },
          {
            width: screenWidth / 4,
            x: screenWidth / 2 + screenWidth / 8,
          },
        ]}
        fadeIn
      />
    </View>
  );
};
