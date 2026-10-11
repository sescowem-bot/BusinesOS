/* Regression: public business directory RPC results must have an explicit view type. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('app/directory/page.tsx', 'utf8');
assert.match(src, /type\s+DirectoryBusiness\s*=/);
assert.match(src, /const\s+businesses\s*:\s*DirectoryBusiness\[\]/);
assert.match(src, /businesses\.map\s*\(\s*\(business\)/);
assert.match(src, /client\.rpc\('public_directory_list'\)/);
assert.match(src, /Array\.isArray\(rawBusinesses\)/);
assert.match(src, /rawBusinesses\.filter\(isDirectoryBusiness\)/);
console.log('Directory RPC result typing regression passed.');
