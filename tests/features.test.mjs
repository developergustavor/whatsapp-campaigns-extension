import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig} from '../src/core.js';
import {xlsxBytes} from '../src/export.js';
import {extractPage} from '../src/extractor.js';
import {pageOperation} from '../src/adapter.js';
import {dashboardMarkup} from '../src/dashboard.js';
const config={name:'Teste',type:'contacts',text:'Olá',min:30,max:40,daily:10,batch:1};
test('CTA exige foto JPEG; quick reply exige IDs únicos',()=>{
 validateConfig({...config,mode:'cta',interactive:{image:'data:image/jpeg;base64,/9j/AA==',buttons:[{text:'Visitar',url:'https://example.com'}]}});
 assert.throws(()=>validateConfig({...config,mode:'cta',interactive:{buttons:[{text:'Visitar',url:'https://example.com'}]}}),/JPEG/);
 assert.throws(()=>validateConfig({...config,mode:'quick_reply',interactive:{buttons:[{id:'a',text:'A'},{id:'a',text:'B'}]}}));
});
test('lista aceita seções e rejeita vazia/IDs repetidos',()=>{
 validateConfig({...config,mode:'list',interactive:{buttonText:'Opções',sections:[{title:'A',rows:[{rowId:'1',title:'Primeira'}]}]}});
 assert.throws(()=>validateConfig({...config,mode:'list',interactive:{buttonText:'Opções',sections:[]}}));
});
test('XLSX contém OOXML válido como texto, preserva telefone e não cria fórmula',()=>{
 const bytes=xlsxBytes([['Nome','Numero'],['=1+1','00123456789012345']]);assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
 const str=new TextDecoder().decode(bytes);assert.ok(str.includes('00123456789012345'));assert.ok(str.includes('t="inlineStr"'));assert.ok(!str.includes('<f>'));
});
test('extração preserva LID sem inventar telefone e registra indisponibilidade',async()=>{
 globalThis.window={WPP:{conn:{isMainReady:()=>true,getMyUserId:()=> 'me@c.us'},contact:{get:async()=>({pushname:'Pessoa'}),getPnLidEntry:async()=>({})}}};
 const r=await extractPage('resolve',{account:'me@c.us',rows:[{ID:'123456789012@lid',Numero:'',Nome:''}]});assert.equal(r[0].Numero,'');assert.equal(r[0].Nome,'Pessoa');assert.match(r[0].Observacao,/Número indisponível/);
});
test('extração mapeia PN e reporta falha ao consultar convite',async()=>{
 window.WPP.contact.getPnLidEntry=async()=>({phoneNumber:{user:'5511999999999',server:'c.us'}});
 const r=await extractPage('resolve',{rows:[{ID:'abc@lid',Numero:'',Nome:''}]});assert.equal(r[0].Numero,'5511999999999');
 window.WPP.group={getInviteCode:async()=>{throw Error('Sem permissão');}};
 assert.deepEqual(await extractPage('groupLink',{id:'x@g.us'}),{Link:'',Observacao:'Sem permissão'});
 await assert.rejects(extractPage('contacts',{account:'other@c.us'}),/Conta/);
});
test('CTA, quick reply e lista são encaminhados ao método correto',async()=>{
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});const calls=[];
 globalThis.window={WPP:{conn:{isMainReady:()=>true,getMyUserId:()=> 'me@c.us'},chat:{sendTextMessage:async(...args)=>{calls.push(['text',...args]);return {id:'1',ack:1};},sendListMessage:async(...args)=>{calls.push(['list',...args]);return {id:'2',ack:1};}}}};
 await pageOperation('arm',{id:'c',token:'t'});
 window.__campanhasWA.sendPhotoCta=async(data)=>{calls.push(['photo_cta',data]);return {id:'cta',ack:1};};
 for(const mode of ['cta','quick_reply','list'])await pageOperation('send',{id:'c',token:'t',account:'me@c.us',target:'x@c.us',mode,text:'Teste',interactive:{buttons:[{text:'A',id:'a'}],buttonText:'Abrir',sections:[]}});
 assert.equal(calls[0][0],'photo_cta');assert.equal(calls[0][1].text,'Teste');assert.equal(calls[1][3].useInteractiveMessage,true);assert.equal(calls[1][0],'text');assert.equal(calls[2][0],'list');assert.equal(calls[2][2].description,'Teste');
});
test('dashboard escapa conteúdo e mostra configuração de campanhas antigas',()=>{
 const html=dashboardMarkup({...config,mode:'text',text:'<script>x</script>',items:[],createdAt:Date.now()});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Configuração e andamento'));
});
