'use strict';
// Inspect the actual installed binary/main app referenced by Finder/Explorer,
// not a standalone icon in the release directory. CI calls this after extraction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module'),{createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const [target,...input]=process.argv.slice(2),art=path.resolve(__dirname,'../build/icons');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(target==='mac' && input.length===1){
  const bundle=path.dirname(path.dirname(path.resolve(input[0])));
  const plist=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',path.join(bundle,'Info.plist')],{encoding:'utf8'}));
  assert.ok(!plist.CFBundleIconName,'Un catálogo alterno podría ocultar el icono declarado.');
  const name=plist.CFBundleIconFile;assert.ok(typeof name==='string' && path.basename(name)===name);
  const actual=fs.readFileSync(path.join(bundle,'Resources',name.endsWith('.icns')?name:name+'.icns'));
  assert.equal(actual.subarray(0,4).toString(),'icns');
  assert.equal(sha(actual),sha(fs.readFileSync(path.join(art,'davara-pld.icns'))),'El icono real del bundle debe ser el ICNS PLD completo, incluidas las variantes ópticas.');
  console.log('OK: Finder apunta al ICNS PLD; el binario del icono coincide exactamente con el maestro generado.');
}else if(target==='win' && input.length>=1){
  const builder=createRequire(require.resolve('electron-builder/package.json'));
  const library=createRequire(builder.resolve('app-builder-lib/package.json'));
  const pe=library('resedit');
  const hashes=items=>items.map(i=>sha(Buffer.from(i.isRaw()?i.bin:i.generate()))).sort();
  const expected=hashes(pe.Data.IconFile.from(fs.readFileSync(path.join(art,'davara-pld.ico'))).icons.map(x=>x.data));
  assert.equal(expected.length,7);
  for(const exe of input){
    const entries=pe.NtExecutableResource.from(pe.NtExecutable.from(fs.readFileSync(exe))).entries;
    const groups=pe.Resource.IconGroupEntry.fromEntries(entries);
    const [first]=groups;assert.ok(first,'El ejecutable no contiene recursos GRP_ICON.');
    // The order is the native resource-directory order used for icon index 0.
    // Every locale of the primary group must render the same brand.
    for(const group of groups.filter(g=>g.id===first.id))
      assert.deepEqual(hashes(group.getIconItemsFromEntries(entries)),expected,'El recurso primario de Explorer no contiene los 7 tamaños oficiales PLD: '+path.basename(exe));
    console.log('OK: '+path.basename(exe)+' contiene los 7 iconos PLD exactos, no el predeterminado de Electron/NSIS.');
  }
}else throw Error('Uso: icon.cjs mac BINARIO_APP | win EXE_PRINCIPAL [EXE_INSTALADOR]');
