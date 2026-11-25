import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash,randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { brandIcons } from './brand.mjs';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {build,Platform,Arch}=createRequire(import.meta.url)('electron-builder');
const spec=JSON.parse(fs.readFileSync(path.join(desktop,'package.json')));
const ver=spec.version; const platform=process.argv[2];const mac=platform==='mac';
if(!mac&&platform!=='win')throw Error('Seleccione mac o win.');
if(mac&&process.platform!=='darwin')throw Error('La creación del .pkg universal requiere macOS.');
const pl=path.join(desktop,'build/pld');
const out=path.join(desktop,'release',platform);
const sbomServer=path.join(pl,'sbom-server-web.cdx.json');
for(const file of [sbomServer,path.join(desktop,'setup/index.html'),path.join(desktop,'main.cjs'),path.join(pl,'out/login.html')]) {
  if(!fs.existsSync(file))throw Error('Falta recurso de distribución: '+file);
}
fs.mkdirSync(out,{recursive:true});
const techArch=mac?'universal':'x64',target=mac?'mac':'windows';
// Inventory the Electron runtime from its exact release metadata. Keep in sync
// with the lockfile when upgrading; do not guess the embedded Chromium/Node versions.
const runtime=JSON.parse(fs.readFileSync(path.join(desktop,'scripts/electron-runtime.json')));
if(runtime.electron!==spec.devDependencies.electron)throw Error('Inventario de Electron desactualizado.');
const exe=mac?'Davara PLD.app':'Davara PLD.exe';
const electronPl=mac?Platform.MAC:Platform.WINDOWS;
const targets=electronPl.createTarget(['dir'],mac?Arch.universal:Arch.x64);
const icons=await brandIcons(desktop);
const config={
  appId:'mx.com.davara.pld',productName:'Davara PLD',electronVersion:runtime.electron,
  directories:{output:out,buildResources:'installer-assets'},
  asar:true,npmRebuild:false,buildDependenciesFromSource:false,publish:null,
  files:['package.json','main.cjs','preload.cjs','setup/**/*','shared/**/*.cjs','runtime/**/*.cjs','offline/**/*',
    '!**/*.test.*','!**/tests/**/*','!**/*.map','!**/.DS_Store'],
  extraResources:[{from:pl,to:'pld',filter:['**/*','!**/.DS_Store']}],
  mac:{identity:'-',icon:icons.png,category:'public.app-category.business',hardenedRuntime:false,
       mergeASARs:true,minimumSystemVersion:'13.0'},
  win:{signExecutable:false,icon:icons.ico,executableName:'Davara PLD'},
};
if(process.env.PLD_ELECTRON_ZIP_DIR)config.electronDist=path.resolve(process.env.PLD_ELECTRON_ZIP_DIR);
// No certificate is searched from the operator's machine and no release upload is configured.
await build({projectDir:desktop,targets,config,publish:'never'});
// For running early GUI QA against a bundle, without issuing a deliverable.
if(process.argv.includes('--unpacked-only')){console.log('Bundle de prueba listo:',out);process.exit(0);}
function run(cmd,args,opts={}){execFileSync(cmd,args,{stdio:'inherit',...opts});}
const prefix='Davara-PLD-'+ver+'-'+target+'-'+techArch;
let installer;
if(mac){
  const app=path.join(out,'mac-universal',exe);
  const archs=execFileSync('lipo',['-archs',path.join(app,'Contents/MacOS/Davara PLD')],{encoding:'utf8'}).trim().split(/\s+/);
  if(!archs.includes('arm64')||!archs.includes('x86_64'))throw Error('El binario no es universal.');
  // No Developer ID Installer nor notarization. The inner app is ad-hoc
  // signed for Apple Silicon; this does not identify a trusted publisher.
  installer=path.join(out,prefix+'.pkg');
  run('productbuild',['--component',app,'/Applications','--identifier','mx.com.davara.pld.installer','--version',ver,installer]);
}else{
  const unpacked=path.join(out,'win-unpacked');
  if(!fs.existsSync(path.join(unpacked,exe)))throw Error('No se generó el ejecutable esperado.');
  installer=path.join(out,prefix+'.exe');
  let nsis=process.env.MAKENSIS;
  if(!nsis&&process.platform==='win32'){
    nsis=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles].filter(Boolean)
      .map(x=>path.join(x,'NSIS','makensis.exe')).find(x=>fs.existsSync(x));
  }
  const flag=process.platform==='win32'?'/':'-';
  // Produce an explicit uninstall allowlist: never delete arbitrary user files
  // from the chosen install location, even if the uninstaller was moved.
  const lines=[];
  function list(dir,rel=''){
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const name=(rel?rel+'\\':'')+e.name;
      if(/[\r\n"$]/.test(name)||e.isSymbolicLink())throw Error('Nombre inesperado en el paquete.');
      if(e.isDirectory()){list(path.join(dir,e.name),name);lines.push('  RMDir "$INSTDIR\\'+name+'"');}
      else lines.push('  Delete "$INSTDIR\\'+name+'"');
    }
  }
  list(unpacked);
  const listFile=path.join(out,'uninstall-files.nsh');fs.writeFileSync(listFile,'\uFEFF'+lines.join('\r\n'));
  run(nsis||'makensis',[flag+'INPUTCHARSET','UTF8',flag+'V2',flag+'DSOURCE='+unpacked,flag+'DDEST='+installer,
    flag+'DFILELIST='+listFile,flag+'DICONFILE='+icons.ico,flag+'DVERSION='+ver,path.join(desktop,'scripts/installer.nsi')]);
}
const sha=async f=>{const h=createHash('sha256');for await(const c of fs.createReadStream(f))h.update(c);return h.digest('hex')};
const resources=mac?path.join(out,'mac-universal',exe,'Contents','Resources'):path.join(out,'win-unpacked','resources');
const payload=path.join(resources,'pld');
const hdr=JSON.parse(fs.readFileSync(path.join(payload,'release.json')));
const currentRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim();
if(hdr.sourceRevision!==currentRevision || (process.env.GITHUB_ACTIONS && (hdr.sourceRevision!==process.env.GITHUB_SHA || hdr.sourceTreeDirty)))throw Error('El payload no corresponde a la revisión esperada. Ejecute de nuevo prepare:resources desde el checkout correcto.');
async function treeHash(root){
  const hashes=[];
  async function visit(dir,prefix=''){
    for(const e of await fsp.readdir(dir,{withFileTypes:true})){
      const name=prefix+e.name, item=path.join(dir,e.name);
      if(e.isDirectory())await visit(item,name+'/');
      else if(e.isFile())hashes.push([name,await sha(item)]);
      else throw Error('Archivo inesperado en el payload de la aplicación.');
    }
  }
  await visit(root);
  hashes.sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
  const h=createHash('sha256');
  for(const [p,digest] of hashes)h.update(p+'\0'+digest+'\n');
  return {files:hashes.length,sha256:h.digest('hex')};
}
const workerSha256=await sha(path.join(payload,'worker.cjs')),contractsSha256=await sha(path.join(payload,'contracts.cjs'));
if(workerSha256!==hdr.workerSha256||contractsSha256!==hdr.contractsSha256)throw Error('Los servicios distribuidos difieren del build identificado.');
const metadata=path.join(out,'MANIFIESTO-compilacion.json');
fs.writeFileSync(metadata,JSON.stringify({schemaVersion:1,target:target+'/'+techArch,...hdr,appAsarSha256:await sha(path.join(resources,'app.asar')),publicLinksSha256:await sha(path.join(payload,'public-links.json')),frontend:await treeHash(path.join(payload,'out')),migrations:await treeHash(path.join(payload,'migrations')),treeDigestFormat:'SHA-256 de (ruta relativa UTF-8 + NUL + SHA-256 hexadecimal del archivo + LF), ordenado por bytes UTF-8 de la ruta.'},null,2)+'\n');
const sbomName='SBOM-escritorio-'+target+'-'+techArch+'.cdx.json';
const desktopBom={bomFormat:'CycloneDX',specVersion:'1.6',serialNumber:'urn:uuid:'+randomUUID(),version:1,
 metadata:{timestamp:new Date().toISOString(),component:{type:'application',name:'Davara PLD escritorio',version:ver,
 properties:[{name:'davara:target',value:target+'/'+techArch},{name:'davara:sourceRevision',value:hdr.sourceRevision},{name:'davara:scope',value:'Shell de escritorio y runtimes distribuidos. Los paquetes de servidor e interfaz se enumeran por separado. No inventaría el sistema operativo.'}]}},
 components:[{type:'framework',name:'Electron',version:runtime.electron,purl:'pkg:npm/electron@'+runtime.electron},
 {type:'framework',name:'Chromium',version:runtime.chromium},{type:'framework',name:'Node.js',version:runtime.node},
 {type:'framework',name:'V8',version:runtime.v8}],externalReferences:[{type:'release-notes',url:runtime.source}]};
fs.writeFileSync(path.join(out,sbomName),JSON.stringify(desktopBom,null,2)+'\n');
fs.copyFileSync(sbomServer,path.join(out,'SBOM-servidor-web.cdx.json'));
const files=[installer,path.join(out,sbomName),path.join(out,'SBOM-servidor-web.cdx.json'),metadata];
const hashes=await Promise.all(files.map(async f=>({file:path.basename(f),bytes:(await fsp.stat(f)).size,sha256:await sha(f)})));
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),hashes.map(x=>x.sha256+'  '+x.file).join('\n')+'\n');
console.log('Instalador y huellas de los archivos finales:',JSON.stringify(hashes));
