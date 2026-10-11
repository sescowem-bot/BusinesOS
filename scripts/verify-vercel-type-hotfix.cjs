/* Regression for Vercel TS7006 (directory) and TS2352 (CSV export). */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const directory = fs.readFileSync('app/directory/page.tsx','utf8');
const exportRoute = fs.readFileSync('app/api/business/export/route.ts','utf8');
assert.match(directory,/type\s+DirectoryBusiness\s*=/);
assert.match(directory,/isDirectoryBusiness\s*\(/);
assert.match(directory,/const\s+businesses\s*:\s*DirectoryBusiness\[\]/);
assert.match(directory,/businesses\.map\(\(business\)/);
assert.doesNotMatch(directory,/\(data\s*\|\|\s*\[\]\)\.map\(b\s*=>/);
assert.match(exportRoute,/function\s+isExportRecord\s*\(value:unknown\):value is Record<string,unknown>/);
assert.match(exportRoute,/const\s+rows:unknown=data/);
assert.match(exportRoute,/rows\.every\(isExportRecord\)/);
assert.match(exportRoute,/records\.push\(\.\.\.rows\)/);
assert.doesNotMatch(exportRoute,/data as Record<string,unknown>\[\]/);
assert.match(exportRoute,/if\(role!==['"]owner['"]\)/);
console.log('Vercel TS7006 and TS2352 regression checks passed.');
