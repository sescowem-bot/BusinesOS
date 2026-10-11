// Portable test helper. CI resolves the project devDependency first; local development
// may fall back to the TypeScript package installed with the active Node version.
const path=require('node:path');
try{
 module.exports=require('typescript');
}catch{
 const nodePrefix=path.dirname(path.dirname(process.execPath));
 module.exports=require(path.join(nodePrefix,'lib','node_modules','typescript'));
}
