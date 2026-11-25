const fs = require("node:fs");
const path = require("node:path");

// Resolve the owning package of an actual bundled module, not the build toolchain.
function packageFor(file) {
  if (!file || !file.includes("node_modules")) return;
  let dir = path.dirname(file.split("?")[0]);
  while (dir.includes("node_modules")) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      if (p.name && p.version) return {name:p.name,version:p.version};
    } catch {}
    dir = path.dirname(dir);
  }
}
// Called only in desktop release builds, for modules in emitted web chunks.
class WebInventory {
  apply(compiler) {
    compiler.hooks.done.tap("DavaraWebInventory", ({compilation:c}) => {
      const pkgs = new Map();
      function visit(m) {
        const p = packageFor(m.resource);
        if (p) pkgs.set(p.name + "@" + p.version,p);
        if (m.modules) for (const child of m.modules) visit(child);
      }
      for (const chunk of c.chunks) for (const m of c.chunkGraph.getChunkModulesIterable(chunk)) visit(m);
      const output = path.join(__dirname, "../build/web-components.json");
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify([...pkgs.values()].sort((a,b)=>a.name.localeCompare(b.name))));
    });
  }
}
module.exports = {packageFor,WebInventory};
