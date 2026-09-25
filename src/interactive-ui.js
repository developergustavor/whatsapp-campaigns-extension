let rows=[];
let photo="";
let photoGeneration=0;
let activeMode="text";
let drafts={};
export function resetInteractive(){photo="";photoGeneration++;drafts={};activeMode="text";rows=[];}
export function switchInteractive(mode){drafts[activeMode]=interactiveValue(activeMode);initInteractive(mode,drafts[mode]);}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
export function initInteractive(mode,value={}){
 activeMode=mode;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 $('#modeHelp').textContent=({text:'Mensagem com variáveis de nome e número.',invite:'Informe o link do grupo para gerar um convite nativo.',cta:'Foto + texto + até 3 botões Abrir link (HTTPS).',quick_reply:'Defina texto e ID. Relato de teste: funciona no Web; não renderizou no Android/iOS.',list:'Defina o botão de abertura, as seções e as opções com seus IDs.'})[mode];
 $('#interactiveHeading').textContent=({cta:'Configurar botões CTA',quick_reply:'Configurar respostas rápidas',list:'Configurar lista de opções'})[mode]||'';
 $('#interactiveFields').hidden=!['cta','quick_reply','list'].includes(mode);
 $('#ctaPhotoFields').hidden=mode!=='cta';
 $('#interactiveTitle').disabled=mode==='cta';
 photo=mode==='cta'?(value.image||''):'';photoGeneration++;
 $('#ctaPhoto').value='';refreshPhoto();
 $('#ctaPhoto').onchange=readPhoto;
 $('#interactiveTitle').value=value.title||'';$('#interactiveFooter').value=value.footer||'';$('#listButtonText').value=value.buttonText||'Ver opções';
 $('#listButtonLabel').hidden=mode!=='list';
 rows=mode==='list'?(value.sections||[]).flatMap(s=>s.rows.map(r=>({section:s.title||'Opções',...r}))):(value.buttons||[]).map(b=>({...b,kind:b.phoneNumber?'phone':'url',value:b.url||b.phoneNumber||''}));
 if(!rows.length&&['cta','quick_reply','list'].includes(mode))add(mode);else render(mode);
 updateContentPreview();
}
function add(mode){if(rows.length>=(mode==='list'?10:3))return;const unique=crypto.randomUUID().slice(0,8);rows.push(mode==='list'?{section:'Opções',rowId:unique,title:'',description:''}:{id:unique,text:'',kind:'url',value:''});render(mode);}
function render(mode){
 $('#interactiveRows').innerHTML=rows.map((r,i)=>`<div class="interactive-row" data-row="${i}"><div class="row-head"><strong>${mode==='list'?'Opção':'Botão'} ${i+1}</strong><button type="button" data-remove="${i}" aria-label="Remover item ${i+1}">Remover</button></div>${mode==='list'?`<label>Seção<input data-field="section" value="${esc(r.section)}"></label><div class="grid2"><label>ID<input data-field="rowId" value="${esc(r.rowId)}"></label><label>Título<input data-field="title" maxlength="24" value="${esc(r.title)}"></label></div><label>Descrição<input data-field="description" maxlength="72" value="${esc(r.description)}"></label>`:`<label>Texto do botão<input data-field="text" maxlength="20" value="${esc(r.text)}"></label>${mode==='cta'?`<label>URL HTTPS (preservada exatamente)<input data-field="value" placeholder="https://exemplo.com" value="${esc(r.value)}"></label>`:`<label>ID da resposta<input data-field="id" value="${esc(r.id)}"></label>`}`}</div>`).join('');
 $('#addInteractive').textContent=mode==='list'?'+ Adicionar opção à lista':'+ Adicionar botão';
 $('#addInteractive').disabled=rows.length>=(mode==='list'?10:3);
 $('#addInteractive').onclick=()=>add(mode);
 $('#interactiveRows').oninput=e=>{const field=e.target.dataset.field;if(field)rows[Number(e.target.closest('[data-row]').dataset.row)][field]=e.target.value;updateContentPreview();};
 $('#interactiveRows').onchange=$('#interactiveRows').oninput;
 $('#interactiveRows').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){rows.splice(Number(b.dataset.remove),1);render(mode);}};
 updateContentPreview();
}
export function interactiveValue(mode){
 if(!['cta','quick_reply','list'].includes(mode))return undefined;
 const value={title:$('#interactiveTitle').value,footer:$('#interactiveFooter').value};
 if(mode==='list'){
  value.buttonText=$('#listButtonText').value;value.sections=[];
  for(const r of rows){const title=r.section.trim()||'Opções';let s=value.sections.find(s=>s.title===title);if(!s){s={title,rows:[]};value.sections.push(s);}s.rows.push({rowId:r.rowId,title:r.title,description:r.description});}
 }else value.buttons=rows.map(r=>mode==='quick_reply'?{id:r.id,text:r.text}:{url:r.value,text:r.text});
 if(mode==='cta')value.image=photo;
 return value;
}

export function updateContentPreview(){
 const f=$('#campaignForm'),x=interactiveValue(activeMode)||{};
 const body=f.elements.text.value||'Sua mensagem aparecerá aqui';
 let html=(activeMode==='cta'&&photo?`<img class="cta-preview" src="${esc(photo)}" alt="Foto da mensagem">`:'')+`<div class="message-preview"><strong>${esc(x.title||'')}</strong><p>${esc(body)}</p><small>${esc(x.footer||'')}</small></div>`;
 if(activeMode==='invite')html+=`<div class="preview-option">Convite de grupo<small>${esc(f.elements.invite.value||'Informe o link do grupo')}</small></div>`;
 for(const b of x.buttons||[])html+=`<div class="preview-option">${esc(b.text||'Texto do botão')}<small>${esc(b.url||b.phoneNumber||b.id||'Defina a ação')}</small></div>`;
 if(activeMode==='list'){html+=`<strong>${esc(x.buttonText)}</strong>`;for(const s of x.sections||[])html+=`<h4>${esc(s.title)}</h4>`+s.rows.map(r=>`<div class="preview-option">${esc(r.title||'Título da opção')}<small>${esc(r.description)} · ID: ${esc(r.rowId)}</small></div>`).join('');}
 $('#contentPreview').innerHTML=html;
}

function refreshPhoto(){
 const img=$('#ctaPhotoPreview');img.hidden=!photo;if(photo)img.src=photo;else img.removeAttribute('src');
 $('#ctaPhotoStatus').textContent=photo?'Foto JPEG carregada e incluída na campanha.':'Selecione uma foto JPEG.';
}
async function readPhoto(e){
 const generation=++photoGeneration,file=e.target.files[0];photo='';refreshPhoto();updateContentPreview();
 if(!file)return;
 try{
  if(file.size>3*1024*1024)throw Error('Foto maior que 3 MB. Exporte um JPEG menor.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Selecione uma imagem JPEG válida.');
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Falha ao ler a foto.'));r.readAsDataURL(new Blob([bytes],{type:'image/jpeg'}));});
  if(generation!==photoGeneration)return;
  photo=data;refreshPhoto();updateContentPreview();$('#formError').textContent='';
 }catch(error){if(generation===photoGeneration)$('#formError').textContent=error.message;}
}
