---
name: rabby-mobile-typography
description: 规范 Rabby Mobile 原生字体和字重，排查机型上的文字显示异常。修改 apps/mobile 的 fontFamily、fontWeight、文字样式或字体兼容性时使用；Web/CSS 和 SVG 字体按各自渲染环境判断。
---

# Rabby Mobile 字体与字重

从字体文件、样式转换路径和最终原生 Text 样式判断兼容性，不以 React Native 类型允许某个字重作为项目支持的依据。

## 标准与依据

业务文字显式设置字重时，统一使用字符串 `'400'`、`'500'`、`'700'`、`'900'`。默认正文可以省略字重；不要为了补齐声明改变现有字体或继承关系。新代码不使用 `'normal'`、`'bold'`、`'semibold'` 等别名表示这四档。

| 语义           | 业务字重 | iOS `ui-rounded` 字重 | Android SF Pro Rounded 文件  | 工厂外静态样式              |
| -------------- | -------- | --------------------- | ---------------------------- | --------------------------- |
| Regular / 正文 | `'400'`  | `'400'`               | `SF-Pro-Rounded-Regular.otf` | `RoundedFontStyles.regular` |
| Medium / 中等  | `'500'`  | `'500'`               | `SF-Pro-Rounded-Medium.otf`  | `RoundedFontStyles.medium`  |
| Bold / 加粗    | `'700'`  | `'700'`               | `SF-Pro-Rounded-Bold.otf`    | `RoundedFontStyles.bold`    |
| Heavy / 强强调 | `'900'`  | `'800'`               | `SF-Pro-Rounded-Heavy.otf`   | `RoundedFontStyles.heavy`   |

源码依据：

