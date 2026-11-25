import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';

// Only read a successful, full native packaging run for the expected commit.
// The output path must be new: no replacement, no merging with prior deliveries.
const [run,revision,destInput]=process.argv.slice(2);
if(!/^\d+$/.test(run||'')||!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Uso: node desktop/scripts/deliver.mjs RUN_ID SHA_GIT_COMPLETO [DIRECTORIO_NUEVO]');
const repo='vicvaz074/plataforma-de-pld',project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const destination=path.resolve(destInput||path.join(project,'desktop/release','Entrega-PLD-'+revision.slice(0,12)));
const api=s=>JSON.parse(execFileSync('gh',['api','repos/'+repo+s],{encoding:'utf8',cwd:project}));
const w=api('/actions/runs/'+run);
if(w.head_sha!==revision||w.conclusion!=='success'||w.status!=='completed'||w.head_branch!=='codex/app-electron-onprem'||w.path!=='.github/workflows/desktop-electron.yml')throw Error('El flujo no reúne los requisitos: rama, revisión, archivo, ambos runners y resultado exitoso.');
const remote=api('/actions/runs/'+run+'/artifacts').artifacts;
const configs=[['mac','mac-universal','mac/universal','macOS', 'pkg'],['win','windows-x64','windows/x64','Windows','exe']];
const hash=async(file)=>{const h=createHash('sha256');for await (const c of createReadStream(file))h.update(c);return h.digest('hex')};
const version=JSON.parse(await fs.readFile(path.join(project,'desktop/package.json'),'utf8')).version;
if(await fs.lstat(destination).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}))throw Error('La carpeta de entrega ya existe. Indique una ruta nueva.');
const parent=path.dirname(destination);await fs.mkdir(parent,{recursive:true});
const tmp=await fs.mkdtemp(path.join(parent,'.preparar-PLD-'));
async function download(name,dir){
  await new Promise((resolve,reject)=>{
    const child=spawn('gh',['run','download',run,'--repo',repo,'--name',name,'--dir',dir],{stdio:'inherit'});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('No se pudo descargar '+name)));
  });
}
try{
  const downloads=await Promise.allSettled(configs.map(async([matrix,tag,target,dirName,ext])=>{
    const name='Davara-PLD-'+matrix+'-'+revision,items=remote.filter(a=>a.name===name&&!a.expired);
    if(items.length!==1)throw Error('No se encontró un artefacto vigente único: '+name);
    const dir=path.join(tmp,dirName);await fs.mkdir(dir);await download(name,dir);
    const installer='Davara-PLD-'+version+'-'+tag+'.'+ext;
    const expected=[installer,'SBOM-escritorio-'+tag+'.cdx.json','SBOM-servidor-web.cdx.json','MANIFIESTO-compilacion.json'].sort();
    const list=await fs.readdir(dir,{withFileTypes:true});const names=list.map(i=>i.name).sort();
    if(list.some(e=>!e.isFile())||JSON.stringify(names)!==JSON.stringify([...expected,'SHA256SUMS.txt'].sort()))throw Error('La descarga contiene elementos inesperados.');
    const header=JSON.parse(await fs.readFile(path.join(dir,'MANIFIESTO-compilacion.json'),'utf8'));
    if(header.sourceRevision!==revision||header.sourceTreeDirty!==false||header.target!==target||header.version!==version) throw Error('La procedencia del instalador no concuerda con la revisión nativa.');
    const sums=(await fs.readFile(path.join(dir,'SHA256SUMS.txt'),'utf8')).trimEnd().split(/\r?\n/).map(line=>/^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/.exec(line));
    if(sums.some(x=>!x)||JSON.stringify(sums.map(x=>x[2]).sort())!==JSON.stringify(expected))throw Error('Listado de huellas no válido o incompleto.');
    for(const [,sha,filename] of sums)if(await hash(path.join(dir,filename))!==sha)throw Error('SHA-256 incorrecto: '+filename);
    return {destino:target,instalador:dirName+'/'+installer,sha256:sums.find(x=>x[2]===installer)[1],artifactId:items[0].id,digestArchivoGitHub:items[0].digest};
  }));
  for(const entry of downloads)if(entry.status==='rejected')throw entry.reason;
  await fs.writeFile(path.join(tmp,'ENTREGA.json'),JSON.stringify({version,revision,workflow:w.html_url,instaladores:downloads.map(x=>x.value)},null,2)+'\n');
  await fs.rename(tmp,destination);console.log('Entrega verificada:',destination);
}finally{await fs.rm(tmp,{recursive:true,force:true});}
