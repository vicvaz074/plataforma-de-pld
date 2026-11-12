import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
import { captureModuleScope, configurePilotSession, getModuleStorageGeneration, getModuleStorage, loadCompanyStorage, resetCompanyStorage, subscribeSaveState } from "../lib/pilot/module-storage"
import type { PilotSession } from "../lib/pilot/contracts"

const a={id:"render-a",organizationId:"org",name:"A",rfc:"AAA010101AAA",status:"active" as const},b={...a,id:"render-b",name:"B"}
const session:PilotSession={user:{id:"render-user",name:"QA",email:"qa@example.test",platformRole:"superadmin",status:"active",requiresPasswordChange:false,twoFactorEnabled:false},organizations:[],companies:[a,b],memberships:[],grants:[],mfaRequired:false}
const deferred=<T=void>()=>{let resolve!:(value:T|PromiseLike<T>)=>void;const promise=new Promise<T>((done)=>{resolve=done});return{resolve,promise}}
const child="__REAL_PROVIDER_MODULE_CHILD__"

/** Compile the actual provider's render expressions, including its JSX. No DOM
 * replacement or parallel copy of the gate: absent/broken production gating
 * really attempts the guarded module read and reproduces the AbortError. */
function renderProviderContent(values:Record<string,unknown>):unknown {
  const path="components/pilot/pilot-provider.tsx",source=ts.createSourceFile(path,readFileSync(new URL(`../${path}`,import.meta.url),"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const declarations:string[]=[]
  const visit=(node:ts.Node)=>{
    if(ts.isVariableStatement(node)&&node.declarationList.declarations.some((d)=>ts.isIdentifier(d.name)&&["moduleTransition","content"].includes(d.name.text))){declarations.push(node.getText(source));return}
    ts.forEachChild(node,visit)
  }
  visit(source);assert.ok(declarations.some((value)=>value.includes("const content")))
  const javascript=ts.transpileModule(declarations.join("\n"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,jsx:ts.JsxEmit.React}}).outputText
  const dependencies={React:{createElement:(type:unknown,props:unknown,...children:unknown[])=>({type,props,children})},Loader2:"Loader2",AlertCircle:"AlertCircle",Building2:"Building2",Button:"Button",ModuleActionGuard:"ModuleActionGuard",ready:true,isPublic:false,error:"",mode:"cloud",session,credentialsPending:false,blocked:false,needsCompany:false,moduleKey:"expedientes",company:a,generation:0,storageGeneration:0,switching:false,verifiedPathname:"/kyc-expediente",pathname:"/kyc-expediente",children:child,router:{push(){},replace(){}},refresh(){},...values}
  return new Function(...Object.keys(dependencies),`${javascript}\nreturn content`)(...Object.values(dependencies))
}
function mountsModule(tree:unknown):boolean {
  if(tree===child)return true
  return Boolean(tree&&typeof tree==="object"&&Array.isArray((tree as {children?:unknown[]}).children)&&(tree as {children:unknown[]}).children.some(mountsModule))
}

test("actual Provider gates route navigation and every synchronous notification of a deferred snapshot",async()=>{
  const original=globalThis.fetch,started=deferred(),finish=deferred(),reads:string[]=[],phases:Array<number|null>=[]
  let delayB=false,committedGeneration:number|null=null,committedCompany=a
  globalThis.fetch=async(input)=>{
    const path=String(input),id=path.includes(b.id)?b.id:a.id
    if(id===b.id&&delayB){started.resolve();await finish.promise}
    return new Response(JSON.stringify({records:[{collection:"kyc_expedientes_detalle",id:"client",revision:1,payload:{expedienteId:"client",nombre:id}}]}))
  }
  const render=()=>{
    const storageGeneration=getModuleStorageGeneration();phases.push(storageGeneration)
    const tree=renderProviderContent({company:committedCompany,generation:committedGeneration,storageGeneration})
    if(mountsModule(tree))reads.push(JSON.parse(getModuleStorage().getItem("kyc_expedientes_detalle")!)[0].nombre)
    return tree
  }
  let unsubscribe=()=>{}
  try{
    configurePilotSession(session);await loadCompanyStorage(a);committedGeneration=getModuleStorageGeneration()
    assert.equal(mountsModule(render()),true);assert.deepEqual(reads,[a.id],"Normal authorized mounting still reads A")
    assert.equal(mountsModule(renderProviderContent({company:a,generation:committedGeneration,storageGeneration:committedGeneration,pathname:"/ebr",verifiedPathname:"/kyc-expediente"})),false,"A newly navigated route cannot mount before server verification")
    const old=captureModuleScope();unsubscribe=subscribeSaveState(()=>{render()})
    delayB=true
    const loading=loadCompanyStorage(b)
    assert.equal(getModuleStorageGeneration(),null,"Publish transition before the first await / synchronous save notification")
    assert.equal(mountsModule(render()),false)
    assert.throws(()=>old.storage.getItem("kyc_expedientes_detalle"),/empresa o el acceso cambió/)
    await started.promise
    assert.equal(mountsModule(render()),false,"Deferred network snapshot keeps modules unmounted")
    finish.resolve();await loading
    assert.equal(mountsModule(render()),false,"Snapshot completion cannot mount B under the stale A provider generation")
    assert.deepEqual(reads,[a.id],"No module read happens during either half of the transition")
    committedCompany=b;committedGeneration=getModuleStorageGeneration()
    assert.equal(mountsModule(render()),true);assert.deepEqual(reads,[a.id,b.id])
    assert.ok(phases.includes(null));assert.notEqual(committedGeneration,old.generation)
    assert.throws(()=>old.storage.setItem("pld-training-module","{}"),/empresa o el acceso cambió/,"Unmount gating never relaxes stale write guards")
    assert.equal(mountsModule(renderProviderContent({mode:"demo",company:null,generation:null,storageGeneration:null,pathname:"/ebr",verifiedPathname:null})),true,"Demo mounting does not require a cloud snapshot")
  }finally{unsubscribe();globalThis.fetch=original;resetCompanyStorage()}
})
