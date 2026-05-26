import '../../imports';

import {
  createChart as LcCreateChart,
  CandlestickSeries,
  HistogramSeries,
  // type CandlestickData,
} from 'lightweight-charts/standalone';
// import BigNumber from 'bignumber.js';

// const LightweightCharts = window.LightweightCharts;

import { getRuntimeInfo, postMessageToRN } from '../../utils/webview-runtime';
import {
  type ChartColors,
  type ChartDescription,
  type TPSLPriceLines,
} from './types';
import {
  createChartState,
  updateTPSLPriceLines as updateTPSLPriceLinesLogic,
  updatePriceLines,
  formatPrice,
  formatNumber,
  formatTime,
} from './chart-logic';
import { ThemeColors2024 } from '@rabby-wallet/base-utils/src/isomorphic/theme-colors';

function getChartColors(
  isLight: boolean = !getRuntimeInfo().isDark,
): ChartColors {
  const colors2024 = isLight ? ThemeColors2024.light : ThemeColors2024.dark;

  return {
    background: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    text: colors2024['neutral-title-1'],
    border: colors2024['neutral-bg-5'],
    secondaryText: colors2024['neutral-secondary'],
    greenLineColor: 'rgba(42, 187, 127, 1)',
    redLineColor: 'rgba(227, 73, 53, 1)',
    highPriceLineColor: colors2024['neutral-body'],
    lowPriceLineColor: colors2024['neutral-body'],
    emptyPrimary: colors2024['brand-light-1'],
    emptySecondary: colors2024['brand-light-2'],
    emptyStroke: colors2024['brand-disable'],
    tooltip: {
      bg: isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2'],
      title: colors2024['neutral-body'],
      value: colors2024['neutral-title-1'],
    },
  };
}

// Default descriptions (will be overridden by RN messages)
const defaultDescription: ChartDescription = {
  tp: 'TP',
  entry: 'Entry',
  sl: 'SL',
  liq: 'Liq',
  high: 'High',
  low: 'Low',
  time: 'Time',
  open: 'Open',
  close: 'Close',
  chg: 'Chg',
  chgPercent: 'Chg%',
  volume: 'Volume',
  empty: 'No Data',
};

