import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

// One vector master for both platforms. The onboarding logo stays independent.
export async function brandIcons(desktop) {
  const root=path.dirname(desktop),r=createRequire(path.join(root,'package.json'));
  const sharp=r(r.resolve('sharp',{paths:[r.resolve('next/package.json')]}));
  const out=path.join(desktop,'build','icons');await fs.mkdir(out,{recursive:true});
  const source=await fs.readFile(path.join(desktop,'branding','pld.svg'),'utf8');
  // A literal reduction would leave PLD just three pixels high at 16px.
  // Enlarge the same outlines about their lower right corner only at small sizes.
  const compact=source.replace('<g id="letters"','<g transform="translate(600 536) scale(1.5) translate(-600 -521)" id="letters"');
  const render=size=>sharp(Buffer.from(size<=32?compact:source)).resize(size,size);
  const png=path.join(out,'davara-pld.png'),ico=path.join(out,'davara-pld.ico');
  await render(1024).png().toFile(png);
  let icns;
  if(process.platform==='darwin'){
    const set=path.join(out,'Davara.iconset');await fs.mkdir(set,{recursive:true});
    for(const points of [16,32,128,256,512])for(const scale of [1,2]){
      await render(points*scale).png().toFile(path.join(set,'icon_'+points+'x'+points+(scale===2?'@2x':'')+'.png'));
    }
    icns=path.join(out,'davara-pld.icns');
    execFileSync('iconutil',['-c','icns','-o',icns,set]);
  }
  // Uncompressed 32-bit DIB entries are understood by both NSIS and Explorer.
  const sizes=[16,24,32,48,64,128,256],entries=[];
  for(const size of sizes){
    const rgba=await render(size).ensureAlpha().raw().toBuffer();
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
  await fs.writeFile(ico,Buffer.concat([header,...entries]));return {png,ico,icns};
}
