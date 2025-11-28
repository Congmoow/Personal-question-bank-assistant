const { contextBridge } = require('electron');

function getUserDataPathFromArgs() {
  if (!Array.isArray(process.argv)) return '';
  const arg = process.argv.find((item) => typeof item === 'string' && item.startsWith('--userDataPath='));
  if (!arg) return '';
  const encoded = arg.replace('--userDataPath=', '');
  try {
    return decodeURIComponent(encoded);
  } catch (e) {
    return encoded;
  }
}

const userDataPath = getUserDataPathFromArgs();

contextBridge.exposeInMainWorld('appEnv', {
  isElectron: true,
  userDataPath,
});