const EMPTY_SVG = `<svg width="163" height="126" viewBox="0 0 163 126" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="mask0_75349_95511" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="24" y="-6" width="135" height="127">
<path d="M158.5 13.8906V33.3906L132.317 45.9785V82.3311C132.317 88.9584 127.664 97.0174 121.925 100.331L94.1006 116.395C84.8186 121.753 73.3826 121.753 64.1006 116.395L34.3926 99.2432C28.6532 95.9295 24.0002 87.8705 24 81.2432V7.89062L90 -5.60938L158.5 13.8906Z" fill="white"/>
</mask>
<g mask="url(#mask0_75349_95511)">
<rect width="63.6244" height="61.4492" transform="matrix(0.866025 0.5 -0.866025 0.5 78.2168 14.7422)" fill="white"/>
<rect y="0.5" width="62.6244" height="60.4492" transform="matrix(0.866025 0.5 -0.866025 0.5 78.6498 14.9922)" stroke="#4C65FF" stroke-opacity="0.25"/>
<path d="M25 45.4688L80.1004 77.281V125.633L35.3923 99.8209C29.6528 96.5072 25 88.4483 25 81.8209V45.4688Z" fill="url(#paint0_linear_75349_95511)" fill-opacity="0.12"/>
<path d="M79.667 77.5308V124.883L35.3923 99.3213C29.8921 96.1457 25.4332 88.4225 25.433 82.0713V46.2188L79.667 77.5308Z" stroke="url(#paint1_linear_75349_95511)" stroke-opacity="0.12"/>
<foreignObject x="21.2904" y="46.1205" width="62.5228" height="56.6028"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(6.84px);clip-path:url(#bgblur_0_75349_95511_clip_path);height:100%;width:100%"></div></foreignObject><rect data-figma-bg-blur-radius="13.6764" width="40.6108" height="8.94798" transform="matrix(0.866025 0.5 0 1 34.9668 59.7969)" fill="#4C65FF" fill-opacity="0.25"/>
<path d="M80.0996 77.2812L131.999 47.3171V81.5758C131.999 88.2032 127.346 96.262 121.607 99.5757L80.0996 123.54V77.2812Z" fill="url(#paint2_linear_75349_95511)" fill-opacity="0.12"/>
<path d="M131.566 48.0669V81.8257C131.566 88.1768 127.107 95.8999 121.607 99.0757L80.5326 122.79V77.5312L131.566 48.0669Z" stroke="url(#paint3_linear_75349_95511)" stroke-opacity="0.12"/>
<path d="M132.17 28.1272L143.961 13.5469" stroke="#4C65FF" stroke-opacity="0.4" stroke-width="1.08759"/>
<path d="M139.405 37.7189L157.355 32.2969" stroke="#4C65FF" stroke-opacity="0.4" stroke-width="1.08759"/>
<foreignObject x="45.4251" y="-11.317" width="77.4271" height="92.345"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(6.84px);clip-path:url(#bgblur_1_75349_95511_clip_path);height:100%;width:100%"></div></foreignObject><g data-figma-bg-blur-radius="13.6764">
<mask id="path-11-inside-1_75349_95511" fill="white">
<path d="M109.177 28.252V60.3496L97.1768 67.3496L77.5781 54.4629L59.1016 43.5273V2.35938L109.177 28.252Z"/>
</mask>
<path d="M109.177 28.252V60.3496L97.1768 67.3496L77.5781 54.4629L59.1016 43.5273V2.35938L109.177 28.252Z" fill="white"/>
<path d="M109.177 28.252H109.721V27.9209L109.427 27.7689L109.177 28.252ZM109.177 60.3496L109.451 60.8193L109.721 60.6619V60.3496H109.177ZM97.1768 67.3496L96.878 67.804L97.1596 67.9892L97.4508 67.8193L97.1768 67.3496ZM77.5781 54.4629L77.8769 54.0085L77.8662 54.0015L77.8551 53.9949L77.5781 54.4629ZM59.1016 43.5273H58.5578V43.8374L58.8246 43.9953L59.1016 43.5273ZM59.1016 2.35938L59.3513 1.87633L58.5578 1.466V2.35938H59.1016ZM109.177 28.252H108.633V60.3496H109.177H109.721V28.252H109.177ZM109.177 60.3496L108.903 59.8799L96.9028 66.8799L97.1768 67.3496L97.4508 67.8193L109.451 60.8193L109.177 60.3496ZM97.1768 67.3496L97.4755 66.8952L77.8769 54.0085L77.5781 54.4629L77.2794 54.9173L96.878 67.804L97.1768 67.3496ZM77.5781 54.4629L77.8551 53.9949L59.3785 43.0594L59.1016 43.5273L58.8246 43.9953L77.3011 54.9309L77.5781 54.4629ZM59.1016 43.5273H59.6454V2.35938H59.1016H58.5578V43.5273H59.1016ZM59.1016 2.35938L58.8518 2.84242L108.927 28.735L109.177 28.252L109.427 27.7689L59.3513 1.87633L59.1016 2.35938Z" fill="#4C65FF" fill-opacity="0.4" mask="url(#path-11-inside-1_75349_95511)"/>
</g>
<path d="M51.2406 7.82746C51.3231 5.89341 52.6678 5.07755 54.384 5.97333C55.5612 6.58775 56.9824 7.354 58.4507 8.20173C59.9303 9.05593 61.362 9.9377 62.5444 10.6862C64.2487 11.7652 65.5888 14.1109 65.6724 16.127C65.7373 17.6946 65.796 19.5038 65.796 20.9241C65.796 22.3181 65.7395 24.0214 65.676 25.4952C65.5917 27.4512 64.2056 28.2431 62.4695 27.3375C61.0894 26.6176 59.5278 25.7867 58.4507 25.1649C57.3809 24.5473 55.8329 23.5837 54.4598 22.7146C52.7117 21.6082 51.3205 19.1929 51.237 17.1261C51.169 15.4423 51.1055 13.5684 51.1055 12.4425C51.1055 11.2971 51.1712 9.45339 51.2406 7.82746Z" fill="#F5F6FF"/>
<path d="M82.396 24.5082L69.4507 17.0343C68.6258 16.558 67.957 16.9441 67.957 17.8966C67.957 18.8492 68.6258 20.0075 69.4507 20.4838L82.396 27.9577C83.2209 28.434 83.8897 28.0479 83.8897 27.0953C83.8897 26.1428 83.2209 24.9845 82.396 24.5082Z" fill="#F5F6FF"/>
<path opacity="0.7" d="M91.3581 37.159L69.4507 24.5108C68.6258 24.0345 67.957 24.4206 67.957 25.3732C67.957 26.3258 68.6258 27.4841 69.4507 27.9603L91.3581 40.6086C92.183 41.0848 92.8518 40.6987 92.8518 39.7462C92.8518 38.7936 92.183 37.6353 91.3581 37.159Z" fill="#F5F6FF"/>
<foreignObject x="25.0658" y="12.0736" width="70.7122" height="76.2981"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(6.84px);clip-path:url(#bgblur_2_75349_95511_clip_path);height:100%;width:100%"></div></foreignObject><g data-figma-bg-blur-radius="13.6764">
<mask id="path-16-inside-2_75349_95511" fill="white">
<path d="M40.9219 27.2432C43.6624 24.4782 48.04 26.0435 51.4092 27.9941L82.1016 45.7627C81.853 45.7245 81.5981 45.7051 81.3389 45.7051C78.5894 45.7052 76.3606 47.9342 76.3604 50.6836V73.1436H76.5811V74.6973L38.7422 52.791V32.5391C38.7423 30.4739 39.5746 28.6026 40.9219 27.2432Z"/>
</mask>
<path d="M40.9219 27.2432C43.6624 24.4782 48.04 26.0435 51.4092 27.9941L82.1016 45.7627C81.853 45.7245 81.5981 45.7051 81.3389 45.7051C78.5894 45.7052 76.3606 47.9342 76.3604 50.6836V73.1436H76.5811V74.6973L38.7422 52.791V32.5391C38.7423 30.4739 39.5746 28.6026 40.9219 27.2432Z" fill="white"/>
<path d="M40.9219 27.2432L40.5356 26.8604L40.5356 26.8604L40.9219 27.2432ZM51.4092 27.9941L51.1367 28.4648L51.1367 28.4648L51.4092 27.9941ZM82.1016 45.7627L82.019 46.3002C82.2775 46.3399 82.5276 46.19 82.6145 45.9433C82.7014 45.6967 82.6003 45.4231 82.374 45.2921L82.1016 45.7627ZM81.3389 45.7051V45.1613H81.3388L81.3389 45.7051ZM76.3604 50.6836L75.8166 50.6836V50.6836H76.3604ZM76.3604 73.1436H75.8166C75.8166 73.4439 76.06 73.6874 76.3604 73.6874V73.1436ZM76.5811 73.1436H77.1249C77.1249 72.8432 76.8814 72.5998 76.5811 72.5998V73.1436ZM76.5811 74.6973L76.3086 75.1679C76.4768 75.2653 76.6843 75.2655 76.8527 75.1684C77.0211 75.0713 77.1249 74.8917 77.1249 74.6973H76.5811ZM38.7422 52.791H38.1984C38.1984 52.9851 38.3018 53.1644 38.4697 53.2616L38.7422 52.791ZM38.7422 32.5391L38.1984 32.539V32.5391H38.7422ZM40.9219 27.2432L41.3081 27.626C42.5166 26.4066 44.0972 26.1151 45.846 26.3876C47.6075 26.6621 49.4763 27.5035 51.1367 28.4648L51.4092 27.9941L51.6816 27.5235C49.9728 26.5342 47.9682 25.6176 46.0135 25.313C44.0461 25.0064 42.0676 25.3147 40.5356 26.8604L40.9219 27.2432ZM51.4092 27.9941L51.1367 28.4648L81.8291 46.2333L82.1016 45.7627L82.374 45.2921L51.6816 27.5235L51.4092 27.9941ZM82.1016 45.7627L82.1842 45.2252C81.9078 45.1828 81.6252 45.1613 81.3389 45.1613V45.7051V46.2489C81.5709 46.2489 81.7982 46.2663 82.019 46.3002L82.1016 45.7627ZM81.3389 45.7051L81.3388 45.1613C78.2891 45.1614 75.8168 47.6338 75.8166 50.6836L76.3604 50.6836L76.9041 50.6836C76.9043 48.2345 78.8898 46.249 81.3389 46.2489L81.3389 45.7051ZM76.3604 50.6836H75.8166V73.1436H76.3604H76.9041V50.6836H76.3604ZM76.3604 73.1436V73.6874H76.5811V73.1436V72.5998H76.3604V73.1436ZM76.5811 73.1436H76.0373V74.6973H76.5811H77.1249V73.1436H76.5811ZM76.5811 74.6973L76.8535 74.2267L39.0146 52.3204L38.7422 52.791L38.4697 53.2616L76.3086 75.1679L76.5811 74.6973ZM38.7422 52.791H39.286V32.5391H38.7422H38.1984V52.791H38.7422ZM38.7422 32.5391L39.286 32.5391C39.2861 30.623 40.0577 28.8877 41.3081 27.626L40.9219 27.2432L40.5356 26.8604C39.0916 28.3175 38.1985 30.3248 38.1984 32.539L38.7422 32.5391Z" fill="#4C65FF" fill-opacity="0.4" mask="url(#path-16-inside-2_75349_95511)"/>
</g>
<foreignObject x="62.6849" y="32.0267" width="34.8763" height="57.3138"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(6.84px);clip-path:url(#bgblur_3_75349_95511_clip_path);height:100%;width:100%"></div></foreignObject><path data-figma-bg-blur-radius="13.6764" d="M76.3613 49.4649C76.3613 47.3873 78.0455 45.7031 80.1231 45.7031C82.2006 45.7031 83.8848 47.3873 83.8848 49.4649V71.9341C83.8848 73.1769 83.2671 74.3384 82.2366 75.0331C80.9886 75.8745 79.3431 75.8756 78.0842 75.0507C77.0166 74.3512 76.3613 73.1529 76.3613 71.8765V49.4649Z" fill="white"/>
<path d="M83.8854 74.8506L83.8854 49.3568C83.8854 47.2181 82.1517 45.4844 80.013 45.4844C77.8744 45.4844 76.1406 47.2181 76.1406 49.3568V72.923" stroke="#4C65FF" stroke-opacity="0.4" stroke-width="0.544347"/>
<path d="M31.2036 30.2348C31.315 27.326 33.3364 26.1006 35.9118 27.4767C36.9583 28.0358 38.1153 28.6721 39.2997 29.3559C40.4996 30.0487 41.6714 30.7577 42.7285 31.4141C45.2862 33.002 47.3008 36.5274 47.4079 39.542C47.457 40.9237 47.4939 42.3586 47.4939 43.5488C47.4939 44.7017 47.4593 46.0444 47.4125 47.3317C47.3053 50.2779 45.2207 51.4673 42.6158 50.0908C41.4154 49.4565 40.2043 48.802 39.2997 48.2797C38.4055 47.7635 37.2119 47.0306 36.0253 46.2878C33.4024 44.6459 31.3109 41.0146 31.1988 37.9214C31.1461 36.4677 31.1055 35.038 31.1055 34.0869C31.1055 33.1072 31.1486 31.6697 31.2036 30.2348Z" fill="#EEF0FF"/>
<path d="M66.0121 47.5576L51.5706 39.2199C50.6503 38.6885 49.9043 39.1193 49.9043 40.1819C49.9043 41.2446 50.6503 42.5367 51.5706 43.0681L66.0121 51.4059C66.9324 51.9372 67.6784 51.5065 67.6784 50.4438C67.6784 49.3812 66.9324 48.089 66.0121 47.5576Z" fill="#EEF0FF"/>
<path opacity="0.7" d="M76.01 61.6659L51.5706 47.5558C50.6503 47.0245 49.9043 47.4552 49.9043 48.5179C49.9043 49.5805 50.6503 50.8727 51.5706 51.404L76.01 65.5141C76.9303 66.0454 77.6763 65.6147 77.6763 64.5521C77.6763 63.4894 76.9303 62.1972 76.01 61.6659Z" fill="#EEF0FF"/>
</g>
<defs>
<clipPath id="bgblur_0_75349_95511_clip_path" transform="translate(-21.2904 -46.1205)"><rect width="40.6108" height="8.94798" transform="matrix(0.866025 0.5 0 1 34.9668 59.7969)"/>
</clipPath><clipPath id="bgblur_1_75349_95511_clip_path" transform="translate(-45.4251 11.317)"><path d="M109.177 28.252V60.3496L97.1768 67.3496L77.5781 54.4629L59.1016 43.5273V2.35938L109.177 28.252Z"/>
</clipPath><clipPath id="bgblur_2_75349_95511_clip_path" transform="translate(-25.0658 -12.0736)"><path d="M40.9219 27.2432C43.6624 24.4782 48.04 26.0435 51.4092 27.9941L82.1016 45.7627C81.853 45.7245 81.5981 45.7051 81.3389 45.7051C78.5894 45.7052 76.3606 47.9342 76.3604 50.6836V73.1436H76.5811V74.6973L38.7422 52.791V32.5391C38.7423 30.4739 39.5746 28.6026 40.9219 27.2432Z"/>
</clipPath><clipPath id="bgblur_3_75349_95511_clip_path" transform="translate(-62.6849 -32.0267)"><path d="M76.3613 49.4649C76.3613 47.3873 78.0455 45.7031 80.1231 45.7031C82.2006 45.7031 83.8848 47.3873 83.8848 49.4649V71.9341C83.8848 73.1769 83.2671 74.3384 82.2366 75.0331C80.9886 75.8745 79.3431 75.8756 78.0842 75.0507C77.0166 74.3512 76.3613 73.1529 76.3613 71.8765V49.4649Z"/>
</clipPath><linearGradient id="paint0_linear_75349_95511" x1="52.5502" y1="61.3749" x2="31.8375" y2="78.7411" gradientUnits="userSpaceOnUse">
<stop stop-color="#7084FF"/>
<stop offset="1" stop-color="#7084FF" stop-opacity="0.3"/>
</linearGradient>
<linearGradient id="paint1_linear_75349_95511" x1="28" y1="88.9639" x2="46.7997" y2="124.818" gradientUnits="userSpaceOnUse">
<stop stop-color="#7084FF"/>
<stop offset="1" stop-color="#7084FF" stop-opacity="0"/>
</linearGradient>
<linearGradient id="paint2_linear_75349_95511" x1="106.049" y1="62.2992" x2="104.135" y2="102.457" gradientUnits="userSpaceOnUse">
<stop stop-color="#7084FF"/>
<stop offset="1" stop-color="#7084FF" stop-opacity="0.3"/>
</linearGradient>
<linearGradient id="paint3_linear_75349_95511" x1="123.499" y1="91.2" x2="104.443" y2="83.6317" gradientUnits="userSpaceOnUse">
<stop stop-color="#7084FF"/>
<stop offset="1" stop-color="#7084FF" stop-opacity="0"/>
</linearGradient>
</defs>
</svg>
`;

