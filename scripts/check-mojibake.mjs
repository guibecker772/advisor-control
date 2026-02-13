import { promises as fs } from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = path.resolve(process.cwd(), 'src');
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDED_FILES = new Set([
  path.resolve(SOURCE_ROOT, 'lib', 'mojibake.ts'),
]);

// Sequences frequently produced by UTF-8 <-> Latin1 mojibake.
// Matches "Ã§", "Ã£", "Â°", etc. while avoiding valid standalone letters like "ÃO".
const MOJIBAKE_PATTERN = /Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|�/g;

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await walkFiles(fullPath);
      files.push(...nestedFiles);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (EXCLUDED_FILES.has(fullPath)) continue;
    files.push(fullPath);
  }

  return files;
}

function getLineFindings(content, filePath) {
  const findings = [];
  const lines = content.split(/\r?\n/u);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    MOJIBAKE_PATTERN.lastIndex = 0;
    let match = MOJIBAKE_PATTERN.exec(line);

    while (match) {
      findings.push({
        filePath,
        line: lineIndex + 1,
        column: match.index + 1,
        snippet: line.trim().slice(0, 180),
      });
      match = MOJIBAKE_PATTERN.exec(line);
    }
  }

  return findings;
}

async function main() {
  const files = await walkFiles(SOURCE_ROOT);
  const findings = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const fileFindings = getLineFindings(content, filePath);
    findings.push(...fileFindings);
  }

  if (findings.length === 0) {
    console.log('No mojibake found.');
    return;
  }

  console.error(`Mojibake detected (${findings.length} occurrence${findings.length > 1 ? 's' : ''}):`);
  for (const finding of findings) {
    const relativePath = path.relative(process.cwd(), finding.filePath);
    console.error(`- ${relativePath}:${finding.line}:${finding.column} -> ${finding.snippet}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Failed to run mojibake checker.');
  console.error(error);
  process.exitCode = 1;
});
