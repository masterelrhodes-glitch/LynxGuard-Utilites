const fs = require("node:fs");
const pathModule = require("node:path");
const Log = require("./Logs");

const files = [];

module.exports = function (absPath, depth = 3) {
  if (!pathModule.isAbsolute(absPath))
    throw new Error(`Path must be absolute - Received ${absPath}`);

  files.length = 0;
  ReadFolder(absPath, depth);
  return files;
};

function ReadFolder(currentPath, depth = 3) {
  const folderEntries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of folderEntries) {
    const fullPath = pathModule.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (depth <= 0) {
        Log.warn(`Maximum depth reached - Skipping ${fullPath}`);
        continue;
      }
      ReadFolder(fullPath, depth - 1);
      continue;
    }

    files.push(fullPath);
  }
}