// Chart state
const chartState = createChartState();
chartState.colors = { ...getChartColors() };
chartState.description = { ...defaultDescription };

// DOM Elements
const containerEl = document.getElementById('container') as HTMLDivElement;
containerEl.style.position = 'relative';

let hasRenderableData = false;
type OverlayState = 'loading' | 'empty' | 'hidden';

const loadingOverlay = document.createElement('div');
loadingOverlay.style.position = 'absolute';
loadingOverlay.style.inset = '0';
loadingOverlay.style.display = 'flex';
loadingOverlay.style.alignItems = 'stretch';
loadingOverlay.style.justifyContent = 'stretch';
loadingOverlay.style.pointerEvents = 'none';
loadingOverlay.style.background = chartState.colors.background;
loadingOverlay.style.zIndex = '20';

const loadingChart = document.createElement('div');
loadingChart.style.width = '100%';
loadingChart.style.height = '100%';
loadingChart.style.borderRadius = '20px';
loadingChart.style.background = chartState.colors.border;
loadingChart.style.position = 'relative';
loadingChart.style.overflow = 'hidden';

const loadingLogo = document.createElement('div');
loadingLogo.style.position = 'absolute';
loadingLogo.style.left = '12px';
loadingLogo.style.bottom = '12px';
loadingLogo.style.width = '88px';
loadingLogo.style.height = '20px';
loadingLogo.style.borderRadius = '10px';
loadingLogo.style.background = chartState.colors.border;
loadingLogo.style.boxShadow = `0 0 0 1px ${chartState.colors.background} inset`;

