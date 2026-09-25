import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {initInteractive,interactiveValue,switchInteractive,resetInteractive} from '../src/interactive-ui.js';
import {importCSV,validateInteractive} from '../src/core.js';
import {showImportPreview,previewPage} from '../src/import-ui.js';
function setup(){
 const {document,Event}=parseHTML(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));globalThis.document=document;
 const form=document.querySelector('#campaignForm');form.elements=Object.fromEntries([...form.querySelectorAll('[name]')].map(x=>[x.name,x]));
 const field=(name,value)=>{const el=document.querySelector(`[data-field="${name}"]`);if(el.localName==='select'){for(const o of el.options)o.selected=o.value===value;}else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
 resetInteractive();return {document,Event,field};
}
test('formulário configura CTA URL e ligação, quick reply, lista e preserva rascunhos',()=>{
 const {document,field}=setup();initInteractive('cta');
 assert.equal(document.querySelector('#interactiveFields').hidden,false);
 field('text','Visitar');field('value','https://example.com');
 assert.deepEqual(interactiveValue('cta').buttons,[{text:'Visitar',url:'https://example.com'}]);
 field('kind','phone');field('value','5511999999999');
 assert.equal(interactiveValue('cta').buttons[0].phoneNumber,'5511999999999');
 switchInteractive('quick_reply');field('text','Sim');field('id','aceito');
 assert.deepEqual(interactiveValue('quick_reply').buttons,[{text:'Sim',id:'aceito'}]);
 switchInteractive('list');field('section','Produtos');field('title','Item A');field('rowId','a');field('description','Descrição');
 const list=interactiveValue('list');validateInteractive({mode:'list',interactive:list});
 assert.equal(list.sections[0].rows[0].title,'Item A');
 assert.match(document.querySelector('#contentPreview').textContent,/Item A/);
 switchInteractive('cta');assert.equal(interactiveValue('cta').buttons[0].text,'Visitar');
 initInteractive('list',list);assert.deepEqual(interactiveValue('list'),list);
 document.querySelector('[data-remove]').click();assert.equal(interactiveValue('list').sections.length,0);
 document.querySelector('#addInteractive').click();assert.equal(interactiveValue('list').sections[0].rows.length,1);
});
test('prévia mantém duplicados e original; fila deduplicada; busca e paginação',()=>{
 const data=importCSV('Nome;Numero\nAna;+55 (11) 99999-9999\nAna repetida;5511999999999\nInválido;abc','contacts');
 assert.equal(data.items.length,2);assert.equal(data.preview.length,3);
 assert.equal(data.preview[0].target,'5511999999999');assert.equal(data.preview[1].importStatus,'duplicate');
 assert.equal(previewPage(data.preview,{status:'duplicate'}).total,1);
 assert.equal(previewPage(data.preview,{query:'invalido'}).total,1);
 assert.equal(previewPage(data.preview,{size:1,page:20}).page,2);
 const {document,Event}=setup();showImportPreview(data);
 const search=document.querySelector('#importSearch');search.value='repetida';search.dispatchEvent(new Event('input'));
 assert.equal(document.querySelectorAll('.import-table tbody tr').length,1);
 assert.match(document.querySelector('#importRows').textContent,/Duplicado/);
 showImportPreview(null);assert.equal(document.querySelector('#importPreview').hidden,true);
});
test('preview HTML nunca interpreta conteúdo do CSV',()=>{
 const {document}=setup();showImportPreview(importCSV('Nome;Numero\n<img src=x onerror=alert(1)>;5511999999999','contacts'));
 assert.equal(document.querySelector('#importPreview img'),null);
});
