---
name: rabby-address-handling
description: 规范 Rabby 业务数据中的地址比较和地址存储 Key。修改或审查 apps/mobile 与 packages 中非账户管理的资产、历史、备注等业务缓存及 Store、MMKV、SQLite 读写删时使用；排除账户本体、keyring、EIP-55 校验和 checksum 格式约定、SDK 与合约调用参数。
---

# Rabby 地址处理

## 背景与范围

Address 的生成、导入在不同场景下，可能会导致拿到的 Address 大小写不同。因此，各个场景下的地址处理都必须考虑大小写，不能假设调用方、后端或已有数据一定提供小写地址。

本规范仅适用于 `apps/mobile` 和 `packages` 中不负责账户管理的业务数据路径，例如资产缓存、交易历史、地址备注、黑白名单及业务资源索引。

地址来自 `account.address` 时，可以取其小写副本作为这些业务数据的 Key；不能因此修改或写回账户本体。

## 排除场景

以下场景不适用本 skill 的强制比较和小写存储规则，应保留现有身份及格式约定：

- 账户本体及账户管理：`Account`、`KeyringAccount`、`account.address` 的保存和展示，以及账户生成、导入、导出、选择、查找、去重、删除和持久化。账户身份按原有 `isSameAccount` 或地址加 `type`、`brandName` 等维度判断；不能只按地址合并或删除 HD、硬件、观察等不同账户。
- keyring 内部地址、派生路径及账户索引：例如 Keystone 的 `indexes`、OneKey 的 `paths` / `accountDetails` 使用 `toChecksumAddress(address)` 作为 Key。不得改为小写 Key，也不得修改其序列化格式。
- EIP-55 checksum 的生成、校验及依赖 checksum 格式的存储。校验必须保留原始输入，不能先转小写再做 checksum 校验。
- SDK、硬件钱包及合约调用的地址参数：保留接收方要求和已有格式转换，例如 Safe 构造与版本查询、approval、swap、token allowance 中的 `toChecksumAddress`。业务缓存的小写 Key 不能替代传给这些接口的地址值。
- 仅用于展示或保留原始输入的地址值。这些值不是业务查询 Key，不要求覆写为小写。

先判断当前地址承担的是业务索引还是上述排除用途，再应用后续规则；不要仅因字段名是 `address` 就进行批量替换。

## 地址相等判断

在本 skill 适用的业务路径中，地址是否相同必须使用公共工具函数 `isSameAddress`，该函数兼容地址大小写。它不是账户身份判断或地址合法性校验工具。

- 不使用 `===`、`!==` 或自行比较两个 `toLowerCase()` 的结果来判断地址是否相同。
- 查找、筛选、去重、分组和删除数组元素时，同样使用 `isSameAddress`。不要用区分大小写的 `includes(address)` 判断地址是否已存在。
- 复用所在模块已有的公共工具导入方式，不新增另一套地址比较函数，也不为了匹配示例重写已有导入。以下两种用法都合规：

```ts
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

const sameAddress = isSameAddress(addressA, addressB);
```

```ts
import { addressUtils } from '@rabby-wallet/base-utils';

const { isSameAddress } = addressUtils;
const resource = resources.find(item => isSameAddress(item.ownerAddr, address));
const remaining = resources.filter(
  item => !isSameAddress(item.ownerAddr, address),
);
```

`isSameAddress` 任一端为空值时返回 `false`，即使两端都为空也如此；它不 `trim`，也不校验地址是否合法。函数参数类型为 `string`，不要为了传入 `null` / `undefined` 绕过类型约束。可选地址在归一化前先判空，沿用业务现有的输入校验；需要 EIP-55 校验的输入属于上述排除场景。

## 地址作为存储 Key

在本 skill 适用的自有业务存储中，以地址作为 Key 或查询标识时，必须使用 `address.toLowerCase()`，避免大小写不同造成重复记录或存取不一致。该要求仅作用于业务索引，不能覆盖账户本体、keyring 内部表或 checksum 格式约定。

适用范围包括：