loadingChart.appendChild(loadingLogo);
loadingOverlay.appendChild(loadingChart);
containerEl.appendChild(loadingOverlay);

const emptyOverlay = document.createElement('div');
emptyOverlay.style.position = 'absolute';
emptyOverlay.style.inset = '0';
emptyOverlay.style.display = 'none';
emptyOverlay.style.alignItems = 'center';
emptyOverlay.style.justifyContent = 'center';
emptyOverlay.style.pointerEvents = 'none';
emptyOverlay.style.background = chartState.colors.background;
emptyOverlay.style.zIndex = '21';

const emptyState = document.createElement('div');
emptyState.style.display = 'flex';
emptyState.style.flexDirection = 'column';
emptyState.style.alignItems = 'center';
emptyState.style.justifyContent = 'center';
emptyState.style.gap = '4px';
emptyState.style.width = '169px';

const emptyIllustration = document.createElement('div');
emptyIllustration.style.width = '163px';
emptyIllustration.style.height = '126px';
emptyIllustration.style.display = 'flex';
emptyIllustration.style.alignItems = 'center';
emptyIllustration.style.justifyContent = 'center';
emptyIllustration.innerHTML = EMPTY_SVG;

const emptyText = document.createElement('div');
emptyText.style.fontFamily =
  '"SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
