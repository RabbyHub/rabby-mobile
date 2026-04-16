import { Dimensions, View } from 'react-native';
import { MaterialTabBar } from 'react-native-collapsible-tab-view';
import { Indicator } from './CustomIndicator';

const screenWidth = Dimensions.get('window').width;
// 只针对了2个tab，后面再动态适配两个以上tab的场景
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
            x: screenWidth / 20,
          },
          {
            width: screenWidth / 4,
            x: screenWidth / 3 + screenWidth / 20,
          },
        ]}
        fadeIn
      />
    </View>
  );
};
