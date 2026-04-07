const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node ./.erb/scripts/wait-for-file.js <target-file>');
  process.exit(1);
}

const targetPath = path.resolve(process.cwd(), inputPath);
const timeoutMs = Number(process.env.WAIT_FOR_FILE_TIMEOUT_MS || 30000);
const intervalMs = Number(process.env.WAIT_FOR_FILE_INTERVAL_MS || 150);
const startAt = Date.now();

const wait = () => {
  if (fs.existsSync(targetPath)) {
    process.exit(0);
    return;
  }

  if (Date.now() - startAt >= timeoutMs) {
    console.error(
      `Timed out waiting for file: ${targetPath} (${timeoutMs}ms timeout)`,
    );
    process.exit(1);
    return;
  }

  setTimeout(wait, intervalMs);
};

wait();