emptyText.style.fontSize = '16px';
emptyText.style.lineHeight = '20px';
emptyText.style.fontWeight = '400';
emptyText.style.textAlign = 'center';
emptyText.style.color = chartState.colors.secondaryText;
emptyText.textContent = chartState.description.empty;

emptyState.appendChild(emptyIllustration);
emptyState.appendChild(emptyText);
emptyOverlay.appendChild(emptyState);
containerEl.appendChild(emptyOverlay);

function updateLoadingSkeletonTheme(colors: ChartColors) {
  loadingOverlay.style.background = colors.background;
  loadingChart.style.background = colors.border;
  loadingLogo.style.background = colors.border;
  loadingLogo.style.boxShadow = `0 0 0 1px ${colors.background} inset`;
}

function updateEmptyStateTheme(
  colors: ChartColors,
  description: ChartDescription,
) {
  emptyOverlay.style.background = colors.background;
  emptyIllustration.innerHTML = EMPTY_SVG;
  emptyText.style.color = colors.secondaryText;
  emptyText.textContent = description.empty;
}

function setOverlayState(state: OverlayState) {
  loadingOverlay.style.display = state === 'loading' ? 'flex' : 'none';
  emptyOverlay.style.display = state === 'empty' ? 'flex' : 'none';
  if (state !== 'hidden' && chartState.tooltip) {
    chartState.tooltip.style.display = 'none';
  }
}

function resetPriceLines() {
  if (chartState.candlestickSeries) {
    Object.values(chartState.priceLineContainers).forEach(line => {
      if (line) {
        chartState.candlestickSeries!.removePriceLine(line);
      }
    });
  }

  chartState.priceLineContainers = {
    tp: null,
    sl: null,
    liquidation: null,
    entry: null,
  };
}

