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
  const seen=new Set();let duplicates=0;
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
    if(!error && seen.has(key)){duplicates++;return null;} if(!error)seen.add(key);
    return {id:crypto.randomUUID(),line:i+(header?2:1),name:name||'',target,sourceId:idIndex>=0?r[idIndex]:'',status:error?'invalid':'pending',detail:error,attempts:0,history:[]};
  }).filter(Boolean);
  return {items,duplicates,valid:items.filter(x=>x.status==='pending').length,invalid:items.filter(x=>x.status==='invalid').length};
}
export function validateConfig(c) {
  if(!String(c.name||'').trim()) throw Error('Informe o nome da campanha.');
  if(!['contacts','groups'].includes(c.type)||!['text','invite'].includes(c.mode))throw Error('Tipo inválido.');
  if(c.mode==='text'&&!String(c.text||'').trim())throw Error('Escreva a mensagem.');
  if(c.mode==='invite'&&!inviteCode(c.invite))throw Error('Informe um link de convite válido.');
  if(!Number.isFinite(c.min)||!Number.isFinite(c.max)||c.min<30||c.max<c.min||c.max>86400)throw Error('Intervalos: mínimo de 30s, máximo >= mínimo e até 86400s.');
  for(const k of ['daily','batch']) if(!Number.isInteger(c[k])||c[k]<1)throw Error('Limites precisam ser inteiros positivos.');
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
