# PBKDF2 新旧钱包共存

本地 keyring 使用 PBKDF2-SHA256、256-bit 密钥和 AES-256-CBC。5,000 次与
600,000 次迭代长期共存，不在旧钱包解锁时自动迁移。

## 写入策略

`RNEncryptor` 的普通 `encrypt` 仍默认使用 5,000 次，因此预生成助记词、云备份、
keychain 包装数据及其他 `appEncryptorApi` 调用不因本功能改变。显式传入
`keyDerivationOptions` 的调用仍可使用 600,000 次。

keyring 的密码校验密文 `booted` 和 vault 通过 `encryptKeyringState` 写入：

- 当当前 Store 中既没有 vault 也没有 `booted` 时，视为新的本地钱包，使用
  600,000 次。全新创建和向空 App 导入助记词都属于这种情况。
- 已存在任一密文时，vault 与 `booted` 分别继承自身参数；仅在其中一种缺失时，
  才使用另一种的参数。混合参数的历史状态不会在改密时被统一升级或降级。
- 旧钱包添加账户、普通保存、重置或修改密码、重启后再次保存都继续使用
  5,000 次；新钱包经过相同操作继续使用 600,000 次。
- 只有旧 `booted` 的空钱包也属于旧钱包，不会在补建 vault 时升级为 600,000 次。
- 用户明确清除钱包数据后，如果两种密文都已不存在，之后创建的是新的本地钱包。

生产启动仍向 `KeyringService` 传入默认 `RNEncryptor`。其升级检查目标是
5,000 次，所以旧 vault 不会在 `submitPassword` 中自动升级。代码中保留的
verified upgrade 能力只在调用方显式配置更高目标并提供持久化边界时生效。

## 密文与读取兼容

600,000 次密文在原来的 `cipher`、`iv`、`salt` 之外增加：

```json
{
  "keyMetadata": {
    "algorithm": "PBKDF2",
    "params": { "iterations": 600000 }
  }
}
```

- 5,000 次写入保留原格式；缺少 `keyMetadata` 的旧密文始终按 5,000 次读取。
- `decrypt` 和 `decryptWithDetail` 读取密文自身参数，不依赖实例写入策略。
- 参数仅接受 PBKDF2 的 5,000 或 600,000 次。损坏、未知或过大的参数直接报错，
  不回退到另一组参数重试。
- 600,000 次导出密钥也保存 `keyMetadata`；缓存解密同时检查 salt 和派生参数，
  并继续跳过 PBKDF2。旧版不含元数据的导出密钥仍可用于旧密文。
- salt 编码、IV、摘要算法和 AES 模式保持原实现。

不包含本功能的旧 App 无法通过密码读取 600,000 次本地 vault。新旧参数共存解决的是
当前及后续版本中的升级与长期读取兼容，不代表可以把新 vault 直接回滚给旧 App。
云备份使用独立的普通 encryptor 默认策略，不会仅因本地新钱包使用 600,000 次而改写。

## 验证与性能边界

`encryptor.test.ts` 是单模块 unit 测试，在原生 AES 边界使用 Node crypto，覆盖固定
向量、新旧格式读取、新 keyring 的 600,000 次选择及既有密文参数继承。
`keyringVaultUpgrade.integration.test.ts` 组合真实 KeyringService、RNEncryptor、
ObservableStore 与持久化协调器，覆盖新钱包创建、添加账户、改密、重启，以及旧钱包和
旧空钱包保持 5,000 次。原生 AES 和 MMKV 在 Node 中被边界替身替代，这些测试不证明
原生持久化、App 回滚或设备耗时。

旧钱包的原生调用数量与迭代次数不变。新钱包只在实际派生时增加原生 PBKDF2 工作量，
没有额外的旧钱包升级任务或后台迁移；600,000 次仍为 5,000 次的 120 倍迭代工作量。
正式发布前仍需在 iOS/Android 验证新钱包创建、密码与生物解锁、改密和云备份恢复，
并测量实际解锁耗时。