function clearChartData() {
  chartState.currentData = [];
  chartState.isInitialDataLoad = true;
  chartState.lastDataKey = null;
  chartState.currentExtremes = null;

  if (chartState.clearMarkers) {
    chartState.clearMarkers.setMarkers([]);
    chartState.clearMarkers = null;
  }

  resetPriceLines();

  if (chartState.candlestickSeries) {
    chartState.candlestickSeries.setData([]);
    chartState.candlestickSeries.priceScale().applyOptions({
      scaleMargins: { top: 0, bottom: 0 },
    });
  }

  if (chartState.volumeSeries) {
    chartState.volumeSeries.setData([]);
  }
}

// Create tooltip element
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.display = 'none';
tooltip.style.pointerEvents = 'none';
tooltip.style.background = chartState.colors.tooltip.bg;
tooltip.style.color = '#D1D4DC';
tooltip.style.padding = '8px 9px';
tooltip.style.borderRadius = '8px';
tooltip.style.fontSize = '12px';
tooltip.style.lineHeight = '1.4';
tooltip.style.zIndex = '1000';
containerEl.appendChild(tooltip);
chartState.tooltip = tooltip;

// Update tooltip content
function updateTooltipContent(param: any) {
  if (!chartState.tooltip || !chartState.colors || !chartState.description)
    return;

  const tooltipEl = chartState.tooltip;
  const point = param.point;

  if (!point || param.time === undefined) {
    tooltipEl.style.display = 'none';
    return;
  }

  const candleData = chartState.candlestickSeries
    ? param.seriesData.get(chartState.candlestickSeries)
    : undefined;
  const volumeDataPoint = chartState.volumeSeries
    ? param.seriesData.get(chartState.volumeSeries)
    : undefined;

  if (!candleData) {
    tooltipEl.style.display = 'none';
    return;
  }

  const open = candleData.open;
  const high = candleData.high;
  const low = candleData.low;
  const close = candleData.close;
  const volume = volumeDataPoint?.value;

  const change = close - open;
  const changePercent = open !== 0 ? (change / open) * 100 : 0;
  const isPositive = change >= 0;

  // Build tooltip HTML
  let tooltipHTML = '';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.time +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatTime(param.time, chartState.noTime) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.open +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(open) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.high +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(high) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.low +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(low) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.close +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(close) +
    '</span>';
  tooltipHTML += '</div>';

  if (typeof volume === 'number') {
    tooltipHTML +=
      '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
    tooltipHTML +=
      '<span style="color: ' +
      chartState.colors.tooltip.title +
      '; font-size: 10px;">' +
      chartState.description.volume +
      ':</span>';
    tooltipHTML +=
      '<span style="color: ' +
      chartState.colors.tooltip.value +
      '; font-size: 10px; font-weight: 600;">' +
      formatNumber(volume) +
      '</span>';
    tooltipHTML += '</div>';
  }

  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.chg +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    (isPositive
      ? chartState.colors.greenLineColor
      : chartState.colors.redLineColor) +
    '; font-size: 10px; font-weight: 600;">' +
    (isPositive ? '+' : '') +
    formatPrice(change) +
    '</span>';
  tooltipHTML += '</div>';

  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.chgPercent +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    (isPositive
      ? chartState.colors.greenLineColor
      : chartState.colors.redLineColor) +
    '; font-size: 10px; font-weight: 600;">' +
    (isPositive ? '+' : '') +
    changePercent.toFixed(2) +
    '%</span>';
  tooltipHTML += '</div>';

  tooltipEl.innerHTML = tooltipHTML;

  const containerRect = containerEl.getBoundingClientRect();
  const isLeftSide = point.x < containerRect.width / 2;
  tooltipEl.style.top = '8px';
  if (isLeftSide) {
    tooltipEl.style.right = '8px';
    tooltipEl.style.left = 'auto';
  } else {
    tooltipEl.style.left = '8px';
    tooltipEl.style.right = 'auto';
  }
  tooltipEl.style.display = 'block';
}

