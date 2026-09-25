export const labels = {draft:'Rascunho',running:'Em andamento',paused:'Pausada',cancelled:'Cancelada',completed:'Concluída',pending:'Pendente',processing:'Preparando',sending:'Enviando',sent:'Enviado',error:'Erro',uncertain:'Incerto',approval:'Aguardando aprovação',invalid:'Inválido',skipped:'Ignorado'};
export const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function inviteCode(value) {
  try { const u = new URL(String(value).trim()); if(u.protocol!=='https:' || u.hostname!=='chat.whatsapp.com') return ''; return /^\/[A-Za-z0-9]{15,40}\/?$/.test(u.pathname) ? u.pathname.split('/')[1] : ''; } catch { return ''; }
}
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0];
  const delimiter = [';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;} else if(quoted || cell==='') quoted=!quoted; else cell+=c; }
    else if(!quoted && c===delimiter){row.push(cell);cell='';}
    else if(!quoted && (c==='\n'||c==='\r')) {if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted) throw Error('CSV com aspas não fechadas.');
  row.push(cell); if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
export function importCSV(text, type) {
  const rows=parseCSV(text); if(!rows.length) throw Error('CSV vazio.');
  const h=rows[0].map(norm);
  const numberIndex=h.findIndex(v=>['numero','telefone','phone','number','whatsapp'].includes(v));
  const nameIndex=h.findIndex(v=>['nome','name'].includes(v));
  const idIndex=h.indexOf('id');
  const linkIndex=h.findIndex(v=>['link','url','convite','grupo','link do grupo'].includes(v));
  if(type==='contacts' && numberIndex<0) throw Error('CSV de contatos precisa da coluna Numero ou Telefone.');
  const header=type==='contacts'||linkIndex>=0;
  const seen=new Map();const preview=[];let duplicates=0;
  const items=rows.slice(header?1:0).map((r,i)=>{
    let target='',name='',error='',key='';
    if(type==='groups') {
      target=(r[linkIndex>=0?linkIndex:0]||'').trim();key=inviteCode(target);
      if(!key)error='Link de convite inválido (use https://chat.whatsapp.com/código).';
      name=nameIndex>=0?r[nameIndex]:'';
    } else {
      const raw=(r[numberIndex]||'').trim().replace(/^'/,'');
      target=raw.replace(/[+()\s.-]/g,'');name=nameIndex>=0?r[nameIndex]:'';
      if(!/^\d{8,15}$/.test(target)) error='Telefone inválido ou indisponível. Inclua DDI; LID não é telefone.';
      key=target;
    }
    const line=i+(header?2:1),duplicate=!error&&seen.has(key);
    preview.push({line,name:name||'',target,rawTarget:r[type==='groups'?(linkIndex>=0?linkIndex:0):numberIndex]||'',sourceId:idIndex>=0?r[idIndex]:'',importStatus:error?'invalid':duplicate?'duplicate':'valid',detail:error||(duplicate?`Repetido do registro ${seen.get(key)}; não será enviado.`:'Pronto para importar.')});
    if(duplicate){duplicates++;return null;} if(!error)seen.set(key,line);
    return {id:crypto.randomUUID(),line:i+(header?2:1),name:name||'',target,sourceId:idIndex>=0?r[idIndex]:'',status:error?'invalid':'pending',detail:error,attempts:0,history:[]};
  }).filter(Boolean);
  return {items,preview,duplicates,valid:items.filter(x=>x.status==='pending').length,invalid:items.filter(x=>x.status==='invalid').length};
}
export function validateConfig(c) {
  if(!String(c.name||'').trim()) throw Error('Informe o nome da campanha.');
  if(!['contacts','groups'].includes(c.type)||!['text','invite','cta','quick_reply','list'].includes(c.mode))throw Error('Tipo inválido.');
  if(!['invite','cta'].includes(c.mode)&&!String(c.text||'').trim())throw Error('Escreva a mensagem.');
  if(c.mode==='invite'&&!inviteCode(c.invite))throw Error('Informe um link de convite válido.');
  if(!Number.isFinite(c.min)||!Number.isFinite(c.max)||c.min<30||c.max<c.min||c.max>86400)throw Error('Intervalos: mínimo de 30s, máximo >= mínimo e até 86400s.');
  for(const k of ['daily','batch']) if(!Number.isInteger(c[k])||c[k]<1)throw Error('Limites precisam ser inteiros positivos.');
  validateInteractive(c);
}
export const modeLabels={text:'Texto',invite:'Convite nativo',cta:'CTA',quick_reply:'Quick reply',list:'Lista'};
export function validateInteractive(c){
 const x=c.interactive||{};
 if(c.mode==='cta'&&(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(x.image||'')||x.image.length>4*1024*1024))throw Error('CTA precisa de uma foto JPEG de até 3 MB.');
 if(['cta','quick_reply'].includes(c.mode)){
  if(!Array.isArray(x.buttons)||x.buttons.length<1||x.buttons.length>3)throw Error('Adicione de 1 a 3 botões.');
  const ids=new Set();
  for(const b of x.buttons){
   if(!b.text?.trim()||b.text.length>20)throw Error('Cada botão precisa de um texto de até 20 caracteres.');
   if(c.mode==='quick_reply'){if(!b.id?.trim()||ids.has(b.id))throw Error('IDs dos botões devem ser preenchidos e únicos.');ids.add(b.id);}
   // Invalid CTA URLs are discarded by the sender; never rewritten.

  }
 }
 if(c.mode==='list'){
  if(!x.buttonText?.trim()||x.buttonText.length>20)throw Error('Texto de abertura da lista: 1 a 20 caracteres.');
  const rows=x.sections?.flatMap(s=>s.rows||[]);if(!rows?.length||rows.length>10)throw Error('A lista precisa de 1 a 10 opções.');
  const ids=new Set();for(const r of rows){if(!r.rowId?.trim()||ids.has(r.rowId)||!r.title?.trim())throw Error('Opções da lista precisam de título e ID único.');ids.add(r.rowId);}
 }
}
export function delayMs(min,max,random=Math.random) {return Math.round((min+random()*(max-min))*1000);}
export function stats(items) {const s={total:items.length};for(const x of items)s[x.status]=(s[x.status]||0)+1;return s;}
export function csvExport(rows) {
  const escape=v=>{let s=String(v??'');if(/^\s*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\uFEFF'+rows.map(r=>r.map(escape).join(';')).join('\r\n');
}
export function recover(state, newSession) {
  for(const c of state.campaigns){
    let interrupted=false;
    for(const i of c.items)if(['processing','sending'].includes(i.status)){i.status='uncertain';i.detail='Execução interrompida. Confira o WhatsApp antes de decidir repetir.';interrupted=true;}
    if(c.status==='running'&&(newSession||interrupted)){c.status='paused';c.reason='Navegador ou execução reiniciado. Retomada manual.';c.nextAt=null;}
  }
  return state;
}
