const $=q=>document.querySelector(q),msg=$('#message'),name=$('#name'),download=$('#download');
const nav=$('nav'),canvas=$('canvas'),image=$('#image'),plain=$('#plain');
let pdf,page=1,busy=false,objectUrl=null;
function target(){
  const raw=decodeURIComponent(location.hash.slice(1)),url=new URL(raw,location.origin);
  const privateVersion=/^\/api\/v1\/companies\/[A-Za-z0-9_-]+\/files\/[A-Za-z0-9_-]+$/.test(url.pathname);
  const packaged=!url.pathname.startsWith('/api/')&&/^\/[\w./%()-]+\.(?:pdf|xls[mx]|zip)$/i.test(url.pathname);
  if(!raw.startsWith('/')||raw.startsWith('//')||url.origin!==location.origin||url.username||url.password||url.search||url.hash||!(privateVersion||packaged))
    throw Error('Esta referencia no corresponde a un documento disponible.');
  return url;
}
function fileName(res,url){
  const disposition=res.headers.get('content-disposition')||'',encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i);
  try{if(encoded)return decodeURIComponent(encoded[1]).slice(0,180);}catch{}
  const simple=disposition.match(/filename="([^"]+)"/i);
  try{return (simple?.[1]||decodeURIComponent(url.pathname.split('/').at(-1))||'Documento').slice(0,180);}catch{return 'Documento';}
}
async function bytes(res){
  const limit=32*1024*1024;
  if(Number(res.headers.get('content-length'))>limit){await res.body?.cancel();throw Error('Este archivo supera el límite de vista previa. Puedes descargar el original.');}
  const r=res.body.getReader(),chunks=[];let length=0;
  for(;;){const {done,value}=await r.read();if(done)break;length+=value.length;if(length>limit){await r.cancel();throw Error('Este archivo supera el límite de vista previa. Puedes descargar el original.');}chunks.push(value);}
  const result=new Uint8Array(length);let at=0;for(const b of chunks){result.set(b,at);at+=b.length;}return result;
}
function showError(error){const known=typeof error?.message==='string'&&/^(Este archivo|Esta referencia|El servidor|No tienes|La sesión)/.test(error.message);
  msg.textContent=known?error.message:'No se pudo mostrar este documento. Si el archivo está disponible, descarga el original.';
  canvas.hidden=true;image.hidden=true;plain.hidden=true;nav.hidden=true;
}
async function paint(n){
  if(!pdf||busy||n<1||n>pdf.numPages)return;
  busy=true;$('#previous').disabled=$('#next').disabled=true;msg.textContent='Preparando página…';
  try{
    const entry=await pdf.getPage(n),base=entry.getViewport({scale:1});
    const width=Math.min($('.sheet').clientWidth,1100),scale=Math.min(2,width/base.width,Math.sqrt(6000000/(base.width*base.height)));
    const viewport=entry.getViewport({scale});
    canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
    await entry.render({canvas,canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;
    page=n;canvas.hidden=false;nav.hidden=false;msg.textContent='Vista previa del PDF';
    $('#count').textContent='Página '+n+' de '+pdf.numPages;canvas.setAttribute('aria-label','Página '+n+' de '+pdf.numPages+' del PDF');entry.cleanup();
  }finally{busy=false;$('#previous').disabled=page<=1;$('#next').disabled=page>=pdf.numPages;}
}
async function open(){
  const url=target(),res=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  if(!res.ok){if(res.status===403||res.status===401)throw Error('No tienes acceso vigente a este archivo.');throw Error('El servidor no confirmó el archivo. Revisa la conexión y los permisos.');}
  const type=(res.headers.get('content-type')||'').split(';')[0].toLowerCase(),label=fileName(res,url);
  name.textContent=label;download.href=url.href;download.download=label;download.hidden=false;
  if(type==='application/pdf'){
    const lib=await import('./pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
    const root=location.origin+'/_pld-viewer/';
    pdf=await lib.getDocument({data:await bytes(res),isEvalSupported:false,maxImageSize:16000000,canvasMaxAreaInBytes:24000000,
      cMapUrl:root+'cmaps/',cMapPacked:true,standardFontDataUrl:root+'standard_fonts/',wasmUrl:root+'wasm/'}).promise;
    await paint(1);
  }else if(['image/png','image/jpeg','image/webp'].includes(type)){
    objectUrl=URL.createObjectURL(new Blob([await bytes(res)],{type}));image.src=objectUrl;await image.decode();image.hidden=false;msg.textContent='Vista previa de la imagen';
  }else if(['text/plain','text/csv','application/json','application/xml','text/xml'].includes(type)){
    const text=new TextDecoder().decode(await bytes(res));plain.textContent=text.slice(0,100000);plain.hidden=false;msg.textContent=text.length>100000?'Vista previa abreviada. Descarga el original para consultar todo el archivo.':'Vista previa de texto';
  }else{
    await res.body?.cancel();msg.textContent='Este formato no admite vista previa. Puedes descargar el original para abrirlo con la aplicación correspondiente.';
  }
}
$('#previous').addEventListener('click',()=>paint(page-1).catch(showError));
$('#next').addEventListener('click',()=>paint(page+1).catch(showError));
window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);void pdf?.destroy();},{once:true});
void open().catch(showError);
