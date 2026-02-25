#!/usr/bin/env node

/**
 * Anti-regression gate for shell/integrations touched paths.
 * Usage: node scripts/check-hardcodes.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SCAN_PATHS = [
  'src/components/layout/AppShell/AppShell.tsx',
  'src/components/layout/AppShell/AppTopbar.tsx',
  'src/components/clientes/ClientImportWizardDialog.tsx',
  'src/components/clientes/ClientSummaryPanel.tsx',
  'src/components/command',
  'src/components/saved-views',
  'src/import',
  'src/components/shared/DataTable.tsx',
  'src/components/ui/Tooltip.tsx',
  'src/lib/dataInvalidation.ts',
  'src/lib/access.ts',
  'src/lib/mojibake.ts',
  'src/pages/clientes/ClientesPage.tsx',
  'src/pages/dashboard/DashboardPage.tsx',
  'src/pages/captacao/CaptacaoPage.tsx',
  'src/pages/prospects/ProspectsPage.tsx',
  'src/pages/agendas/AgendasPage.tsx',
  'src/pages/metas/MetasPage.tsx',
  'src/pages/integrations',
  'src/services/clientImportService.ts',
  'src/services/prospectConversionService.ts',
  'src/services/encodingRepairMigration.ts',
  'src/services/privateWealthIntegration.ts',
];

const PATTERNS = [
  { regex: /#[0-9a-fA-F]{3,8}\b/g, desc: '#hex color hardcode' },
  { regex: /\brgb\(/g, desc: 'rgb(...) hardcode' },
  { regex: /\brgba\(/g, desc: 'rgba(...) hardcode' },
  { regex: /\btext-white\b/g, desc: 'text-white (use token instead)' },
  { regex: /\bbg-black\b/g, desc: 'bg-black (use token instead)' },
  { regex: /\bfill-white\b/g, desc: 'fill-white (use token instead)' },
  { regex: /\bstroke-white\b/g, desc: 'stroke-white (use token instead)' },
];

function isSourceFile(filePath) {
  return /\.(tsx?|jsx?|css)$/.test(filePath);
}

function getFilesFromPath(pathValue) {
  const results = [];

  try {
    const stats = statSync(pathValue);

    if (stats.isDirectory()) {
      const entries = readdirSync(pathValue);
      for (const entry of entries) {
        results.push(...getFilesFromPath(join(pathValue, entry)));
      }
      return results;
    }

    if (stats.isFile() && isSourceFile(pathValue)) {
      return [pathValue];
    }
  } catch {
    return [];
  }

  return results;
}

const root = process.cwd();
let violations = 0;

for (const scanPath of SCAN_PATHS) {
  const fullPath = join(root, scanPath);
  const files = getFilesFromPath(fullPath);

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const { regex, desc } of PATTERNS) {
        regex.lastIndex = 0;
        if (regex.test(lines[i])) {
          const rel = relative(root, file);
          console.error(`X ${rel}:${i + 1} -> ${desc}`);
          violations++;
        }
      }
    }
  }
}

if (violations > 0) {
  console.error(`\nBlocked: ${violations} hardcode violation(s) found in shell/integrations scope.`);
  process.exit(1);
} else {
  console.log('OK: no hardcoded color violations in shell/integrations scope.');
}
