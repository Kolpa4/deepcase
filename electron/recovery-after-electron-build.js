const fs = require('fs');
const shell = require('child_process').execSync;

const delimetr = process.platform === 'win32' ? '\\' : '/';
const deepPath = `node_modules${delimetr}@deep-foundation`;
const tsPath = `node_modules${delimetr}typescript`;
const typesPath = `node_modules${delimetr}@types`;
const linuxAppPath = 'dist/linux-unpacked/resources/app';
const windowsAppPath = 'dist\\win-unpacked\\resources\\app';
const macAppPath = 'dist/mac/Deep.Case.app/Contents/Resources/app';

exports.default = async function(context) {
  try {
    if (fs.existsSync(macAppPath)) {
      //electron-builder force removes .d.ts files. It brokes ts-node/register(config) for migrations
      console.log('recovering');
      fs.rmSync(`${macAppPath}/${tsPath}`, { recursive: true });
      shell(`cp -r ${tsPath} ${macAppPath}/${tsPath}`);
      //fix config
      fs.rmSync(`${macAppPath}/${deepPath}/deeplinks/tsconfig.json`, { recursive: true });
      shell(`cp ${deepPath}/deeplinks/tsconfig.json ${macAppPath}/${deepPath}/deeplinks/tsconfig.json`);
    }
    if (fs.existsSync(linuxAppPath)) {
    }
    if (fs.existsSync(windowsAppPath)) {
      console.log('recovering');
      fs.rmSync(`${windowsAppPath}\\node_modules`, { recursive: true });
      shell(`cp -r node_modules ${windowsAppPath}\\node_modules`);
    }
  } catch(err) {
    console.error(err);
  }
}