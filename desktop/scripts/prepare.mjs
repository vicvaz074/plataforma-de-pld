import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import inventory from './inventory.cjs';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(desktop);
const dst = path.join(desktop,'build','pld');
const requireRoot = createRequire(path.join(root,'package.json'));
const {regulatoryLinks}=requireRoot(path.join(desktop,'shared/links.cjs'));
// DOS and Unix platforms: invoke pnpm via its real JS entrypoint if available.
if (!process.argv.includes('--built')) {
  const run = spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['build'], {
    cwd:root, stdio:'inherit', shell:process.platform==='win32',
    env:{...process.env,DAVARA_DESKTOP_BUILD:'1',NEXT_PUBLIC_PLD_MODE:'connected',NEXT_TELEMETRY_DISABLED:'1'}
  });
  if (run.status!==0) throw new Error('No se completó la exportación de Next.');
}
const webPkgs=JSON.parse(fs.readFileSync(path.join(desktop,'build/web-components.json')));
if (!webPkgs.length) throw new Error('Falta inventario del frontend; vuelva a ejecutar prepare:resources.');
fs.mkdirSync(dst,{recursive:true});
// Only literal public links shipped in tracked PLD catalogs may open outside
// the application. Never construct an external destination from form values.
const sources=execFileSync('git',['ls-files','-z','--','lib/pld','lib/data'],{cwd:root,encoding:'utf8'}).split('\0').filter(f=>/\.(json|ts)$/.test(f));
const links=regulatoryLinks(sources.map(f=>fs.readFileSync(path.join(root,f),'utf8')));
fs.writeFileSync(path.join(dst,'public-links.json'),JSON.stringify([...links].sort()));
// An allowlist prevents accidental publication of .env, private work products,
// Wrangler bindings, old release artifacts and personal files from public/.
const tracked=new Set(execFileSync('git',['ls-files','-z','--','public'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).map(x=>x.slice(7)));
tracked.add('pdf.worker.min.mjs'); // generated from pinned pdfjs-dist
const routeNames=new Set(['index','404']);
const pages=execFileSync('git',['ls-files','-z','--','app'],{cwd:root,encoding:'utf8'}).split('\0');
for (const f of pages) if (/^app\/(?:[\w-]+\/)*page\.tsx$/.test(f)) routeNames.add(f.slice(4,-9)||'index');
const allowed=(name)=>tracked.has(name)||name.startsWith('_next/')||/\.(html|txt)$/.test(name)&&routeNames.has(name.slice(0,name.lastIndexOf('.')));
const source=path.join(root,'out');
const stage=fs.mkdtempSync(path.join(desktop,'build','export-'));
function copyTree(dir,prefix='') {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const rel=prefix+e.name, from=path.join(dir,e.name);
    if(e.isSymbolicLink()) throw Error('Enlace no permitido en la exportación: '+rel);
    if(e.isDirectory()) {copyTree(from,rel+'/');continue;}
    if(!e.isFile()||!allowed(rel)||e.name.startsWith('.')||e.name.endsWith('.map'))continue;
    const dest=path.join(stage,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(from,dest);
  }
}
copyTree(source);
for (const base of ['index.html','login.html','actividades-vulnerables.html','registro-sat.html','pdf.worker.min.mjs']) if(!fs.existsSync(path.join(stage,base))) throw Error('La exportación no contiene '+base);
// Only replace our specific generated staging target.
if(fs.existsSync(path.join(dst,'out'))) fs.rmSync(path.join(dst,'out'),{recursive:true});
fs.renameSync(stage,path.join(dst,'out'));
const sqlout=path.join(dst,'migrations');fs.mkdirSync(sqlout,{recursive:true});
const schema=execFileSync('git',['ls-files','-z','--','migrations/*.sql'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for (const file of schema) fs.copyFileSync(path.join(root,file),path.join(sqlout,path.basename(file)));
for(const e of fs.readdirSync(sqlout)) if(!schema.includes('migrations/'+e))throw Error('Migración desconocida en staging.');
const service=await build({absWorkingDir:root,entryPoints:{worker:'workers/index.ts',contracts:'lib/pilot/contracts.ts'},bundle:true,platform:'node',target:'node24',format:'cjs',outExtension:{'.js':'.cjs'},outdir:dst,metafile:true,legalComments:'eof',logLevel:'warning'});
const components=new Map();
function add(p) {
  if(!p)return;
  const ref='pkg:npm/'+p.name.replace(/^@/,'%40')+'@'+encodeURIComponent(p.version);
  components.set(ref,{type:'library','bom-ref':ref,name:p.name,version:p.version,purl:ref});
}
for(const p of webPkgs)add(p);
for(const f of Object.keys(service.metafile.inputs))add(inventory.packageFor(path.resolve(root,f)));
add(requireRoot('pdfjs-dist/package.json'));
const ver=JSON.parse(fs.readFileSync(path.join(desktop,'package.json'))).version;
const rev=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=Boolean(execFileSync('git',['status','--porcelain','--','app','components','contexts','hooks','lib','migrations','public','scripts','styles','workers','desktop','next.config.js','package.json','pnpm-lock.yaml'],{cwd:root,encoding:'utf8'}).trim());
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(dst,'sbom-server-web.cdx.json'),JSON.stringify({
 bomFormat:'CycloneDX',specVersion:'1.6',version:1,serialNumber:'urn:uuid:'+randomUUID(),
 metadata:{timestamp:new Date().toISOString(),component:{type:'application',name:'Davara PLD servidor e interfaz',version:ver,properties:[{name:'davara:sourceRevision',value:rev},{name:'davara:scope',value:'Paquetes identificables en chunks del cliente, bundle del servidor y worker PDF; no inventaría servicios de infraestructura ni componentes privativos del sistema operativo.'}]}},
 components:[...components.values()].sort((a,b)=>a.purl.localeCompare(b.purl))
},null,2)+'\n');
fs.writeFileSync(path.join(dst,'release.json'),JSON.stringify({version:ver,sourceRevision:rev,sourceTreeDirty:dirty,workerSha256:sha(path.join(dst,'worker.cjs')),contractsSha256:sha(path.join(dst,'contracts.cjs')),rootLockSha256:sha(path.join(root,'pnpm-lock.yaml')),desktopLockSha256:sha(path.join(desktop,'pnpm-lock.yaml'))},null,2)+'\n');
console.log('Recursos listos en',dst,components.size,'componentes de servidor/interfaz.');