// Create chart
function createChart() {
  if (!containerEl) {
    console.error('TradingView: Container not found');
    return;
  }

  const colors = chartState.colors || getChartColors();

  chartState.chart = LcCreateChart(containerEl, {
    width: window.innerWidth,
    height: window.innerHeight,
    layout: {
      background: {
        color: colors.background,
      },
      textColor: colors.text,
      attributionLogo: true,
    },
    localization: {
      priceFormatter: formatPrice,
      timeFormatter: (t: number) => formatTime(t, chartState.noTime),
    },
    grid: {
      vertLines: { color: colors.border },
      horzLines: { color: colors.border },
    },
    timeScale: {
      barSpacing: 10,
      timeVisible: true,
      secondsVisible: false,
      borderColor: 'transparent',
      tickMarkFormatter: (t: number, tickMarkType: number) => {
        const MONTHS = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const d = new Date(t * 1000);
        const mon = MONTHS[d.getMonth()];
        const day = String(d.getDate()).padStart(2, '0');
        const yr = String(d.getFullYear()).slice(-2);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        if (tickMarkType === 0) return String(d.getFullYear());
        if (tickMarkType === 1) return mon + " '" + yr;
        if (tickMarkType === 2) return day + ' ' + mon;
        if (tickMarkType >= 3) return hours + ':' + minutes;
        return day + ' ' + mon;
      },
      minBarSpacing: 2,
      maxBarSpacing: 30,
      fixLeftEdge: true,
      fixRightEdge: true,
    },
    trackingMode: {
      exitMode: 0,
    },
    rightPriceScale: {
      borderColor: 'transparent',
      borderVisible: false,
      minimumWidth: 50,
      scaleMargins: {
        top: 0,
        bottom: 0,
      },
    },
    leftPriceScale: {
      borderColor: 'transparent',
    },
  });

  // Setup logo hijack
  setTimeout(() => {
    const el = document.getElementById('tv-attr-logo');
    if (el) {
      el.addEventListener(
        'click',
        function (e) {
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch (error: any) {}
          if ((window as any).ReactNativeWebView) {
            postMessageToRN({
              type: 'ATTR_LOGO_CLICK',
              timestamp: Date.now(),
            });
          }
          return false;
        },
        true,
      );
    }
  }, 500);

  // Subscribe to crosshair move
  chartState.chart.subscribeCrosshairMove((param: any) => {
    updateTooltipContent(param);
  });

  // Subscribe to visible range change
  let updateTimeout: number | null = null;
  chartState.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = window.setTimeout(() => {
      updatePriceLines(chartState);
    }, 100);
  });

  // Notify RN that chart is ready
  postMessageToRN({
    type: 'CHART_READY',
    timestamp: new Date().toISOString(),
  });
}

// Create candlestick series
function createCandlestickSeries() {
  if (!chartState.chart) return null;

  if (chartState.candlestickSeries) {
    chartState.chart.removeSeries(chartState.candlestickSeries);
  }

  const colors = chartState.colors || getChartColors();

  chartState.candlestickSeries = chartState.chart.addSeries(CandlestickSeries, {
    upColor: colors.greenLineColor,
    downColor: colors.redLineColor,
    borderDownColor: colors.redLineColor,
    borderUpColor: colors.greenLineColor,
    wickDownColor: colors.redLineColor,
    wickUpColor: colors.greenLineColor,
    lastValueVisible: true,
    priceLineVisible: true,
    priceLineSource: 0,
    priceLineWidth: 1,
    priceLineStyle: 2,
    priceFormat: {
      type: 'price',
      minMove: 0.0000001,
    },
  });

  return chartState.candlestickSeries;
}

// Create volume series
function createVolumeSeries() {
  if (!chartState.chart) return null;

  if (chartState.volumeSeries) {
    chartState.chart.removeSeries(chartState.volumeSeries);
  }

  chartState.volumeSeries = chartState.chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    lastValueVisible: false,
    priceLineVisible: false,
  });

  return chartState.volumeSeries;
}

// Handle SET_CANDLESTICK_DATA message
function handleSetCandlestickData(
  message: Omit<
    DuplexDefs['TradingViewMessage']['receive']['data'] & {
      type: 'SET_CANDLESTICK_DATA';
    },
    'type'
  >,
) {
  chartState.noTime = !!message.noTime;

  if (!chartState.chart) return;

  if (!message.data?.length) {
    hasRenderableData = false;
    clearChartData();
    setOverlayState('empty');
    return;
  }

  if (!chartState.candlestickSeries) {
    createCandlestickSeries();
  }

  if (chartState.candlestickSeries) {
    hasRenderableData = true;
    setOverlayState('hidden');
    chartState.currentData = message.data;
    chartState.candlestickSeries.setData(message.data);

    const currentDataKey = message.source + '_' + (message.data?.length || 0);
    const shouldAutoscale =
      chartState.isInitialDataLoad || chartState.lastDataKey !== currentDataKey;
    if (shouldAutoscale) {
      chartState.lastDataKey = currentDataKey;
    }
    chartState.isInitialDataLoad = false;

    if (message.showVolume) {
      if (!chartState.volumeSeries) {
        createVolumeSeries();
      }
      const colors = chartState.colors || getChartColors();
      chartState.volumeSeries.setData(
        message.data.map(item => ({
          time: item.time,
          value: item.volume || 0,
          color:
            item.close >= item.open
              ? colors.greenLineColor
              : colors.redLineColor,
        })),
      );
      chartState.candlestickSeries.priceScale().applyOptions({
        scaleMargins: { top: 0, bottom: 0.1 },
      });
      chartState.volumeSeries
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.9, bottom: 0 } });
      updatePriceLines(chartState);
    }

    if (message.fitContent) {
      chartState.chart.timeScale().fitContent();
    }
    chartState.chart.timeScale().scrollToRealTime();
  }
}

