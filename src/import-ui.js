import {norm} from './core.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function previewPage(rows,{query='',status='',page=0,size=25}={}){
 const filtered=rows.filter(r=>(!status||r.importStatus===status)&&norm([r.name,r.target,r.rawTarget,r.sourceId,r.detail,r.line].join(' ')).includes(norm(query)));
 const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.max(0,Math.min(page,pages-1));
 return {rows:filtered.slice(page*size,(page+1)*size),total:filtered.length,pages,page};
}
export function showImportPreview(data){
 const host=document.querySelector('#importPreview');host.hidden=!data;if(!data){host.innerHTML='';return;}
 const rows=data.preview,options={query:'',status:'',page:0,size:25};
 host.innerHTML=`<h3>Conferir importação</h3><p>${rows.length} registros · ${data.valid} válidos · ${data.invalid} inválidos · ${data.duplicates} duplicados</p><p class="hint">Telefones têm pontuação removida. Duplicados válidos são excluídos da fila; inválidos ficam registrados sem envio. Busca e filtros afetam apenas esta prévia.</p><div class="filters"><input id="importSearch" placeholder="Buscar nome, número, link, ID ou erro" aria-label="Buscar na importação"><select id="importStatus" aria-label="Status da importação"><option value="">Todos</option><option value="valid">Válidos</option><option value="invalid">Inválidos</option><option value="duplicate">Duplicados</option></select><select id="importSize" aria-label="Registros por página"><option>25</option><option>50</option><option>100</option></select></div><div id="importRows"></div>`;
 function render(){
  const result=previewPage(rows,options);options.page=result.page;
  host.querySelector('#importRows').innerHTML=`<div class="table-wrap"><table class="import-table"><thead><tr><th>Registro</th><th>Nome / ID</th><th>Destino</th><th>Validação</th></tr></thead><tbody>${result.rows.map(r=>`<tr><td data-label="Registro">${r.line}</td><td data-label="Nome / ID">${esc(r.name||'Sem nome')}<small>${esc(r.sourceId)}</small></td><td data-label="Destino">${esc(r.target)}${r.rawTarget!==r.target?`<small>Original: ${esc(r.rawTarget)}</small>`:''}</td><td data-label="Validação"><strong>${({valid:'Válido',invalid:'Inválido',duplicate:'Duplicado'})[r.importStatus]}</strong><small>${esc(r.detail)}</small></td></tr>`).join('')||'<tr><td colspan="4">Nenhum registro encontrado.</td></tr>'}</tbody></table></div><div class="pager"><button type="button" id="importPrev" ${result.page===0?'disabled':''}>← Anterior</button><span role="status">${result.total} resultados · ${result.page+1}/${result.pages}</span><button type="button" id="importNext" ${result.page+1>=result.pages?'disabled':''}>Próxima →</button></div>`;
  host.querySelector('#importPrev').onclick=()=>{options.page--;render();};host.querySelector('#importNext').onclick=()=>{options.page++;render();};
 }
 for(const [id,key] of [['importSearch','query'],['importStatus','status'],['importSize','size']])host.querySelector('#'+id).addEventListener(key==='query'?'input':'change',e=>{options[key]=key==='size'?Number(e.target.value):e.target.value;options.page=0;render();});
 render();
}
