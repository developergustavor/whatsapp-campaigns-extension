import {showImportPreview} from './import-ui.js';
import {initInteractive,interactiveValue,resetInteractive,switchInteractive,updateContentPreview} from './interactive-ui.js';
import {installExtraction} from './extraction-ui.js';
import {exportRows} from './export.js';
import {dashboardMarkup} from './dashboard.js';
import {importCSV,stats,labels,csvExport,norm,modeLabels} from './core.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=s=>`<span class="badge ${esc(s)}">${esc(labels[s]||s)}</span>`;
const date=t=>t?new Date(t).toLocaleString('pt-BR'):'—';
let state={campaigns:[],blocked:[]},selected=null,search='',status='',page=0,editing=null,imported=null,importGeneration=0,importBusy=false;
async function rpc(action,data={}){const r=await chrome.runtime.sendMessage({action,...data});if(!r?.ok)throw Error(r?.error||'Extensão indisponível. Recarregue o painel.');return r.data;}
function notice(message,error=false){$('#notice').hidden=false;$('#notice').textContent=message;$('#notice').className=error?'error':'';}
async function refresh(){state=await rpc('state');if(!selected||!state.campaigns.some(c=>c.id===selected))selected=state.campaigns[0]?.id;render();}
async function act(fn){try{await fn();await refresh();}catch(e){notice(e.message,true);}}
function render(){
 const all=state.campaigns.flatMap(c=>c.items),s=stats(all);
 $('#summary').innerHTML=[['Campanhas',state.campaigns.length],['Destinos',s.total],['Enviados',s.sent||0],['Precisam de atenção',(s.error||0)+(s.uncertain||0)+(s.invalid||0)+(s.approval||0)]].map(([label,value])=>`<div class="metric"><span>${label}</span><strong>${value.toLocaleString('pt-BR')}</strong></div>`).join('');
 const cs=state.campaigns.filter(c=>norm(c.name).includes(norm($('#campaignSearch').value))&&(!$('#campaignStatus').value||c.status===$('#campaignStatus').value));
 $('#campaignList').innerHTML=cs.map(c=>{const s=stats(c.items),done=c.items.filter(i=>!['pending','processing','sending'].includes(i.status)).length;return `<button class="campaign ${c.id===selected?'selected':''}" data-select="${c.id}"><strong>${esc(c.name)}</strong>${badge(c.status)}<p>${s.sent||0} enviados · ${c.items.length} destinos</p><progress max="${c.items.length||1}" value="${done}"></progress></button>`;}).join('')||'<p class="muted">Nenhuma campanha por aqui.</p>';
 applyRoute();renderDetail();
}
function renderDetail(){
 const c=state.campaigns.find(c=>c.id===selected);
 if(!c){$('#detail').innerHTML='<div class="empty"><strong>Sua primeira campanha começa aqui.</strong><p>Importe um CSV, escolha o conteúdo e defina o ritmo.</p></div>';return;}
 const s=stats(c.items),done=c.items.filter(i=>!['pending','processing','sending'].includes(i.status)).length;
 const live=c.status==='running',locked=c.items.some(i=>['processing','sending'].includes(i.status));
 const parts=[['sent','#128367'],['pending','#dce8e2'],['error','#d87b64'],['uncertain','#d8ab41'],['approval','#e1c57d'],['invalid','#b88e82'],['skipped','#889a92'],['processing','#5baab4'],['sending','#5baab4']];
 const dates=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d;});
 const values=dates.map(d=>c.items.filter(i=>i.status==='sent'&&i.finishedAt&&new Date(i.finishedAt).toDateString()===d.toDateString()).length),max=Math.max(1,...values);
 $('#detail').innerHTML=`<div class="detail-head"><div><p class="eyebrow">${c.type==='groups'?'GRUPOS':'CONTATOS'} · ${esc(modeLabels[c.mode]||c.mode)}</p><h2>${esc(c.name)}</h2>${badge(c.status)}</div><div><span class="muted">Próximo destino</span><div class="timer" id="timer">—</div></div></div><div class="actions"><button data-action="details">Dashboard completo ↗</button><button class="primary" data-action="start" ${live||locked||['completed','cancelled'].includes(c.status)?'disabled':''}>▶ Iniciar / retomar</button><button data-action="pause" ${!live?'disabled':''}>Ⅱ Pausar</button><button data-action="edit" ${live||locked||['completed','cancelled'].includes(c.status)?'disabled':''}>Editar</button><button data-action="cancel" ${['completed','cancelled'].includes(c.status)?'disabled':''}>Cancelar</button><button data-action="export">↓ CSV</button><button data-action="xlsx">↓ XLSX</button><button class="danger" data-action="delete" ${live||locked?'disabled':''}>Excluir</button></div><div class="statusline">${esc(c.reason||(live?'Campanha em andamento.':'Pronta para executar.'))}<br>${done}/${s.total} processados · ${c.min}–${c.max}s entre destinos · ${c.sessionAttempts||0}/${c.batch} tentativas nesta execução${locked?'<br>Uma operação está em andamento; pausar impede as próximas.':''}</div><progress max="${s.total||1}" value="${done}"></progress><div class="charts"><div class="chart"><h3>Distribuição dos destinos</h3><div class="stack">${parts.map(([k,color])=>`<span style="width:${100*(s[k]||0)/(s.total||1)}%;background:${color}" title="${labels[k]}: ${s[k]||0}"></span>`).join('')}</div><div class="legend">${parts.filter(([k])=>s[k]).map(([k])=>`<span>${labels[k]} ${s[k]}</span>`).join('')}</div></div><div class="chart"><h3>Enviados · últimos 7 dias</h3><div class="bars">${dates.map((d,i)=>`<div class="bar" style="height:${Math.max(3,values[i]/max*65)}px"><span>${values[i]||''}</span><small>${d.getDate()}/${d.getMonth()+1}</small></div>`).join('')}</div></div></div>${location.hash.startsWith('#campaign/')?dashboardMarkup(c):''}<div class="filters"><input id="itemSearch" aria-label="Buscar destinatário" placeholder="Buscar nome, número, link ou erro…" value="${esc(search)}"><select id="itemStatus" aria-label="Filtrar resultados"><option value="">Todos os resultados</option>${parts.map(([k])=>`<option value="${k}" ${status===k?'selected':''}>${labels[k]}</option>`).join('')}</select></div><div id="results"></div>`;
 $('#itemSearch').addEventListener('input',e=>{search=e.target.value;page=0;renderRows();});$('#itemStatus').addEventListener('change',e=>{status=e.target.value;page=0;renderRows();});
 renderRows();timer();
}
function renderRows(){
 const c=state.campaigns.find(c=>c.id===selected);if(!c)return;
 const rows=c.items.filter(i=>(!status||i.status===status)&&norm([i.name,i.target,i.detail,i.groupName].join(' ')).includes(norm(search)));
 const pages=Math.max(1,Math.ceil(rows.length/50));page=Math.min(page,pages-1);
 $('#results').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Destino</th><th>Resultado</th><th>Detalhes</th></tr></thead><tbody>${rows.slice(page*50,page*50+50).map(i=>`<tr><td>${esc(i.name||i.groupName||'Sem nome')}<small>${esc(i.target)}</small><small>Linha ${i.line} · ${i.attempts} tentativa(s)</small></td><td>${badge(i.status)}<small>${date(i.finishedAt)}</small>${['uncertain','error','approval'].includes(i.status)&&c.status!=='running'&&c.status!=='cancelled'?`<button class="small" data-resolve="${i.id}">Revisar</button>`:''}</td><td>${esc(i.detail||'Aguardando execução')} ${i.messageId?`<small>ID: ${esc(i.messageId)}</small>`:''}<details><summary>Histórico</summary>${i.history.map(h=>`<small>${date(h.at)} · ${esc(h.event)} ${esc(h.detail||h.status||'')}</small>`).join('')||'Sem tentativas.'}</details></td></tr>`).join('')||'<tr><td colspan="3">Nenhum destino encontrado.</td></tr>'}</tbody></table></div><div class="pager"><button data-page="-1" ${page===0?'disabled':''}>←</button><span>${rows.length} resultados · página ${page+1}/${pages}</span><button data-page="1" ${page>=pages-1?'disabled':''}>→</button></div>`;
}
function timer(){const c=state.campaigns.find(c=>c.id===selected),el=$('#timer');if(!el)return;if(c?.status!=='running'||!c.nextAt){el.textContent=c?.status==='running'?'Processando…':'—';return;}const seconds=Math.max(0,Math.ceil((c.nextAt-Date.now())/1000));el.textContent=seconds?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'Aguardando Chrome…';}
function openEditor(c=null){importGeneration++;importBusy=false;showImportPreview(null);resetInteractive();editing=c?.id||null;imported=null;const f=$('#campaignForm');f.reset();$('#formError').textContent='';$('#csvFile').value='';for(const k of ['name','type','mode','text','invite','min','max','daily','batch'])if(c)f.elements[k].value=c[k];f.elements.type.disabled=!!c;$('#uploadLabel').hidden=!!c;$('#importInfo').textContent=c?`${c.items.length} destinos preservados. A edição afeta apenas os próximos envios.`:'Contatos: Nome;Numero;ID;Observacao. Grupos: um link por linha.';$('#formTitle').textContent=c?'Editar campanha':'Nova campanha';$('#inviteLabel').hidden=f.elements.mode.value!=='invite';f.elements.invite.disabled=f.elements.mode.value!=='invite';initInteractive(f.elements.mode.value,c?.interactive);$('#editor').showModal();}
function download(name,content,type){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}
$('#new').onclick=()=>openEditor();$('#closeEditor').onclick=$('#cancelEditor').onclick=()=>$('#editor').close();
$('#campaignForm').elements.mode.onchange=e=>{$('#inviteLabel').hidden=e.target.value!=='invite';$('#campaignForm').elements.invite.disabled=e.target.value!=='invite';switchInteractive(e.target.value);};
$('#modeChoices').onclick=e=>{const b=e.target.closest('[data-mode]');if(b){const field=$('#contentMode');field.value=b.dataset.mode;field.dispatchEvent(new Event('change',{bubbles:true}));}};
$('#campaignForm').addEventListener('input',updateContentPreview);
$('#appVersion').textContent='v'+chrome.runtime.getManifest().version;
$('#campaignForm').elements.type.onchange=()=>{importGeneration++;importBusy=false;showImportPreview(null);imported=null;$('#csvFile').value='';$('#importInfo').textContent='Selecione o CSV para este tipo de destino.';};
$('#csvFile').onchange=async e=>{
 const generation=++importGeneration;imported=null;showImportPreview(null);importBusy=true;
 $('#importInfo').textContent='Lendo arquivo…';$('#formError').textContent='';
 try{const file=e.target.files[0];if(!file){$('#importInfo').textContent='Selecione um CSV.';return;}
 if(file.size>10*1024*1024)throw Error('CSV maior que 10 MB. Divida em arquivos menores.');
 const type=$('#campaignForm').elements.type.value,text=await file.text();if(generation!==importGeneration)return;
 imported=importCSV(text,type);showImportPreview(imported);
 $('#importInfo').textContent=`${file.name} · ${imported.valid} válidos · ${imported.invalid} inválidos · ${imported.duplicates} duplicados removidos`;
 }catch(err){if(generation===importGeneration){$('#formError').textContent=err.message;$('#importInfo').textContent='Arquivo não importado.';}}
 finally{if(generation===importGeneration)importBusy=false;}
};
$('#campaignForm').onsubmit=async e=>{e.preventDefault();if(importBusy){$('#formError').textContent='Aguarde a leitura do CSV.';return;}const f=e.target;const config=Object.fromEntries(['name','type','mode','text','invite','min','max','daily','batch'].map(k=>[k,['min','max','daily','batch'].includes(k)?Number(f.elements[k].value):f.elements[k].value]));config.interactive=interactiveValue(config.mode);try{selected=await rpc('save',{id:editing,config,items:imported?.items});$('#editor').close();await refresh();notice('Campanha salva. Nenhum envio foi iniciado.');}catch(err){$('#formError').textContent=err.message;}};
$('#campaignSearch').oninput=render;$('#campaignStatus').onchange=render;
$('#connect').onclick=()=>act(async()=>{notice('Conectando…');const c=await rpc('connect');notice(`WhatsApp pronto. WA-JS ${c.version||'carregado'}.`);});
$('#detach').onclick=()=>act(()=>rpc('detach'));$('#tab').onclick=()=>act(()=>rpc('tab'));
$('#blocklist').onclick=()=>{$('#blockedTargets').value=state.blocked.join('\n');$('#blocks').showModal();};$('#closeBlocks').onclick=()=>$('#blocks').close();$('#saveBlocks').onclick=()=>act(async()=>{await rpc('block',{targets:$('#blockedTargets').value.split(/\r?\n/)});$('#blocks').close();});
document.addEventListener('click',e=>{
 const select=e.target.closest('[data-select]');if(select){selected=select.dataset.select;search='';status='';page=0;if(location.hash.startsWith('#campaign/'))location.hash='campaign/'+selected;render();return;}
 const pg=e.target.closest('[data-page]');if(pg){page+=Number(pg.dataset.page);renderRows();return;}
 const resolve=e.target.closest('[data-resolve]');if(resolve){const answer=prompt('Confira a conversa no WhatsApp. Digite: REPETIR para voltar à fila, ENVIADO para confirmar manualmente ou IGNORAR. Uma repetição pode duplicar uma mensagem já enviada.');const map={REPETIR:'pending',ENVIADO:'sent',IGNORAR:'skipped'};if(map[answer?.trim().toUpperCase()])act(()=>rpc('resolve',{id:selected,itemId:resolve.dataset.resolve,status:map[answer.trim().toUpperCase()]}));return;}
 const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,c=state.campaigns.find(c=>c.id===selected);
 if(action==='details'){location.hash='campaign/'+c.id;return;}
 if(action==='edit'){openEditor(c);return;}
 if(action==='export'||action==='xlsx'){exportRows(c.name+'_resultados',[['Nome','Destino','Status','Detalhes','Tentativas','Data','ID da mensagem'],...c.items.map(i=>[i.name||i.groupName,i.target,labels[i.status],i.detail,i.attempts,date(i.finishedAt),i.messageId])],action==='xlsx'?'xlsx':'csv');return;}
 if(action==='cancel'&&!confirm('Cancelar esta campanha? Ela não poderá ser retomada. Uma operação já iniciada pode terminar.'))return;
 if(action==='delete'&&!confirm('Excluir campanha e histórico permanentemente? Exporte o CSV antes, se precisar.'))return;
 act(()=>rpc(action,{id:selected}));
});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.campaignsDB){const focused=document.activeElement;const caret=focused?.id==='itemSearch'?focused.selectionStart:null;state=changes.campaignsDB.newValue;render();if(caret!==null){$('#itemSearch')?.focus();$('#itemSearch')?.setSelectionRange(caret,caret);}}});
setInterval(timer,1000);refresh().catch(e=>notice(e.message,true));

function applyRoute(){const full=location.hash.startsWith('#campaign/');document.body.classList.toggle('campaign-page',full);$('#backOverview').hidden=!full;if(full){const id=decodeURIComponent(location.hash.slice(10));if(state.campaigns.some(c=>c.id===id))selected=id;}}
window.addEventListener('hashchange',()=>{search='';status='';page=0;render();window.scrollTo(0,0);});
$('#backOverview').onclick=()=>location.hash='';
installExtraction(rpc);
$('#createTest').onclick=async()=>{
 const f=$('#campaignForm'),number=$('#testPhone').value;
 if(number===null)return;const clean=number.replace(/[+()\s.-]/g,'');if(!/^\d{8,15}$/.test(clean)){$('#formError').textContent='Telefone de teste inválido.';return;}
 const config={name:'Teste · '+(f.elements.name.value||'Mensagem'),type:'contacts',mode:f.elements.mode.value,text:f.elements.text.value,invite:f.elements.invite.value,min:30,max:30,daily:Number(f.elements.daily.value),batch:1,interactive:interactiveValue(f.elements.mode.value)};
 try{selected=await rpc('save',{config,items:importCSV('Nome;Numero\nContato de teste;'+clean,'contacts').items});$('#editor').close();location.hash='campaign/'+selected;await refresh();notice('Teste salvo. Clique em Iniciar para enviar ao contato informado.');}catch(e){$('#formError').textContent=e.message;}
};