// Handle UPDATE_CANDLESTICK_DATA message
function handleUpdateCandlestickData(data: TradingViewCandlestickData) {
  if (!chartState.chart || !chartState.candlestickSeries || !data) return;
  hasRenderableData = true;
  setOverlayState('hidden');
  chartState.candlestickSeries.update(data);
}

// Handle UPDATE_TPSL_PRICE_LINES message
function handleUpdateTPSLPriceLines(data: TPSLPriceLines) {
  if (!chartState.chart || !chartState.candlestickSeries || !data) return;
  updateTPSLPriceLinesLogic(chartState, data);
}

// Handle UPDATE_THEME message
function handleUpdateTheme(colors: ChartColors, description: ChartDescription) {
  chartState.colors = colors;
  chartState.description = description;
  updateLoadingSkeletonTheme(colors);
  updateEmptyStateTheme(colors, description);

  if (chartState.chart) {
    chartState.chart.applyOptions({
      layout: {
        background: { color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.border },
        horzLines: { color: colors.border },
      },
    });
  }

  if (chartState.tooltip) {
    chartState.tooltip.style.background = colors.tooltip.bg;
  }

  containerEl.style.background = colors.background;
  document.body.style.background = colors.background;
}

// Handle messages from RN
function handleMessage(event: CustomEvent) {
  const message = event.detail as DuplexReceive;

  switch (message.type) {
    case 'GOT_RUNTIME_INFO': {
      // Apply initial theme from runtime info
      const { isDark, i18nTexts, backGroundColor } = message.info;
      const colors = getChartColors(!isDark);
      if (backGroundColor) {
        colors.background = backGroundColor;
      }
      const description: ChartDescription = {
        tp: i18nTexts?.['component.kline.tp'] || defaultDescription.tp,
        entry: i18nTexts?.['component.kline.entry'] || defaultDescription.entry,
        sl: i18nTexts?.['component.kline.sl'] || defaultDescription.sl,
        liq: i18nTexts?.['component.kline.liq'] || defaultDescription.liq,
        high: i18nTexts?.['component.kline.high'] || defaultDescription.high,
        low: i18nTexts?.['component.kline.low'] || defaultDescription.low,
        time: i18nTexts?.['component.kline.time'] || defaultDescription.time,
        open: i18nTexts?.['component.kline.open'] || defaultDescription.open,
        close: i18nTexts?.['component.kline.close'] || defaultDescription.close,
        chg: i18nTexts?.['component.kline.chg'] || defaultDescription.chg,
        chgPercent:
          i18nTexts?.['component.kline.chgPercent'] ||
          defaultDescription.chgPercent,
        volume:
          i18nTexts?.['component.kline.volume'] || defaultDescription.volume,
        empty: i18nTexts?.['component.kline.empty'] || defaultDescription.empty,
      };
      handleUpdateTheme(colors, description);
      break;
    }
    case 'TRADINGVIEW_MESSAGE': {
      // Handle TradingView specific messages
      const tvMessage = message.data;
      switch (tvMessage.type) {
        case 'SET_CANDLESTICK_DATA':
          handleSetCandlestickData({
            data: tvMessage.data,
            source: tvMessage.source,
            showVolume: tvMessage.showVolume,
            fitContent: tvMessage.fitContent,
            noTime: tvMessage.noTime,
          });
          break;
        case 'UPDATE_CANDLESTICK_DATA':
          handleUpdateCandlestickData(tvMessage.data);
          break;
        case 'UPDATE_TPSL_PRICE_LINES':
          handleUpdateTPSLPriceLines(tvMessage.data);
          break;
        case 'UPDATE_THEME':
          handleUpdateTheme(tvMessage.colors, tvMessage.description);
          break;
      }
      break;
    }
  }
}

// Window resize handler
let resizeTimeout: number | null = null;
function handleResize() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  resizeTimeout = window.setTimeout(() => {
    if (chartState.chart) {
      chartState.chart.applyOptions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, 100);
}

// Initialize
function init() {
  // Set initial background
  if (containerEl) {
    containerEl.style.background =
      chartState.colors?.background || getChartColors().background;
  }
  document.body.style.background =
    chartState.colors?.background || getChartColors().background;
  setOverlayState(hasRenderableData ? 'hidden' : 'loading');

  // Add event listeners
  window.addEventListener('messageFromRN', handleMessage as EventListener);
  window.addEventListener('resize', handleResize);

  // Request runtime info (theme, i18n) from RN
  postMessageToRN({ type: 'GET_RUNTIME_INFO' });

  // Create chart
  createChart();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.removeEventListener('messageFromRN', handleMessage as EventListener);
  window.removeEventListener('resize', handleResize);
  if (chartState.chart) {
    chartState.chart.remove();
  }
});

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
