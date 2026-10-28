const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const localAppData = process.env.LOCALAPPDATA;
const listraDir = path.join(localAppData, 'listra');
if (!fs.existsSync(listraDir)) {
  fs.mkdirSync(listraDir, { recursive: true });
}

const daemonBundleSource = path.resolve(__dirname, '..', 'dist', 'daemon.js');
const daemonScriptPath = path.join(listraDir, 'daemon.js');
if (fs.existsSync(daemonBundleSource)) {
  fs.copyFileSync(daemonBundleSource, daemonScriptPath);
}

const vbsPath = path.join(listraDir, 'launch.vbs');
const cmdPath = path.join(listraDir, 'listra.cmd');
const nodeExePath = process.execPath;

// Create silent VBS launcher that runs node directly and keeps process alive
const vbsContent = [
  'Set shell = CreateObject("WScript.Shell")',
  'args = ""',
  'If WScript.Arguments.Count > 0 Then',
  '  args = """" & WScript.Arguments(0) & """"',
  'End If',
  `nodeExe = "${nodeExePath}"`,
  `target = "${daemonScriptPath}"`,
  'cmd = """" & nodeExe & """ """ & target & """ " & args',
  'shell.Run cmd, 0, True',
].join('\r\n');
fs.writeFileSync(vbsPath, vbsContent);

// Create command line shortcut wrapper for terminal execution
const cmdContent = `@echo off\r\n"${nodeExePath}" "${daemonScriptPath}" %*\r\n`;
fs.writeFileSync(cmdPath, cmdContent);

console.log('Registering listra:// URL protocol and startup service in Windows registry...');

const regPath = path.join(listraDir, 'register.reg');
const escapedVbs = vbsPath.replace(/\\/g, '\\\\');
const regContent = [
  'Windows Registry Editor Version 5.00',
  '',
  '[HKEY_CURRENT_USER\\Software\\Classes\\listra]',
  '@="URL:Listra Protocol"',
  '"URL Protocol"=""',
  '',
  '[HKEY_CURRENT_USER\\Software\\Classes\\listra\\shell\\open\\command]',
  `@="\\"C:\\\\Windows\\\\System32\\\\wscript.exe\\" \\"${escapedVbs}\\" \\"%1\\""`,
  '',
  '[HKEY_CURRENT_USER\\Software\\Classes\\listentogether]',
  '@="URL:Listra Protocol"',
  '"URL Protocol"=""',
  '',
  '[HKEY_CURRENT_USER\\Software\\Classes\\listentogether\\shell\\open\\command]',
  `@="\\"C:\\\\Windows\\\\System32\\\\wscript.exe\\" \\"${escapedVbs}\\" \\"%1\\""`,
  '',
  '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]',
  `"ListraDaemon"="\\"C:\\\\Windows\\\\System32\\\\wscript.exe\\" \\"${escapedVbs}\\" \\"listra://start\\""`,
].join('\r\n');

fs.writeFileSync(regPath, regContent);

try {
  execSync(`reg import "${regPath}"`, { stdio: 'inherit' });
  try { fs.unlinkSync(regPath); } catch (e) {}

  console.log('Successfully registered listra:// protocol in Windows registry!');
  console.log(`Silent launcher written to: ${vbsPath}`);
  console.log(`CLI launcher written to: ${cmdPath}`);

  // Launch companion daemon in background now without blocking
  try {
    const p = spawn('wscript.exe', [vbsPath, 'listra://start'], {
      detached: true,
      stdio: 'ignore',
    });
    p.unref();
    console.log('Companion daemon started in background.');
  } catch (e) {}
} catch (err) {
  console.error('Failed to register protocol handler:', err.message);
}
