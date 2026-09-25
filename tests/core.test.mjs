import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,importCSV,inviteCode,validateConfig,delayMs,csvExport,recover} from '../src/core.js';
test('CSV com BOM, aspas, ponto e vírgula e nova linha no nome',()=>{
 const r=importCSV('\uFEFFNome;Numero;ID;Observacao\r\n"Ana; \"\"B\"\"\nSilva";5511999999999;;\r\nOutra;5511999999999;;\nSem;Número indisponível;123@lid;','contacts');
 assert.equal(r.valid,1);assert.equal(r.duplicates,1);assert.equal(r.invalid,1);assert.equal(r.items[0].name,'Ana; "B"\nSilva');
});
test('links sem cabeçalho preservam primeira linha e rejeitam hosts falsos',()=>{
 const a='https://chat.whatsapp.com/Abcdefghijklmnopqrstuv';
 const r=importCSV(a+'\n'+a+'?mode=test\nhttps://chat.whatsapp.com.evil.test/Abcdefghijklmnopqrstuv','groups');
 assert.equal(r.valid,1);assert.equal(r.duplicates,1);assert.equal(r.invalid,1);assert.equal(inviteCode('http://chat.whatsapp.com/Abcdefghijklmnopqrstuv'),'');
});
test('vírgulas e linhas vazias',()=>assert.deepEqual(parseCSV('a,b\n\n"c,d",e'),[['a','b'],['c,d','e']]));
test('LID nunca é usado como telefone',()=>{const r=importCSV('Nome;Numero;ID\nFulano;;123456789012345@lid','contacts');assert.equal(r.valid,0);});
test('validação e faixa do intervalo',()=>{const c={name:'Teste',type:'contacts',mode:'text',text:'oi',min:30,max:60,daily:1,batch:1};validateConfig(c);assert.throws(()=>validateConfig({...c,min:0}));assert.equal(delayMs(30,60,()=>0),30000);assert.equal(delayMs(30,60,()=>1),60000);});
test('CSV exportado escapa fórmula e aspas',()=>{assert.equal(csvExport([['=HYPERLINK("x")','João']]),'\uFEFF"\'=HYPERLINK(""x"")";"João"');});
test('reinício pausa; operação em voo fica incerta sem voltar à fila',()=>{
 const s={campaigns:[{status:'running',nextAt:10,items:[{status:'sending'},{status:'pending'}]}]};recover(s,true);assert.equal(s.campaigns[0].status,'paused');assert.equal(s.campaigns[0].items[0].status,'uncertain');assert.equal(s.campaigns[0].items[1].status,'pending');
});
test('wake do worker preserva campanha entre alarmes',()=>{const s={campaigns:[{status:'running',items:[{status:'pending'}]}]};recover(s,false);assert.equal(s.campaigns[0].status,'running');});
