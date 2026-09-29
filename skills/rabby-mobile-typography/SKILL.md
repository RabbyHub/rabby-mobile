---
name: rabby-mobile-typography
description: 规范 Rabby Mobile 原生字体和字重，排查机型上的文字显示异常。修改 apps/mobile 的 fontFamily、fontWeight、文字样式或字体兼容性时使用；Web/CSS 和 SVG 字体按各自渲染环境判断。
---

# Rabby Mobile 字体与字重

从字体文件、样式转换路径和最终原生 Text 样式判断兼容性，不以 React Native 类型允许某个字重作为项目支持的依据。

## 标准与依据

业务文字显式设置字重时，统一使用字符串 `'400'`、`'500'`、`'700'`、`'900'`。默认正文可以省略字重；不要为了补齐声明改变现有字体或继承关系。新代码不使用 `'normal'`、`'bold'`、`'semibold'` 等别名表示这四档。

| 语义 | 业务字重 | SF Pro Rounded 文件 | 绕过主题工厂时的常量 |
| --- | --- | --- | --- |
| Regular / 正文 | `'400'` | `SF-Pro-Rounded-Regular.otf` | `FontNames.sf_pro_rounded_regular` |
| Medium / 中等 | `'500'` | `SF-Pro-Rounded-Medium.otf` | `FontNames.sf_pro_rounded_medium` |
| Bold / 加粗 | `'700'` | `SF-Pro-Rounded-Bold.otf` | `FontNames.sf_pro_rounded_bold` |
| Heavy / 强强调 | `'900'` | `SF-Pro-Rounded-Heavy.otf` | `FontNames.sf_pro_rounded_heavy` |

源码依据：

