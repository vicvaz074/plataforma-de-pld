'use strict';
const mail='mailto:alicia@davara.com.mx?subject=Quiero%20adquirir%20Alicia';
const domains=['sat.gob.mx','diputados.gob.mx','dof.gob.mx','inegi.org.mx','hacienda.gob.mx','gob.mx','banxico.org.mx'];
function regulatoryLinks(texts){
  const result=new Set();
  for(const source of texts)for(const match of source.matchAll(/https:\/\/[^\x00-\x20"'`<>\)\\]+/g)){
    try{const u=new URL(match[0]);if(!u.username&&!u.password&&!u.port&&domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))result.add(u.href);}catch{}
  }
  return result;
}
function classify(target,origin,known){
  let u;try{u=new URL(target);}catch{return null;}
  if(u.username||u.password)return null;
  if(u.href===mail||u.protocol==='https:'&&known.has(u.href))return 'external';
  if(u.origin!==origin||!['https:','http:'].includes(u.protocol)||u.search||u.hash)return null;
  return /^\/api\/v1\/companies\/[A-Za-z0-9_-]+\/files\/[A-Za-z0-9_-]+$/.test(u.pathname)||/^\/(?!api\/)[\w./%()-]+\.(?:pdf|xls[mx]|zip)$/i.test(u.pathname)?'document':null;
}
module.exports={regulatoryLinks,classify};
