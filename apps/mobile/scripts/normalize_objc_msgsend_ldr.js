#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LDR_HEX_LENGTH = 3;

function findSpecificObjcMsgSendGotAddressStrings(linkMapContent) {
  const gotAddressStrings = [];
  const lines = linkMapContent.split('\n');
  const gotRegex =
    /^0x([0-9A-Fa-f]+)\s+0x[0-9A-Fa-f]+\s+\[\d+\]\s+_objc_msgSend\.got$/i;
  for (const line of lines) {
    const match = line.match(gotRegex);
    if (match) {
      gotAddressStrings.push(match[1].toLowerCase());
    }
  }
  if (gotAddressStrings.length < 1) {
    console.error(
      'Error: No _objc_msgSend.got address strings found in LinkMap.',
    );
  }
  return gotAddressStrings;
}

/**
 * 二进制文件对齐 _objc_msgSend.got
 * 1. 同一台机器，同样的配置
 * 2. 生成了同样的 LinkMap.txt，
 * 3. 使用的 order_file 也是固定的，里面也包含了 _objc_msgSend
 * 4. 比较过 ios/DerivedData/Build/Intermediates.noindex 其中的 o 文件也是相同的
 * 5. 提取过两次编译日志中的 Ld ... 命令，其内容也是一样的，我使用 diff 工具对其进行比较过
 * 6. 并不是每一次都不一样，实际上只是偶尔不一样
 * 7. 比较过 otool -L，也相同
 * 8. -alias, -alias_list 也不管用
 * 9. [2406] 的地址是： /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/usr/lib/libobjc.A.tbd
 * 10. OTHER_LDFLAGS 中的参数，是一个个加上来的，没有用

 * 不同点：
 * 位于 RabbyMobile.app/RabbyMobile 的二进制文件中，对其进行 otool -tV 来查看对比：/ *
 * ```
 *   000000000053955c	adrp	x8, 1601 ; 0xb7a000
 *   ++++ 0000000000531730	ldr	x8, [x8, #0x3c0] ; literal pool symbol address: _objc_msgSend
 *   ---- 0000000000531730	ldr	x8, [x8, #0x3c8] ; literal pool symbol address: _objc_msgSend
 * ```

 * 在 LinkMap.txt 中，存在相同的符号：
 * ```
 *   0x00B7A3C0	0x00000008	[2406] _objc_msgSend.got
 *   0x00B7A3C8	0x00000008	[2406] _objc_msgSend.got
 * ```
 */
function normalizeOtoolFilePureString(otoolSContent, linkMapGotAddressStrings) {
  if (!linkMapGotAddressStrings || linkMapGotAddressStrings.length < 1) {
    return otoolSContent;
  }

  const firstGotAddrLM_FullStr = linkMapGotAddressStrings[0];
  let shouldReplacedLdr = null;

  const adrpLdrPairRegex =
    /^([0-9a-f]+\tadrp\t(x\d{1,2}),\s*\S+\s*;\s*0x([0-9a-f]+))\n([0-9a-f]+\tldr\t(?:x\d{1,2}),\s*\[\2,\s*#0x)([0-9a-f]+)(\].*)$/gm;

  return otoolSContent.replace(
    adrpLdrPairRegex,
    (
      match,
      adrpLineContent,
      adrpBaseReg,
      adrpPageBaseStrNo0x,
      ldrPrefixIncludingHashAnd0x,
      originalLdrOffsetStrNo0x,
      ldrSuffix,
    ) => {
      if (
        adrpPageBaseStrNo0x.length < LDR_HEX_LENGTH ||
        !adrpPageBaseStrNo0x.endsWith('0'.repeat(LDR_HEX_LENGTH))
      ) {
        return match;
      }

      const adrpHighPartStr = adrpPageBaseStrNo0x.slice(0, -LDR_HEX_LENGTH);

      const currentLdrOffsetFormattedStr = originalLdrOffsetStrNo0x.padStart(
        LDR_HEX_LENGTH,
        '0',
      );

      const otoolTargetCombinedStr =
        `${adrpHighPartStr}${currentLdrOffsetFormattedStr}`.toLowerCase();

      if (shouldReplacedLdr === '') {
        return match;
      }

      const matchedIdx = linkMapGotAddressStrings.findIndex(x =>
        x.endsWith(otoolTargetCombinedStr),
      );

      if (matchedIdx === -1) {
        return match;
      }

      if (matchedIdx === 0) {
        shouldReplacedLdr = '';

        return match;
      }

      shouldReplacedLdr =
        shouldReplacedLdr ||
        firstGotAddrLM_FullStr
          .slice(-LDR_HEX_LENGTH)
          .toLowerCase()
          .replace(/^0+(?!$)/, ''); // 去除 开头的 0，因为观察 otool -tV 得知

      return `${adrpLineContent}\n${ldrPrefixIncludingHashAnd0x}${shouldReplacedLdr}${ldrSuffix}`;
    },
  );
}

// 去除路径信息，实际上应该 binutils 的 strip -S 可以做到的，不想在其他机器上装这个工具
function removeFilePath(otoolSContent) {
  return otoolSContent?.replace(/literal pool for: \"\/Users\/[^\n]+/g, '');
}

async function main() {
  const args = process.argv.slice(2);
  let otoolSFilePath = null;
  let linkMapFilePath = './LinkMap.txt'; // Default LinkMap path

  if (args.includes('-h') || args.includes('--help')) {
    console.log(
      `Usage: ${path.basename(
        process.argv[1],
      )} <otool_S_file_path> [linkmap_file_path]`,
    );
    process.exit(0);
  }

  if (args.length > 0) {
    otoolSFilePath = args[0];
  }
  if (args.length > 1) {
    linkMapFilePath = args[1];
  }

  if (!otoolSFilePath) {
    console.error('Error: Missing required argument <otool_S_file_path>.');
    console.log('Use -h or --help for usage information.');
    process.exit(1);
  }

  let linkMapContent;
  try {
    linkMapContent = fs.readFileSync(linkMapFilePath, 'utf-8');
  } catch (err) {
    console.error(
      `Error: Failed to read LinkMap file "${linkMapFilePath}": ${err.message}`,
    );
    process.exit(1);
  }

  const linkMapGotAddressStrings =
    findSpecificObjcMsgSendGotAddressStrings(linkMapContent);
  if (linkMapGotAddressStrings.length === 0) {
    process.exit(1);
  }

  let otoolSContent;
  try {
    otoolSContent = fs.readFileSync(otoolSFilePath, 'utf-8');
  } catch (err) {
    console.error(
      `Error: Failed to read otool S file "${otoolSFilePath}": ${err.message}`,
    );
    process.exit(1);
  }

  const otoolSContentWithoutFilePath = removeFilePath(otoolSContent);

  const result = normalizeOtoolFilePureString(
    otoolSContentWithoutFilePath,
    linkMapGotAddressStrings,
  );

  console.log(result);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Unhandled error in main:', err);
    process.exit(1);
  });
}
