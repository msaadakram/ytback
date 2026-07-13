import fs from 'node:fs';
import { config } from './index.js';

export function ensureDirs() {
  for (const dir of [config.downloadDir, config.tempDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
