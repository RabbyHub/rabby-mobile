const fs = require('fs');
const path = require('path');

const TSCONFIG_FILE = 'tsconfig.typecheck.temp.json';

const tsconfigPath = path.resolve(__dirname, TSCONFIG_FILE);

const tpl = JSON.parse(`
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    ${
      true
        ? ''
        : '// disable on typecheck, but enabled by default in tsconfig.json, to avoid unncessary errors from node_modules during development'
    }
    "noUncheckedIndexedAccess": false
  },
  "include": [
    "src/index.d.ts",
    "node_modules/dayjs/plugin/duration.d.ts",
    "node_modules/dayjs/plugin/utc.d.ts",
    "node_modules/dayjs/plugin/isTomorrow.d.ts",
    "node_modules/dayjs/plugin/isToday.d.ts",
    "node_modules/dayjs/plugin/relativeTime.d.ts",
    "node_modules/dayjs/plugin/updateLocale.d.ts"
  ]
}
`);

module.exports = {
  '*.{,js,jsx}': 'eslint --fix --quiet',
  '*.{,ts,tsx}': [
    'eslint --fix --quiet',
    !process.env.DISABLE_APP_TYPE_CHECK &&
      (stagedFiles => {
        tpl.include = tpl.include.concat(stagedFiles);

        console.log(`Writing ${TSCONFIG_FILE}...`);

        // Ensure the directory exists
        if (!fs.existsSync(path.dirname(tsconfigPath)))
          fs.mkdirSync(path.dirname(tsconfigPath), { recursive: true });
        // Write the updated tsconfig to the file
        fs.writeFileSync(tsconfigPath, JSON.stringify(tpl, null, 2));
        console.log(`${TSCONFIG_FILE} written successfully.`);

        console.log('Running type check...');

        // Return the command to run
        return 'tsc --project tsconfig.typecheck.temp.json --noEmit';
      }),
  ].filter(Boolean),
  '*': 'prettier --write --ignore-unknown',
};
