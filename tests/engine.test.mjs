import {test} from 'node:test';
import assert from 'node:assert/strict';
const event=()=>({addListener(){}}),store={},session={},alarms=new Map();
let mode='ok',sendCount=0,release;
const area=obj=>({get:async k=>({[k]:structuredClone(obj[k])}),set:async value=>Object.assign(obj,structuredClone(value)),setAccessLevel:async()=>{}});
globalThis.chrome={storage:{local:area(store),session:area(session)},alarms:{create:async(n,v)=>alarms.set(n,v),clear:async n=>alarms.delete(n),onAlarm:event()},sidePanel:{setPanelBehavior:async()=>{}},runtime:{id:'test',getURL:()=> 'chrome-extension://test/',onMessage:event(),onStartup:event()},tabs:{query:async()=>[{id:1}],get:async()=>({id:1,url:'https://web.whatsapp.com/'}),onRemoved:event(),onUpdated:event()},scripting:{executeScript:async args=>{
 if(!args.args)return [{result:true}];const [action]=args.args;
 if(action==='ready')return [{result:{ready:mode!=='offline',busy:false}}];
 if(action==='prepare')return [{result:mode==='approval'?{approval:true,detail:'Pendente'}:{target:'5511999999999@c.us'}}];
 if(action==='send'){sendCount++;if(mode==='deferred')await new Promise(r=>release=r);if(mode==='throw')throw Error('Desconectou após envio');return [{result:{id:'msg-1',ack:1}}];}
 return [{result:{ok:true}}];
}}};
const {handle,tick,boot}=await import('../src/background.js');await boot;
const config={name:'Teste',type:'contacts',mode:'text',text:'oi',invite:'',min:30,max:30,daily:10,batch:10};
async function create(n=2,overrides={}){store.campaignsDB={schema:1,campaigns:[],blocked:[]};mode='ok';sendCount=0;const id=await handle({action:'save',config:{...config,...overrides},items:Array.from({length:n},(_,i)=>({id:String(i),name:'A',target:'551199999999'+i,status:'pending',attempts:0,history:[]}))});await handle({action:'start',id});store.campaignsDB.campaigns[0].nextAt=Date.now()-1;return id;}
test('envia um destino por vez; segundo agendado no intervalo',async()=>{const id=await create();await tick(id);const c=store.campaignsDB.campaigns[0];assert.equal(sendCount,1);assert.equal(c.items[0].status,'sent');assert.equal(c.items[1].status,'pending');assert.ok(c.nextAt>Date.now()+29000);await tick(id);assert.equal(sendCount,1);});
test('limite diário pausa e não envia outro destino',async()=>{const id=await create(2,{daily:1});await tick(id);store.campaignsDB.campaigns[0].nextAt=Date.now()-1;await tick(id);assert.equal(sendCount,1);assert.equal(store.campaignsDB.campaigns[0].status,'paused');});
test('exclusão evita o envio',async()=>{const id=await create(1);store.campaignsDB.blocked=['5511999999990'];await tick(id);assert.equal(sendCount,0);assert.equal(store.campaignsDB.campaigns[0].items[0].status,'skipped');});
test('erro durante envio fica incerto e pausa sem retry',async()=>{const id=await create();mode='throw';await tick(id);assert.equal(store.campaignsDB.campaigns[0].items[0].status,'uncertain');assert.equal(store.campaignsDB.campaigns[0].status,'paused');await tick(id);assert.equal(sendCount,1);});
test('pausar durante envio preserva resultado e impede próximo',async()=>{const id=await create();mode='deferred';const pending=tick(id);while(!release)await new Promise(r=>setTimeout(r,1));await handle({action:'pause',id});release();release=null;await pending;const c=store.campaignsDB.campaigns[0];assert.equal(c.status,'paused');assert.equal(c.items[0].status,'sent');assert.equal(c.nextAt,null);assert.equal(sendCount,1);});
test('aprovação pendente não dispara mensagem',async()=>{const id=await create(1);mode='approval';await tick(id);assert.equal(sendCount,0);assert.equal(store.campaignsDB.campaigns[0].items[0].status,'approval');});
test('aba desconectada pausa antes de tentar',async()=>{const id=await create();mode='offline';await tick(id);assert.equal(sendCount,0);assert.equal(store.campaignsDB.campaigns[0].status,'paused');});
test('suspensão prolongada exige retomada manual',async()=>{const id=await create();store.campaignsDB.campaigns[0].nextAt=Date.now()-130000;await tick(id);assert.equal(sendCount,0);assert.equal(store.campaignsDB.campaigns[0].status,'paused');});
