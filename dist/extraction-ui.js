import {exportRows} from './export.js';
import {norm} from './core.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installExtraction(rpc){
 let kind,connection,groups=[],selected=new Set(),result=[],busy=false,cancelled=false,loadId=0;
 const dialog=$('#extraction');
 function groupList(){const query=norm($('#extractSearch').value);const visible=groups.filter(g=>norm(g.Nome+' '+g.ID).includes(query));$('#extractGroups').innerHTML=visible.map(g=>`<label class="check-row"><input type="checkbox" data-group="${esc(g.ID)}" ${selected.has(g.ID)?'checked':''}><span>${esc(g.Nome||'Sem nome')}<small>${esc(g.ID)}</small></span></label>`).join('')||'<p>Nenhum grupo encontrado.</p>';$('#selectionCount').textContent=`${selected.size} grupo(s) selecionado(s)`;}
 function message(s){$('#extractStatus').textContent=s;}
 function controls(){ $('#runExtraction').disabled=busy||!connection;$('#stopExtraction').disabled=!busy;$('#downloadExtraction').disabled=busy||!result.length;$('#extractGroups').inert=busy;$('#selectGroups').disabled=busy;$('#onlySaved').disabled=busy;}
 document.querySelectorAll('[data-extract]').forEach(b=>b.onclick=async()=>{
  if(busy)return;kind=b.dataset.extract;$('#extractMenu').open=false;connection=null;groups=[];selected.clear();result=[];cancelled=false;const ticket=++loadId;
  $('#extractTitle').textContent={groups:'Extrair grupos',participants:'Extrair participantes',contacts:'Extrair contatos'}[kind];$('#groupSelection').hidden=kind==='contacts';$('#onlySavedLabel').hidden=kind!=='contacts';$('#extractSearch').value='';$('#extractGroups').replaceChildren();$('#extractProgress').value=0;$('#extractPreview').textContent='';message('Conectando ao WhatsApp…');controls();dialog.showModal();
  try{const conn=await rpc('connect');if(ticket!==loadId||!dialog.open)return;connection=conn;if(kind!=='contacts'){groups=await rpc('extract',{kind:'groups',tabId:conn.tabId,options:{account:conn.account}});if(ticket!==loadId||!dialog.open)return;if(kind==='groups')selected=new Set(groups.map(g=>g.ID));groupList();}message('Selecione as opções e clique em Extrair.');}catch(e){message(e.message);}controls();
 });
 $('#extractSearch').oninput=groupList;
 $('#extractGroups').onchange=e=>{const id=e.target.dataset.group;if(id)e.target.checked?selected.add(id):selected.delete(id);$('#selectionCount').textContent=`${selected.size} grupo(s) selecionado(s)`;};
 $('#selectGroups').onclick=()=>{const visible=groups.filter(g=>norm(g.Nome+' '+g.ID).includes(norm($('#extractSearch').value)));const all=visible.every(g=>selected.has(g.ID));visible.forEach(g=>all?selected.delete(g.ID):selected.add(g.ID));groupList();};
 $('#closeExtraction').onclick=()=>{if(busy){cancelled=true;message('Interrompendo após a consulta atual…');return;}loadId++;dialog.close();};
 dialog.addEventListener('cancel',e=>{if(busy){e.preventDefault();cancelled=true;}else loadId++;});
 $('#stopExtraction').onclick=()=>{cancelled=true;message('Interrompendo após a consulta atual…');};
 const call=(kind,options={})=>rpc('extract',{kind,tabId:connection.tabId,options:{...options,account:connection.account}});
 async function resolve(rows){for(let i=0;i<rows.length&&!cancelled;i+=50){const batch=rows.slice(i,i+50);let mapped;try{mapped=await call('resolve',{rows:batch});}catch(e){mapped=batch.map(r=>({...r,Observacao:[r.Observacao,e.message].filter(Boolean).join(' | ')}));}result.push(...mapped);message(`Extraídos ${result.length} registros…`);}}
 $('#runExtraction').onclick=async()=>{
  if(kind!=='contacts'&&!selected.size){message('Selecione pelo menos um grupo.');return;}
  busy=true;cancelled=false;result=[];controls();$('#extractProgress').value=0;
  try{
   if(kind==='contacts'){message('Consultando contatos…');const rows=await call('contacts',{onlySaved:$('#onlySaved').checked});await resolve(rows);$('#extractProgress').value=cancelled?0:100;}
   else {const chosen=groups.filter(g=>selected.has(g.ID));for(let i=0;i<chosen.length&&!cancelled;i++){
    const g=chosen[i];message(`Consultando ${g.Nome||g.ID} (${i+1}/${chosen.length})…`);
    try{if(kind==='groups')result.push({...g,...await call('groupLink',{id:g.ID})});else await resolve(await call('participants',{id:g.ID,name:g.Nome}));}
    catch(e){result.push(kind==='groups'?{...g,Observacao:e.message}:{Nome:'',Numero:'',ID:'',Grupo:g.Nome,GrupoID:g.ID,Observacao:e.message});}
    $('#extractProgress').value=(i+1)/chosen.length*100;
   }}
   message(`${cancelled?'Extração interrompida. Resultado parcial':'Extração concluída'}: ${result.length} registros. Participantes em vários grupos mantêm uma linha por grupo.`);
   $('#extractPreview').textContent=result.slice(0,5).map(r=>`${r.Nome||'Sem nome'} — ${r.Numero||r.Link||r.ID||'Indisponível'}${r.Observacao?' · '+r.Observacao:''}`).join('\n');
  }catch(e){message(`Falha: ${e.message}. ${result.length} registros disponíveis.`);}finally{busy=false;controls();}
 };
 $('#downloadExtraction').onclick=()=>{
  const keys=kind==='groups'?['Nome','Link','ID','Participantes','Observacao']:kind==='participants'?['Nome','Numero','ID','Grupo','GrupoID','Observacao']:['Nome','Numero','ID','Observacao'];
  exportRows(`extracao_${kind}_${new Date().toISOString().slice(0,10)}`,[keys,...result.map(r=>keys.map(k=>r[k]??''))],$('#extractFormat').value);
 };
}
