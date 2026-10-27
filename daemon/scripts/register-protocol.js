const { execSync } = require('child_process');
const path = require('path');

const daemonScriptPath = path.resolve(__dirname, '..', 'src', 'index.js');
const command = `\"${process.execPath}\" \"${daemonScriptPath}\" \"%1\"`;

console.log('Registering listentogether:// URL protocol in HKCU registry...');

const regCommands = [
  'reg add "HKCU\\Software\\Classes\\listentogether" /ve /d "URL:Listen Together Protocol" /f',
  'reg add "HKCU\\Software\\Classes\\listentogether" /v "URL Protocol" /d "" /f',
  `reg add "HKCU\\Software\\Classes\\listentogether\\shell\\open\\command" /ve /d "${command.replace(/"/g, '\\"')}" /f`,
];

try {
  for (const cmd of regCommands) {
    execSync(cmd, { stdio: 'inherit' });
  }
  console.log('Successfully registered listentogether:// protocol in Windows registry!');
} catch (err) {
  console.error('Failed to register protocol handler:', err.message);
}
