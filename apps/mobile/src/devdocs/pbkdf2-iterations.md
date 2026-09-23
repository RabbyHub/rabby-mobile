# PBKDF2 60,000 次派生支持

`apps/mobile/src/core/services/encryptor.ts` 中的
`ENABLE_PBKDF2_60000` 默认是 `false`。现有 `new RNEncryptor()` 调用继续
使用 PBKDF2-SHA256、5,000 次迭代、256-bit 密钥和 AES-256-CBC。

将该常量改为 `true`，会让所有默认实例的新写入使用 60,000 次，包括本地
keyring vault、密码校验数据、预生成助记词、云备份及共用 encryptor 的
keychain 包装数据。也可以为单个实例显式指定配置：

```ts
const encryptor = new RNEncryptor({
  keyDerivationOptions: {
    algorithm: 'PBKDF2',
    params: { iterations: 60_000 },
  },
});
```

## 格式与兼容

60,000 次密文在原来的 `cipher`、`iv`、`salt` 之外增加：

```json
{
  "keyMetadata": {
    "algorithm": "PBKDF2",
    "params": { "iterations": 60000 }
  }
}
```

- 5,000 次写入保留原格式；缺少 `keyMetadata` 的旧密文始终按 5,000 次读取。
- `decrypt` 和 `decryptWithDetail` 读取密文参数，不依赖当前开关。
  关闭开关的本版本仍可读取 60,000 次数据。
- 参数仅接受 PBKDF2 的 5,000 或 60,000 次。损坏、未知或过大的参数直接
  报错，不回退重试或调用原生派生。
- 60,000 次导出密钥也保存 `keyMetadata`；缓存解密同时检查 salt 和派生
  参数是否匹配，并继续跳过 PBKDF2。旧版不含元数据的导出密钥可用于旧密文。
- salt 编码、IV、摘要算法和 AES 模式保持原实现。这里借鉴的是
  [MetaMask Mobile 的参数随密文保存、按密文读取机制](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/Encryptor.ts)，
  不代表可导入 MetaMask 的 vault。

## 写入与启用范围

启用后，`submitPassword` 成功解锁会检查本地 vault 和密码校验密文 `booted`，
分别升级低于目标次数的数据。已达到目标或更强的数据不会被这次自动迁移降级。
`booted` 与 vault 使用同一密码，必须一起检查，避免留下低成本的当前密码校验数据。

迁移只用于未提供缓存密钥的密码解锁；包含 `trustedVaultKeyString` 的解锁
（包括失效缓存回退密码的情况）跳过迁移，保留生物识别快路径。独立调用
`decrypt`、`verifyPassword` 或 `unlockKeyrings` 不触发迁移，已有云备份也不会更新。

迁移复用当前完整密文的解密结果，保留未知字段和完整 keyring 数据，不从可能
尚未完成延迟恢复的运行时 keyring 列表序列化。准备完成后，校验新密文的密码
解密、缓存密钥解密结果与原数据一致；锁定、改密、更换 Store 或并发 vault/
`booted` 更新都会使旧迁移结果失效。当前账户等其他状态按提交时的最新值保留。

提交通过同步的 `onPersistVaultUpgrade` 边界执行写入与读回验证，成功后才以
同一个对象调用 `store.putState`。普通订阅者跳过这次已完成的写入，避免重复
写入使旧 checkpoint 被覆盖。没有该持久化边界的 KeyringService 实例不自动升级。

加密、校验或持久化失败不会导致已成功的解锁失败，也不会发布新内存状态或
新缓存密钥。持久化仍使用仓库现有的前一代 checkpoint：主文件失败时保留恢复
副本，并阻止本次进程继续写入，等待现有恢复流程。**升级成功后，checkpoint
暂时仍可能含有 5,000 次密文**，不能将本功能描述为已清除所有旧派生数据。

一次解锁只选择最终有效的缓存密钥；跨解锁的缓存写入串行执行，并在开始写入
前检查会话及 vault，避免旧异步写入晚到后覆盖新密钥。缓存写入失败不影响密码解锁。

正常业务重新写入仍采用实例配置。因此将开关改回 `false` 后，后续普通保存
仍会使用 5,000 次；自动升级中的“不降级”判断不改变这一普通写入策略。

不含本次支持的旧 App 无法通过密码解密 60,000 次密文。正式启用前需要结合
App 回滚及云备份跨版本恢复策略确认发布顺序。

## 验证与性能边界

`encryptor.test.ts` 属于单模块 unit 测试，在原生 AES 边界使用 Node crypto，
验证独立固定向量、跨配置读取、旧格式、错误密码、非法参数及缓存密钥兼容性。
`keyringVaultUpgrade.integration.test.ts` 组合真实 KeyringService、RNEncryptor、
ObservableStore 与持久化协调器，验证升级、重启读取、失败与并发语义。
原生 AES 和 MMKV 在 Node 中被边界替身替代，测试不证明原生持久化或设备耗时。

默认配置的原生调用数量、迭代次数和缓存解密路径保持不变；模块加载和
构造函数不执行加密，也不增加订阅或启动任务。60,000 次模式仍调用现有异步
原生 PBKDF2 接口，每次派生的迭代工作量为原来的 12 倍；首次升级还包含旧数据
解密、新密文派生和读回校验。迁移在逻辑解锁后、`submitPassword` 返回前等待
完成，会增加该次调用耗时；不使用脱离解锁会话的后台任务。实际耗时需要设备测量。
正式启用前应验证 iOS/Android 的密码与生物解锁、冷启动、改密和云备份恢复，
并按仓库性能审查流程请求 `@richardo2016x` 评审启用后的解锁耗时。

## 本地检查记录

- 移动端 typecheck、两套循环依赖检查、启动治理检查通过。
- 移动端单测 528 个 suite / 3,895 项通过；其中 encryptor 78 项、持久化协调器 9 项。
- Keyring package 单测 41 项通过（`--coverage=false`）；默认命令设置的全局
  100% coverage 门槛未通过，本次未降低该门槛。
- 升级 JS integration 23 项通过；完整集成的 31 个 suite / 152 项断言通过，
  但 `test:integration:ci` 仍因既有 Hyperliquid `SymbolConversion` 在测试结束后
  输出异步错误而退出 1。先前已在未修改的基线复现该问题。
- CI 因上述错误未继续执行的六个冷启动场景，已分别在独立进程运行并通过。
- Package ESLint 存在 131 条基线问题；按源代码行映射对比，本次未增加新问题。
