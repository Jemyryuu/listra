const { execSync } = require('child_process');
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

// Create silent VBS launcher
const vbsContent = [
  'Set shell = CreateObject("WScript.Shell")',
  'args = ""',
  'If WScript.Arguments.Count > 0 Then',
  '  args = """" & WScript.Arguments(0) & """"',
  'End If',
  `target = "${daemonScriptPath}"`,
  'cmd = "cmd.exe /c node """ & target & """ " & args',
  'shell.Run cmd, 0, False',
].join('\r\n');
fs.writeFileSync(vbsPath, vbsContent);

// Create command line shortcut wrapper for terminal execution
const cmdContent = `@echo off\r\nnode "${daemonScriptPath}" %*\r\n`;
fs.writeFileSync(cmdPath, cmdContent);

// Protocol command launches silently via wscript
const command = `wscript.exe "${vbsPath}" "%1"`;

console.log('Registering listra:// URL protocol in HKCU registry...');

const regCommands = [
  'reg add "HKCU\\Software\\Classes\\listra" /ve /d "URL:Listra Protocol (Spicetify Extension)" /f',
  'reg add "HKCU\\Software\\Classes\\listra" /v "URL Protocol" /d "" /f',
  `reg add "HKCU\\Software\\Classes\\listra\\shell\\open\\command" /ve /d "${command.replace(/"/g, '\\"')}" /f`,
  'reg add "HKCU\\Software\\Classes\\listentogether" /ve /d "URL:Listra Protocol (Spicetify Extension)" /f',
  'reg add "HKCU\\Software\\Classes\\listentogether" /v "URL Protocol" /d "" /f',
  `reg add "HKCU\\Software\\Classes\\listentogether\\shell\\open\\command" /ve /d "${command.replace(/"/g, '\\"')}" /f`,
];

try {
  for (const cmd of regCommands) {
    execSync(cmd, { stdio: 'inherit' });
  }
  console.log('Successfully registered listra:// protocol in Windows registry!');
  console.log(`Silent launcher written to: ${vbsPath}`);
  console.log(`CLI launcher written to: ${cmdPath}`);
} catch (err) {
  console.error('Failed to register protocol handler:', err.message);
}
