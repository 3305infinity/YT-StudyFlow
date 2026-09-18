import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const unitTestFile = path.join(__dirname, 'embedding.service.test.ts');
const cacheMmrTestFile = path.join(__dirname, 'cacheMmrFix.test.ts');
const integrationTestFile = path.join(__dirname, 'runtimeIntegration.test.ts');

console.log('Running Embedding, Cache & MMR Fix Tests...');

run({ files: [unitTestFile, cacheMmrTestFile, integrationTestFile] })
  .compose(new spec())
  .pipe(process.stdout);
