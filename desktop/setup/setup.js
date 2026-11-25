'use strict';
const by=id=>document.getElementById(id);
const api=window.pldSetup;
let step=0,mode=null,busy=false,details={kind:'new',hasUsers:false};
const controls=['next','finish','open','back','choose-new','choose-existing','test-connection'];
function clearError(){by('error').hidden=true;by('error').textContent='';}
function error(msg){by('error').textContent=msg;by('error').hidden=false;by('error').scrollIntoView({block:'nearest'});}
function wipe(){by('password').value='';by('confirmation').value='';}
function show(){
  const complete=step===3;
  for(const [id,on] of [['roles',step===0],['db-step',step===1&&mode==='server'],['station-step',step===1&&mode==='client'],['account-step',step===2],['complete-step',complete],['back',step>0&&!complete],['next',step===0||step===1&&mode==='server'],['finish',step===2||step===1&&mode==='client'],['open',complete],['account-fields',!details.hasUsers],['account-hint',!details.hasUsers],['existing-note',details.hasUsers]])by(id).hidden=!on;
  const state=complete?['Instalación lista','Ya puedes abrir la plataforma e iniciar sesión.']:step===0?['Configura este equipo','Elige la función de este equipo en la instalación de tu organización.']:step===1?(mode==='server'?['Conecta la base de datos','Crea la base en este servidor o selecciona una instalación PLD existente.']:['Conecta la estación','Utiliza el servidor interno que ya configuró tu organización.']):(details.hasUsers?['Enlaza tu instalación','Esta base ya tiene cuentas. No se creará otro administrador.']:['Crea el administrador principal','Esta será la primera cuenta. Desde ella podrás crear empresas y asignar accesos.']);
  by('title').textContent=state[0];by('intro').textContent=state[1];
  by('progress').textContent=complete?'Configuración completada':step===0?'Configuración inicial':'Paso '+(step+1)+' de '+(mode==='client'?'2':'3');
  by('finish').textContent=mode==='client'?'Conectar estación':details.hasUsers?'Enlazar instalación':'Crear administrador';
  by('db-kind').textContent=details.kind==='invalid'?'Selecciona una ubicación válida.':details.hasUsers?'Base PLD existente. Se conservarán los usuarios y datos.':'Se inicializará una base PLD en la ubicación indicada:';
  by('title').focus();
}
async function action(fn,quiet=false){if(busy)return;busy=true;clearError();for(const id of controls)by(id).disabled=true;
  try{await fn();}catch(e){error(e.message||'No se pudo completar. Vuelve a intentar.');}finally{busy=false;for(const id of controls)by(id).disabled=false;if(!quiet&&step===3)by('open').focus();}}
for(const val of ['server','client'])by(val+'-mode').addEventListener('change',()=>{mode=val;clearError();});
by('back').addEventListener('click',()=>{if(busy)return;wipe();clearError();step--;show();});
by('client-origin').addEventListener('input',()=>{by('test-result').textContent='';});
for(const val of ['new','existing'])by('choose-'+val).addEventListener('click',()=>action(async()=>{const s=await api.choose(val);if(s){details=s.details;by('db-path').textContent=s.databasePath;show();}}));
by('test-connection').addEventListener('click',()=>action(async()=>{by('test-result').textContent='';const o=await api.test(by('client-origin').value);by('client-origin').value=o;by('test-result').textContent='Conexión verificada.';}));
by('wizard').addEventListener('submit',e=>{e.preventDefault();void action(async()=>{
  if(step===0){if(!mode)throw new Error('Elige si este equipo será el servidor o una estación.');step=1;show();return;}
  if(step===1&&mode==='server'){if(details.kind==='invalid')throw new Error('Selecciona una base o ubicación válida.');step=2;show();return;}
  if(step===3){await api.open();return;}
  const form=mode==='client'?{mode,origin:by('client-origin').value}:{mode,port:by('port').value,publicOrigin:by('public-origin').value};
  if(mode==='server'&&!details.hasUsers){
    if(!by('name').value.trim()){by('name').focus();throw new Error('Escribe el nombre de la persona administradora.');}
    if(!by('email').value.trim()||!by('email').validity.valid){by('email').focus();throw new Error('Escribe un correo válido para iniciar sesión.');}
    if(by('password').value.length<11||by('password').value.length>128){by('password').focus();throw new Error('Usa entre 11 y 128 caracteres para la contraseña.');}
    if(by('password').value!==by('confirmation').value){by('confirmation').focus();throw new Error('La confirmación no coincide con la contraseña.');}
    Object.assign(form,{name:by('name').value,email:by('email').value,password:by('password').value,confirmation:by('confirmation').value});
  }
  const result=await api.finish(form);wipe();step=3;by('notice').hidden=true;
  by('success-title').textContent=mode==='client'?'Estación conectada':details.hasUsers?'Instalación enlazada':'Administrador creado';
  by('success-note').textContent=(mode==='client'?'La base oficial permanece en el servidor. Inicia sesión en línea antes de trabajar con borradores sin conexión. ':'Mantén la aplicación abierta para conservar el servicio disponible. ')+'Dirección de acceso: '+result.origin;
  show();
});});
void action(async()=>{const s=await api.state();details=s.details;
  by('port').value=s.port;by('public-origin').value=s.publicOrigin;by('db-path').textContent=s.databasePath;by('client-origin').value=s.origin;
  if(s.mode){mode=s.mode;by(mode+'-mode').checked=true;}
  if(s.notice){by('notice').textContent=s.notice;by('notice').hidden=false;}show();
},true);
