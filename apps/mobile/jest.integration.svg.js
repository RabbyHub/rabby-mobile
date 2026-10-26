const React = require('react');
const { View } = require('react-native');

function SvgAsset(props) {
  return React.createElement(View, props);
}

module.exports = SvgAsset;
module.exports.default = SvgAsset;
