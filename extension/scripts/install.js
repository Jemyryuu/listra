const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) {
  console.error("Error: LOCALAPPDATA environment variable not found.");
  process.exit(1);
}

const spicetifyExtensionsDir = path.join(localAppData, 'spicetify', 'Extensions');
const srcBundle = path.join(__dirname, '..', 'dist', 'listra.js');
const destBundle = path.join(spicetifyExtensionsDir, 'listra.js');

if (!fs.existsSync(srcBundle)) {
  console.error(`Error: Bundle not found at ${srcBundle}. Run 'npm run build' first.`);
  process.exit(1);
}

fs.copyFileSync(srcBundle, destBundle);
console.log(`Copied bundle to ${destBundle}`);

// Also copy to active Spotify xpui extensions directory if present
const appData = process.env.APPDATA;
if (appData) {
  const liveXpuiExtension = path.join(appData, 'Spotify', 'Apps', 'xpui', 'extensions', 'listra.js');
  if (fs.existsSync(path.dirname(liveXpuiExtension))) {
    try {
      fs.copyFileSync(srcBundle, liveXpuiExtension);
      console.log(`Updated live Spotify extension at ${liveXpuiExtension}`);
    } catch (e) {}
  }
}

// Delete legacy listen-together.js if present to ensure only Listra runs
const legacyDestBundle = path.join(spicetifyExtensionsDir, 'listen-together.js');
if (fs.existsSync(legacyDestBundle)) {
  fs.unlinkSync(legacyDestBundle);
  console.log(`Removed legacy extension bundle at ${legacyDestBundle}`);
}

try {
  console.log("Configuring Spicetify extension...");
  try {
    execSync('spicetify config extensions listen-together.js-', { stdio: 'inherit' });
  } catch (e) {}
  execSync('spicetify config extensions listra.js', { stdio: 'inherit' });
  console.log("Applying Spicetify changes...");
  execSync('spicetify apply', { stdio: 'inherit' });
  console.log("Spicetify successfully applied!");
} catch (err) {
  console.error("Failed to run spicetify command:", err.message);
}
