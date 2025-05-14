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

      if (
        adrpPageBaseStrNo0x === 'bb2000' &&
        originalLdrOffsetStrNo0x === 'e0'
      ) {
        console.log(
          'match',
          adrpPageBaseStrNo0x,
          originalLdrOffsetStrNo0x,
          matchedIdx,
        );
      }

      if (matchedIdx === -1) {
        return match;
      }

      if (matchedIdx === 0) {
        shouldReplacedLdr = '';

        return match;
      }

      shouldReplacedLdr = firstGotAddrLM_FullStr
        .slice(-LDR_HEX_LENGTH)
        .toLowerCase();

      return `${adrpLineContent}\n${ldrPrefixIncludingHashAnd0x}${shouldReplacedLdr}${ldrSuffix}`;
    },
  );
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

  const result = normalizeOtoolFilePureString(
    otoolSContent,
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
