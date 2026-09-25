import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageOperation} from '../src/adapter.js';
let calls=[];
function setup({approval=false,announce=false,admin=false}={}){
 calls=[];Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 globalThis.window={WPP:{version:'test',conn:{isMainReady:()=>true,getMyUserId:()=> '5511000000000@c.us'},group:{getGroupInfoFromInviteCode:async()=>({id:'123@g.us',subject:'Grupo'}),getAllGroups:async()=>[],join:async()=>{calls.push('join');return {id:'123@g.us',pendingApproval:approval};},ensureGroup:async()=>({groupMetadata:{announce}}),iAmAdmin:async()=>admin},chat:{sendTextMessage:async(...args)=>{calls.push(['text',...args]);return {id:'msg',ack:1};},sendGroupInviteMessage:async(...args)=>{calls.push(['invite',...args]);return {id:'msg',ack:1};}}}};
}
const token={id:'c',token:'t',account:'5511000000000@c.us'};
test('grupo com aprovação pendente não prepara envio',async()=>{setup({approval:true});await pageOperation('arm',token);const result=await pageOperation('prepare',{...token,type:'groups',code:'abc',mode:'text'});assert.equal(result.approval,true);assert.deepEqual(calls,['join']);});
test('grupo somente admins gera erro antes de enviar',async()=>{setup({announce:true});await pageOperation('arm',token);await assert.rejects(pageOperation('prepare',{...token,type:'groups',code:'abc',mode:'text'}),/administradores/);assert.equal(calls.length,1);});
test('convite nativo usa método correto e legenda',async()=>{setup();await pageOperation('arm',token);const prepared=await pageOperation('prepare',{...token,type:'contacts',target:'5511999999999',mode:'invite',inviteCode:'abc'});await pageOperation('send',{...token,...prepared,text:'Olá'});assert.equal(calls[0][0],'invite');assert.equal(calls[0][2].groupId,'123@g.us');assert.equal(calls[0][2].caption,'Olá');assert.equal(calls[0][2].waitForAck,true);});
test('stop invalida token e impede envio',async()=>{setup();await pageOperation('arm',token);await pageOperation('stop',token);await assert.rejects(pageOperation('send',{...token,target:'x',text:'oi'}),/pausada/);assert.equal(calls.length,0);});
test('troca de conta impede envio',async()=>{setup();await pageOperation('arm',token);window.WPP.conn.getMyUserId=()=> 'outro@c.us';await assert.rejects(pageOperation('send',{...token,target:'x',text:'oi'}));assert.equal(calls.length,0);});
