import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/cta-photo.js',import.meta.url),'utf8');
const image={url:'https://media.test/photo',directPath:'/photo',mediaKey:new Uint8Array([1]),fileEncSha256:new Uint8Array([2]),fileSha256:new Uint8Array([3]),fileLength:100,mimetype:'image/jpeg',jpegThumbnail:new Uint8Array([4])};
const input={target:'123@g.us',text:'Olá',interactive:{image:'data:image/jpeg;base64,/9j/AA==',footer:'Rodapé',buttons:[{text:'Abrir link',url:'https://example.com/A?x=%2F&y=2'}]}};
function setup({failure,ready=true,wrapped=false,legacy=false}={}){
 const calls=[],protos=[],stanzas=[];
 const protoModule={createMsgProtobuf:()=>({imageMessage:image,messageContextInfo:{unwanted:true}})};
 const fanoutModule={createFanoutMsgStanza:async()=>{const stanza={tag:'message',attrs:{},content:[{tag:'enc',attrs:{},content:new Uint8Array([1])}]};return wrapped?{stanza}:stanza;}};
 const map=new Map([[protoModule.createMsgProtobuf,'proto'],[fanoutModule.createFanoutMsgStanza,'fanout']]);
 const W={isFullReady:ready,whatsapp:{functions:{createMsgProtobuf:protoModule.createMsgProtobuf,createFanoutMsgStanza:fanoutModule.createFanoutMsgStanza},_moduleIdMap:map},loader:{loadModule:id=>id==='proto'?protoModule:fanoutModule},chat:{generateMessageID:async()=> 'owned',sendFileMessage:async(target,file,options)=>{
  calls.push(options);
  const proto=protoModule.createMsgProtobuf({id:options.messageId||'ordinary'});protos.push(proto);
  const result=legacy?await fanoutModule.createFanoutMsgStanza({id:'owned'},proto,[]):await fanoutModule.createFanoutMsgStanza({msgProtobuf:proto});stanzas.push(result.stanza||result);
  if(options.messageId&&failure)throw failure;
  return {id:options.messageId||'fallback',ack:1};
 }}};
 const window={WPP:W};vm.runInNewContext(source,{window,URL});
 return {calls,protos,stanzas,window,protoModule,fanoutModule,send:(data=input,active=()=>true)=>window.__campanhasWA.sendPhotoCta(data,{waitForAck:true},active)};
}
test('foto CTA usa imagem completa no topo, version 1 e biz mixed v9; URL exata',async()=>{
 const x=setup();const r=await x.send();assert.equal(r.deliveryFormat,'photo_cta');
 const p=x.protos[0];assert.deepEqual(Object.keys(p),['interactiveMessage']);
 assert.equal(p.interactiveMessage.header.imageMessage,image);
 assert.equal(p.interactiveMessage.header.title,'');assert.equal(p.interactiveMessage.nativeFlowMessage.messageVersion,1);
 const b=p.interactiveMessage.nativeFlowMessage.buttons[0];assert.equal(b.name,'cta_url');
 const params=JSON.parse(b.buttonParamsJson);assert.equal(params.url,input.interactive.buttons[0].url);assert.equal(params.merchant_url,params.url);
 const biz=x.stanzas[0].content.find(n=>n.tag==='biz');assert.equal(biz.content[0].attrs.type,'native_flow');assert.equal(biz.content[0].content[0].attrs.name,'mixed');assert.equal(biz.content[0].content[0].attrs.v,'9');
 assert.equal(x.stanzas[0].content.some(n=>n.tag==='bot'),false);
 const normal=x.protoModule.createMsgProtobuf({id:'another'});assert.ok(normal.imageMessage);assert.equal(normal.interactiveMessage,undefined);
});
test('assinatura legada e retorno stanza encapsulado recebem biz',async()=>{
 const x=setup({legacy:true,wrapped:true});await x.send();assert.ok(x.stanzas[0].content.find(n=>n.tag==='biz'));
});
test('hooks indisponíveis usam foto comum com link, sem reescrever URL',async()=>{
 const x=setup({ready:false}),r=await x.send();assert.equal(r.deliveryFormat,'photo_link');assert.equal(x.calls.length,1);assert.equal(x.calls[0].caption,'Olá\n'+input.interactive.buttons[0].url);assert.ok(x.protos[0].imageMessage);
});
test('rejeição 405 faz fallback uma vez; timeout não repete',async()=>{
 const x=setup({failure:Object.assign(Error('rejected'),{status:405})});assert.equal((await x.send()).deliveryFormat,'photo_link');assert.equal(x.calls.length,2);assert.ok(x.protos[1].imageMessage);assert.equal(x.stanzas[1].content.some(n=>n.tag==='biz'),false);
 const y=setup({failure:Error('timeout')});await assert.rejects(y.send(),/timeout/);assert.equal(y.calls.length,1);
});
test('URL inválida descartada; corpo vazio vira espaço; pausa bloqueia fallback',async()=>{
 const x=setup();await x.send({...input,text:'',interactive:{...input.interactive,buttons:[...input.interactive.buttons,{text:'Ruim',url:'http://invalid.test'}]}});
 assert.equal(x.protos[0].interactiveMessage.body.text,' ');assert.equal(x.protos[0].interactiveMessage.nativeFlowMessage.buttons.length,1);
 const y=setup({ready:false});await assert.rejects(y.send(input,()=>false),/pausada/);assert.equal(y.calls.length,0);
});
