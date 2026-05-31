const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

module.exports = async function stampWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const projectDir = context.packager.projectDir;
  const appInfo = context.packager.appInfo;
  const exePath = join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const iconPath = resolve(projectDir, 'resources/grok-command-center-icon.ico');
  const rceditPath = resolve(projectDir, 'node_modules/electron-winstaller/vendor/rcedit.exe');

  for (const requiredPath of [exePath, iconPath, rceditPath]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Cannot stamp Windows app icon; missing ${requiredPath}`);
    }
  }

  execFileSync(
    rceditPath,
    [
      exePath,
      '--set-icon',
      iconPath,
      '--set-version-string',
      'FileDescription',
      appInfo.productName,
      '--set-version-string',
      'ProductName',
      appInfo.productName,
      '--set-version-string',
      'CompanyName',
      appInfo.companyName || appInfo.productName,
      '--set-version-string',
      'InternalName',
      appInfo.productName,
      '--set-version-string',
      'OriginalFilename',
      `${appInfo.productFilename}.exe`,
      '--set-file-version',
      appInfo.version,
      '--set-product-version',
      appInfo.version
    ],
    {
      stdio: 'inherit',
      windowsHide: true
    }
  );
};