- Store、全局变量、模块变量及其他内存缓存。
- `Record`、对象索引、`Map`、`Set` 中的地址 Key。
- MMKV 等磁盘存储中的地址 Key。
- SQLite 中业务资源的地址查询字段、唯一键和主键，包括参与这些标识的 `owner_addr` 等字段；不包括账户或 keyring 的持久化字段。
- 复合 Key 中的地址部分，以及缓存、请求去重或任务调度使用的地址 Key。

必须覆盖完整操作链路：

1. 写入、插入和 upsert：使用小写地址生成 Key；业务查询字段（例如 `owner_addr`）与对应主键的地址段使用一致的小写地址，不改写 `account.address`、展示字段或外部调用参数。
2. 读取、存在性检查：使用相同的小写 Key 或查询条件。
3. 更新：使用小写地址定位已有数据，避免创建另一条大小写不同的记录。
4. 删除、失效和清理：使用相同的小写 Key 或查询条件，不能遗漏其他大小写形式的数据。

在一次操作的入口计算 `normalizedAddress` 并复用。直接用归一化后的 Key 访问存储；`isSameAddress` 用于地址值之间的相等判断。

```ts
// address 为可选字符串时，缺失值不参与缓存操作。
if (!address) {
  return;
}
const normalizedAddress = address.toLowerCase();

cache[normalizedAddress] = value;
const cached = cache[normalizedAddress];
delete cache[normalizedAddress];

addressMap.set(normalizedAddress, value);
const mapped = addressMap.get(normalizedAddress);
addressMap.delete(normalizedAddress);

const storageKey = `balance:${normalizedAddress}`;
const compositeKey = `${normalizedAddress}:${chainId}:${tokenId}`;

const rows = await repo.findBy({ owner_addr: normalizedAddress });
await repo.delete({ owner_addr: normalizedAddress });
```

仅归一化复合 Key 的地址部分；保留原本用于区分链、代币等业务数据的其他维度。已有 Key 包含账户类型或品牌时也必须保留这些维度；账户身份管理本身仍属于排除场景。

## 修改已有存储时

追踪调用入口、Key 生成、实际写入及读、更新、删的路径，不能只修写入或只修读取。

按以下顺序处理本次修复涉及的业务存量数据：

1. 确认旧 Key 是否仍有读写入口，以及数据是可重建缓存还是需要保留的记录；先排除账户、keyring 和 checksum 索引。
2. 统一新读写入口，并保留必要的旧 Key 读取兼容。存在大小写重复记录时，按业务规则选择有效数据，不用旧记录覆盖更新的数据。
3. 需要迁移时，先复制到目标 Key，确认写入成功且读取可用，再删除旧 Key；不能直接删除非小写 Key。
4. 可重建缓存已有全量刷新和清理机制时，优先复用，在刷新成功、有效数据已保留后清理旧记录，避免重复增加清理机制。

不能仅修改新写入，就认定旧数据已符合约束。

## 审查要点

- 同一地址的全小写与混合大小写形式，比较、查找、去重和分组结果一致。
- 使用一种大小写写入后，以另一种大小写读取、更新、删除，仍定位同一份数据。
- 地址参与的复合 Key、SQLite 主键及查询字段使用一致的归一化方式。
- 涉及存量数据时，明确其大小写状态和最终收敛方式。
- 账户本体、账户身份判断、keyring 索引、EIP-55 校验及 SDK / 合约地址参数保持原有约定。

## 源码依据

- [isSameAddress](../../../packages/base-utils/src/isomorphic/address.ts)：公共地址比较实现。
- [isSameAccount](../src/utils/isSameAccount.ts)：账户身份同时比较地址、类型和品牌，属于排除场景。
- [KeystoneKeyring](../../../packages/eth-keyring-keystone/src/KeystoneKeyring.ts)、[OneKey](../../../packages/eth-keyring-onekey/src/eth-onekey-keyring.ts)：checksum 地址索引。
- [Safe](../src/core/apis/safe.ts)、[approval](../src/core/apis/approvals.ts)、[token](../src/core/apis/token.ts)：已有 checksum 地址参数处理。