- [字体资产](../../apps/mobile/assets/fonts)、[原生资源配置](../../apps/mobile/react-native.config.js)：上述四个独立文件仅供 Android 使用。iOS 不得内嵌 Apple 字体（ITMS-91182），也不得通过 `UIAppFonts` 或 WebView 再注册这些文件。
- iOS 依赖 **newArch / Fabric** 原生已有的 `ui-rounded` 支持；不为旧字体名或 oldArch 添加 RN 原生补丁、全局 font handler 或私有系统字体名。字体分支应基于 newArch 分支验证，不能单独带入 oldArch 出包分支。
- [fonts.ts](../../apps/mobile/src/core/utils/fonts.ts)：`getRoundedFontStyle` 生成完整的平台 family/weight；iOS 业务 Heavy 输出 `'800'`（UIKit Heavy），不是 `'900'`（Black）。`RoundedFontStyles` 提供四档静态对象，`FontNames.sf_pro` 为 iOS `System` / Android `Roboto`。`getFontWeightType` 保持项目内部的字重分组。
- [styles.ts](../../apps/mobile/src/utils/styles.ts)：`mutateStyles` 把 Rounded 的 Heavy 分组选为 Android Heavy 字体文件，`'900'` 才进入该组，`'800'` 会落到 Bold。
- [PR #2206](https://github.com/RabbyHub/rabby-mobile/pull/2206)：业务 Rounded 字重从 `'800'` 修正为 `'900'`。这确立的是项目调用约定；不要将其描述成 Heavy 字体文件本身的元数据是 900，或所有系统字体的 Heavy 都等于 900。
- [旧版 Text](../../apps/mobile/src/components/Text.tsx)：Android Roboto 用 `'500'` 表达旧业务的 semibold 意图。该组件的历史容错不代表所有文字组件都会修正字重。

迁移已有样式时，先确定最终字体：Rounded 的 `'600'` 改为 `'700'`，保持已有 Android Bold 映射；系统默认字体、旧版 SF Pro/Roboto 的 `'600'` 改为 `'500'`，沿用项目历史约定；业务强强调的 `'800'` 改为 `'900'`。不要把所有 `'600'` 无区别替换为同一个值。`FontWeightEnum` 和通用分类函数可以保留完整原生字重枚举；它们接受输入不等于业务样式应使用该输入。

## 样式转换边界

优先沿用当前组件的字体体系。2024 主题样式用 `SF Pro Rounded` 作为逻辑 family；主题工厂输出 iOS `ui-rounded` 或 Android 单字重文件。旧样式中的 `SF Pro` 转换为 iOS `System` / Android `Roboto`，不要顺带重设计旧页面的字体。

文字组件从 [Typography](../../apps/mobile/src/components/Typography.tsx) 导入，包括 `Text`、`TextInput`、`AnimatedText` 等。它提供默认 `allowFontScaling: false`，**不转换 fontFamily/fontWeight，也不校验字体**。

`createGetStyles` 和 `createGetStyles2024` 的普通样式经过 `mutateStyles`：

- iOS 输出 `ui-rounded` 与对应系统字重，在已有样式创建边界转换，不在 Typography / 每次 render 中扫描样式。
- Android 输出对应的单字重文件名，并清空 `fontWeight`。
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

必须绕过主题工厂时，使用完整静态样式，不使用旧 PostScript 别名，也不单独追加业务 `fontWeight`：

```tsx
import { StyleSheet } from 'react-native';
import { RoundedFontStyles } from '@/core/utils/fonts';

const textStyles = StyleSheet.create({
  amount: { ...RoundedFontStyles.heavy, fontSize: 32 },
});
```

`mutateStyles` 不再把已经解析好的 Android 单字重 family 误改成 Roboto，也不会把 iOS 已解析的 `ui-rounded / 800` 重分组为 Bold；重复转换保持结果。需要动态字重的原始样式可在已有 memo / 样式创建阶段调用 `getRoundedFontStyle`。`cleanSpecialSoloWeightFont` 只清理 Android 单字重文件的冗余 weight，保留 iOS `ui-rounded` 的必要 weight。

style 数组的覆盖也要用完整样式：`[styles.label, RoundedFontStyles.heavy]`，不要追加 `{ fontWeight: '900' }`；后者在 iOS 会重新变成 Black，在 Android 会覆盖单字重文件的约定。

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
- react-native-svg 和 react-native-screens 的原生导航标题仍可能使用旧 `RCTFont`，不能从 App 已启用 newArch 推断它们支持 `ui-rounded`。固定图标文字（例如 GAS）使用路径，不嵌入字体；iOS 普通圆角导航标题通过应用侧 RN Text 渲染，保留原生导航容器与已有自定义标题。新增大标题或其它原生文字组件时单独确认支持，不新增原生兼容补丁。
- Pro K 线的 [perps-pro-font.ts](../../apps/mobile-local-pages/src/pages/tradingview-candle-chart/perps-pro-font.ts)：iOS 使用 CSS `ui-rounded`，不加载字体文件；Android 为 `Rabby SF Pro Rounded` 注册 `400 / 500 / 700`。十字光标标签用 `500`、Pro tooltip 强调用 `700`。不要写 `510`、`600` 或直接搬用原生的 `900`。同文件里的 legacy 图表分支与 demo 使用系统 Web 字体，其 `600` 不属于原生 Rounded 的缺档问题。
- `System`、`Roboto`、`monospace`、`Menlo` 等系统/等宽字体不转换成 Rounded。普通业务字重仍遵循四档；确实需要其他系统或等宽字重时，保留有明确产品用途与目标平台字体支持证据的例外，并在代码附近说明。
- 字体资产升级或新增字重需要同步检查 Android 资源和 iOS 系统字体解析，不能只增加一个 CSS 数字或枚举值。Xcode 的 `Check bundled system fonts` 阶段检查实际 `.app`；不要禁用该检查来绕过字体问题。

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

iOS 系统字体与打包边界的专项验证：

首次从内嵌字体版本切换时，旧的增量 `.app` 可能仍残留已从资源列表移除的字体。如果检查命中旧构建产物，清理该构建配置的产物后重新打包；不要跳过审计或在签名后修改包。

```bash
yarn workspace rabby-mobile test:ios-fonts
yarn workspace rabby-mobile check:ios-fonts /absolute/path/RabbyMobile.app
```

`fonts.test.ts` / `styles.test.ts` 验证 JS 映射、工厂边界与幂等，不证明原生字形。专项包测试验证资源排除和最终包审计，也不替代 newArch 真机视觉检查。原生导航标题改用 RN Text 后，不再拥有系统原生标题文字的转场动画，验收时需观察这一差异。
