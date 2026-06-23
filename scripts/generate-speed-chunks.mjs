/**
 * Generates high-entropy speed-test download chunks at build time.
 * Files are gitignored — see public/speed/*.bin in .gitignore.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const site = JSON.parse(readFileSync(join(root, 'config/site.json'), 'utf8'));

const streams = site.speedTest.downloadStreams;
const maxMB = Math.max(
  ...Object.values(site.speedTest.presets).map((p) => p.chunkSizeMB),
);
const sizeBytes = maxMB * 1024 * 1024;
const outDir = join(root, 'public/speed');
const writeChunkBytes = 1024 * 1024;

function chunkPath(index) {
  return join(outDir, `chunk-${index}.bin`);
}

function needsGeneration() {
  for (let i = 1; i <= streams; i++) {
    const path = chunkPath(i);
    if (!existsSync(path)) return true;
    if (statSync(path).size !== sizeBytes) return true;
  }
  return false;
}

function writeChunk(path) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(path);
    let written = 0;

    stream.on('error', reject);
    stream.on('finish', resolve);

    function pump() {
      while (written < sizeBytes) {
        const n = Math.min(writeChunkBytes, sizeBytes - written);
        const buf = randomBytes(n);
        if (!stream.write(buf)) {
          written += n;
          stream.once('drain', pump);
          return;
        }
        written += n;
      }
      stream.end();
    }

    pump();
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  if (!needsGeneration()) {
    console.log(`speed chunks up to date (${streams} × ${maxMB} MiB)`);
    return;
  }

  console.log(`generating ${streams} speed chunks (${maxMB} MiB each)…`);
  for (let i = 1; i <= streams; i++) {
    const path = chunkPath(i);
    await writeChunk(path);
    console.log(`  wrote ${path}`);
  }
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
