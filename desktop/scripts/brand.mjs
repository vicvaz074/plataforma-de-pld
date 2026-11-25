import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';

// Reuse the approved wordmark. Rasterize at build time with Next's locked
// image dependency; no font installation, artwork service or network request.
export async function brandIcons(desktop) {
  const root=path.dirname(desktop),r=createRequire(path.join(root,'package.json'));
  const sharp=r(r.resolve('sharp',{paths:[r.resolve('next/package.json')]}));
  const out=path.join(desktop,'build','icons');await fs.mkdir(out,{recursive:true});
  const logo=await sharp(path.join(root,'public','logo-davara-governance','logo-davara-governance-white.png'))
    .trim().resize(600).png().toBuffer();
  // Letter outlines keep the PLD mark identical on macOS and Windows.
  const tile=Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect x="38" y="38" width="948" height="948" rx="194" fill="#AE440E"/>
    <g fill="#fff" fill-rule="evenodd">
      <path d="M195 482h120c70 0 100 35 100 92s-39 94-104 94h-47v93h-69zm69 58v70h43c23 0 38-11 38-36 0-22-13-34-38-34z"/>
      <path d="M445 482h70v219h109v60H445z"/>
      <path d="M653 482h85c98 0 151 49 151 139 0 89-55 140-151 140h-85zm70 61v158h13c55 0 83-25 83-80 0-53-27-78-83-78z"/>
    </g></svg>`);
  const png=path.join(out,'davara-pld.png'),ico=path.join(out,'davara-pld.ico');
  await sharp(tile).composite([{input:logo,left:212,top:220}]).png().toFile(png);
  // Uncompressed 32-bit DIB entries are understood by both NSIS and Explorer.
  const sizes=[16,24,32,48,64,128,256],entries=[];
  for(const size of sizes){
    const rgba=await sharp(png).resize(size,size).ensureAlpha().raw().toBuffer();
    const maskStride=Math.ceil(size/32)*4,rows=size*size*4;
    const dib=Buffer.alloc(40+rows+maskStride*size);
    dib.writeUInt32LE(40);dib.writeInt32LE(size,4);dib.writeInt32LE(size*2,8);
    dib.writeUInt16LE(1,12);dib.writeUInt16LE(32,14);dib.writeUInt32LE(rows,20);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const src=4*(y*size+x),dst=40+4*((size-1-y)*size+x);
      dib[dst]=rgba[src+2];dib[dst+1]=rgba[src+1];dib[dst+2]=rgba[src];dib[dst+3]=rgba[src+3];
      if(!rgba[src+3])dib[40+rows+(size-1-y)*maskStride+(x>>3)]|=128>>(x%8);
    }
    entries.push(dib);
  }
  const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  sizes.forEach((size,i)=>{const p=6+i*16;header[p]=header[p+1]=size%256;header.writeUInt16LE(1,p+4);
    header.writeUInt16LE(32,p+6);header.writeUInt32LE(entries[i].length,p+8);header.writeUInt32LE(offset,p+12);offset+=entries[i].length;});
  await fs.writeFile(ico,Buffer.concat([header,...entries]));return {png,ico};
}
