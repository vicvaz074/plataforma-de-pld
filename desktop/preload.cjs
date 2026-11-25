'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(name,...args)=>{const result=await ipcRenderer.invoke('pld:'+name,...args);if(!result.ok)throw new Error(result.message);return result.value;};
contextBridge.exposeInMainWorld('pldSetup',Object.freeze({
  state:()=>invoke('state'),
  choose:mode=>invoke('choose',mode),
  test:origin=>invoke('test',origin),
  finish:input=>invoke('finish',input),
  open:()=>invoke('open')
}));