- [字体资产](../../apps/mobile/assets/fonts)、[原生资源配置](../../apps/mobile/react-native.config.js) 和 [iOS 字体注册](../../apps/mobile/ios/RabbyMobile/Info.plist)：Rounded 只打包上述四个独立文件。
- [fonts.ts](../../apps/mobile/src/core/utils/fonts.ts)：`FontNames` 处理 iOS PostScript 名和 Android 文件名的差异；`getFontWeightType` 决定项目内部的字重分组。
- [styles.ts](../../apps/mobile/src/utils/styles.ts)：`mutateStyles` 把 Rounded 的 Heavy 分组选为 Android Heavy 字体文件，`'900'` 才进入该组，`'800'` 会落到 Bold。
- [PR #2206](https://github.com/RabbyHub/rabby-mobile/pull/2206)：业务 Rounded 字重从 `'800'` 修正为 `'900'`。这确立的是项目调用约定；不要将其描述成 Heavy 字体文件本身的元数据是 900，或所有系统字体的 Heavy 都等于 900。
- [旧版 Text](../../apps/mobile/src/components/Text.tsx)：Android Roboto 用 `'500'` 表达旧业务的 semibold 意图。该组件的历史容错不代表所有文字组件都会修正字重。

迁移已有样式时，先确定最终字体：Rounded 的 `'600'` 改为 `'700'`，保持已有 Android Bold 映射；系统默认字体、旧版 SF Pro/Roboto 的 `'600'` 改为 `'500'`，沿用项目历史约定；业务强强调的 `'800'` 改为 `'900'`。不要把所有 `'600'` 无区别替换为同一个值。`FontWeightEnum` 和通用分类函数可以保留完整原生字重枚举；它们接受输入不等于业务样式应使用该输入。

## 样式转换边界

优先沿用当前组件的字体体系。2024 业务样式使用 `SF Pro Rounded`；旧样式中的 `SF Pro` 在主题工厂中会转换为 iOS `SF Pro` / Android `Roboto`，不要顺带重设计旧页面的字体。

文字组件从 [Typography](../../apps/mobile/src/components/Typography.tsx) 导入，包括 `Text`、`TextInput`、`AnimatedText` 等。它提供默认 `allowFontScaling: false`，**不转换 fontFamily/fontWeight，也不校验字体**。

`createGetStyles` 和 `createGetStyles2024` 的普通样式经过 `mutateStyles`：

- iOS 保留 `SF Pro Rounded` 与业务字重。
- Android 将 family 改为对应的单字重文件名，并删除 `fontWeight`。
- 转换按每个样式对象独立执行，不会先合并 Text 的 style 数组。需要改变 Rounded 字重的每个样式对象都应同时声明 family 和 weight。
- `createGetStyles2024` 返回的 `reanimatedStyles` 函数不经过该转换。普通 `StyleSheet.create`、内联样式、动画样式、第三方组件的 text/title/input style 也不能假定经过转换。

主题样式示例：

```tsx
import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  label: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    color: colors2024['neutral-title-1'],
  },
  selectedLabel: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
}));

// styles 来自 useTheme2024({ getStyle: getStyles })。
// 每个覆盖层都能独立得到正确的 Android 字体文件。
<Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>;
```

不要使用 `[styles.label, { fontWeight: '700' }]` 给转换后的 Android 单字重 family 加粗，也不要把 family 与 weight 拆成两个待转换的样式。

必须绕过主题工厂时，直接使用 `FontNames` 的具体文件常量，不再叠加 `fontWeight`：

```tsx
import { StyleSheet } from 'react-native';
import { FontNames } from '@/core/utils/fonts';

const textStyles = StyleSheet.create({
  amount: { fontFamily: FontNames.sf_pro_rounded_heavy, fontSize: 32 },
});
```

这些具体文件名不要放进当前 `createGetStyles` / `createGetStyles2024`：`mutateStyles` 后续的宽泛 SF Pro 匹配会把它们转换成 `FontNames.sf_pro`。主题工厂内使用通用 Rounded family + 标准字重；工厂外使用单字重常量。`cleanSpecialSoloWeightFont` 只对显式调用生效，不能修复后续 style 数组追加的 weight。

第三方文字组件要追踪最终 style 合并顺序、默认字体和默认字重；仅修改调用处的字重不能证明最终样式正确。处理 Reanimated 数值文本时把静态字体留在现有静态样式中，不为字体修复新增每帧处理。

## 排查范围与例外

从仓库根目录搜索，包括属性、条件表达式、传入第三方组件的样式和 NativeWind 类名，再沿组件调用链确认继承及覆盖：

```bash
rg -n 'fontWeight|fontFamily|font-weight|font-family' apps/mobile/src
rg -n 'font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)' apps/mobile
rg --files apps/mobile/assets/fonts
```

搜索零命中某个字面量不是完整覆盖证据；同时检查数字值、枚举、动态 props、平台分支和后续 style 覆盖。迁移应落在业务调用处，不为清除搜索结果修改通用枚举或测试中的非法输入用例。

- WebView HTML/CSS、`apps/mobile-local-pages`、SVG 文本由不同的字体解析路径处理，不能机械套用 RN Rounded 的规则；先查其 `@font-face`、实际资产或 SVG 字体依赖。
- Pro K 线的 [perps-pro-font.ts](../../apps/mobile-local-pages/src/pages/tradingview-candle-chart/perps-pro-font.ts) 只为 `Rabby SF Pro Rounded` 注册 `400 / 500 / 700`，十字光标标签用 `500`、Pro tooltip 强调用 `700`。不要写 `510`、`600` 或直接搬用原生的 `900`。同文件里的 legacy 图表分支与 demo 使用系统 Web 字体，其 `600` 不属于原生 Rounded 的缺档问题。
- `System`、`Roboto`、`monospace`、`Menlo` 等系统/等宽字体不转换成 Rounded。普通业务字重仍遵循四档；确实需要其他系统或等宽字重时，保留有明确产品用途与目标平台字体支持证据的例外，并在代码附近说明。
- 字体资产升级或新增字重需要同步检查两端注册与平台字体名，不能只增加一个 CSS 数字或枚举值。

## 验证与性能

有限静态样式迁移应保持原有组件、主题工厂、订阅边界和布局逻辑。不要在 Typography 或每次 render 中新增全量样式扫描，不要通过改变全局字重分类来替代调用处修复。Home 和列表仍检查是否引入样式对象重建、额外订阅或渲染扩散；纯字面量修复通常无需性能基准。

修改 `apps/mobile` 代码后执行 [AGENTS.md](../../AGENTS.md) 的完整必需验证集：

```bash
yarn workspace rabby-mobile lint:cycles
yarn workspace rabby-mobile lint:cycles:eslint
yarn workspace rabby-mobile typecheck
yarn workspace rabby-mobile test --runInBand
yarn workspace rabby-mobile test:integration:ci
```

静态检查和 Jest 无法证明原生字形正确。用 iOS、Android 真机检查受影响的普通文字、金额/数字、输入框、按钮、动画文字及截断布局，优先覆盖原故障机型与对应文字内容；比较四档字重、中文与英文混排、长文本是否缺字、回退或裁切。交付时说明实际验证的平台、场景和剩余未验证项；没有真机证据时不要宣称已修复所有机型。
