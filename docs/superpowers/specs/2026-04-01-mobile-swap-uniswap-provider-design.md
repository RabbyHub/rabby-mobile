# Mobile Swap Uniswap Provider 接入设计

## 目标

让移动端 Swap 将 Uniswap 作为正式 provider 接入，满足以下结果：

- 用户在移动端 Swap provider 列表中可以看到 Uniswap
- Uniswap 只在 `@rabby-wallet/rabby-swap@0.0.75-beta.0` 已支持、且后端 `dex_list` 返回允许的场景下展示
- 用户选择 Uniswap 后可以正常获取 quote、通过本地安全校验，并进入现有交易提交流程
- 改动保持和桌面端 PR #3613 对齐，不额外引入兼容层或新的配置开关

## 非目标

- 不重构移动端 Swap provider 架构
- 不新增 `UNISWAP`/`UNI` 历史别名兼容
- 不改变现有 dex 展示策略、排序策略或后端接口协议
- 不扩展到 Bridge、Approve 或其他交易类型

## 当前问题

移动端仓库里已经有部分接入痕迹：

- `apps/mobile/package.json` 已升级 `@rabby-wallet/rabby-swap` 到 `0.0.75-beta.0`
- `apps/mobile/src/constant/swap.ts` 已把 `DEX_ENUM.UNI` 加入本地 DEX 定义

但当前接入还没有完全闭环：

- Swap 本地校验逻辑仍存在 `DEX_ENUM['UNISWAP']` 旧判断
- 如果本地逻辑继续使用旧枚举名，Uniswap quote 即使能返回，也可能在 calldata decode / verify 阶段被误判
- 因此目前状态更像“半接入”，还不足以保证它是正式可交易 provider

根因不是 UI 少一个入口，而是移动端仍有一处以上 provider 标识没有完全对齐到当前 SDK 枚举。

## 方案

采用“交易链路完整对齐”方案：以 `@rabby-wallet/rabby-swap@0.0.75-beta.0` 为唯一事实来源，将移动端所有和 Uniswap provider 相关的识别逻辑统一到 `DEX_ENUM.UNI`。

### 1. 依赖与常量

- 保持 `@rabby-wallet/rabby-swap@0.0.75-beta.0`
- 在 `apps/mobile/src/constant/swap.ts` 中保留 Uniswap logo 和 `DEX_ENUM.UNI` 的 DEX 配置
- 不额外增加本地 feature flag

### 2. Provider 展示

移动端现有展示逻辑保持不变：

- 本地 `DEX` 定义负责提供 logo、名称和链支持元数据
- `openapi.getSupportedDEXList()` 返回后，`useSwapSupportedDexList()` 仅展示同时存在于后端 `dex_list` 和本地 `DEX` 中的 provider

这意味着 Uniswap 是否可见，由以下两个条件共同决定：

- `rabby-swap` 已将该链加入 `DEX_SUPPORT_CHAINS[DEX_ENUM.UNI]`
- 后端 `dex_list` 返回对应 dex

这和现有其他 provider 的显示策略一致，也是最接近桌面端 PR 的做法。

### 3. Quote 与安全校验

重点修正 `apps/mobile/src/screens/Swap/hooks/quote.tsx` 中对 Uniswap 的识别：

- 所有基于 dex 枚举的分支统一使用 `DEX_ENUM.UNI`
- 移除或替换仍依赖 `DEX_ENUM['UNISWAP']` 的特殊判断

预期结果：

- Uniswap quote 返回后，`decodeCalldata` 能按当前 SDK 的 dex 枚举被正确处理
- `verifyCalldata` 不会因为旧枚举判断失效而误报
- `verifySdk` 继续沿用当前 router/spender 校验逻辑，不新增 ad-hoc 分支

### 4. 交易提交

交易提交链路不做结构性修改，只要求前置校验结果正确：

- quote 列表可以展示 Uniswap 项
- 用户选择 Uniswap 后，active provider 能沿现有状态管理继续流转
- `buildDexSwap` / `dexSwap` 使用的 dex id 与 quote 结果保持一致

本次不新增单独的 Uniswap 交易分支；如果提交链路需要特殊处理，说明 SDK 枚举对齐仍不完整，应继续回到统一枚举层解决。

## 涉及文件

- `apps/mobile/package.json`
- `apps/mobile/src/constant/swap.ts`
- `apps/mobile/src/screens/Swap/hooks/quote.tsx`
- `yarn.lock`
- 如测试需要，补充到对应 Swap hook 测试文件；若仓库当前没有合适测试文件，则新增最小测试文件

## 测试策略

遵循最小 TDD：

1. 先补一个能暴露旧枚举问题的测试
2. 确认测试在修改前失败，失败原因是 Uniswap 仍走旧枚举判断
3. 实现最小修复
4. 重新运行该测试并通过
5. 运行最小范围的额外验证，至少包含：
   - 相关 jest 测试
   - `apps/mobile` 的 `typecheck`

测试重点：

- Uniswap quote 在 `verifyCalldata` 中不会因为旧枚举判断而失败
- DEX 列表包含 `DEX_ENUM.UNI` 时，Uniswap 会出现在可展示 provider 集合中

## 风险与边界

- 如果后端 `dex_list` 还未返回 Uniswap，本地即使接入完成，UI 仍不会展示，这是符合当前产品策略的预期行为
- 如果 `rabby-swap@0.0.75-beta.0` 的返回值或 decode 规则和移动端假设不一致，问题应落在 SDK 对齐，而不是在移动端再补一层别名兼容
- 当前仓库已有与该需求相关的未提交改动，实施时必须只修改本次接入需要的文件，不能覆盖用户现有改动

## 实施完成判定

满足以下条件即可判定完成：

- 移动端 provider 元数据中正式包含 Uniswap
- Uniswap 在后端允许时可以出现在 Swap provider 列表
- 选择 Uniswap 后 quote 校验可通过，不会被旧枚举判断误杀
- 最小相关测试与类型检查通过
