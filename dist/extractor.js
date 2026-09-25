// Somente leitura. Não entra em grupos e não cria/revoga convites.
export async function extractPage(kind,options={}){
 const W=window.WPP;if(!W?.conn?.isMainReady?.())throw Error('WhatsApp ainda não está pronto.');
 const id=x=>typeof x==='string'?x:x?._serialized||(x?.user&&x?.server?`${x.user}@${x.server}`:'');
 const account=id(W.conn.getMyUserId());if(options.account&&options.account!==account)throw Error('Conta do WhatsApp alterada durante a extração.');
 const phone=x=>id(x).match(/^(\d+)(?::\d+)?@(c\.us|s\.whatsapp\.net)$/)?.[1]||'';
 const base=c=>({Nome:c?.name||c?.pushname||c?.verifiedName||'',Numero:phone(c?.id),ID:id(c?.id),Observacao:''});
 if(kind==='groups')return (await W.group.getAllGroups()).filter(Boolean).map(g=>({Nome:g.name||g.formattedTitle||g.groupMetadata?.subject||'',ID:id(g.id),Participantes:g.groupMetadata?.participants?.length??'',Link:'',Observacao:''}));
 if(kind==='groupLink'){
  try{const code=await W.group.getInviteCode(options.id);if(!code)throw Error('Convite indisponível.');return {Link:`https://chat.whatsapp.com/${code}`,Observacao:''};}
  catch(e){return {Link:'',Observacao:e.message||'Sem permissão para consultar convite.'};}
 }
 if(kind==='participants')return (await W.group.getParticipants(options.id)).map(p=>({...base(p.contact),ID:id(p.id),Numero:phone(p.id)||phone(p.contact?.id),Grupo:options.name||'',GrupoID:options.id}));
 if(kind==='contacts')return (await W.contact.list({onlyMyContacts:options.onlySaved!==false})).filter(c=>!c.isGroup&&/@(c\.us|s\.whatsapp\.net|lid)$/.test(id(c.id))).map(base);
 if(kind==='resolve'){
  const rows=options.rows;if(!Array.isArray(rows)||rows.length>50)throw Error('Lote inválido.');
  const out=[];
  for(let start=0;start<rows.length;start+=5){
   const batch=await Promise.all(rows.slice(start,start+5).map(async row=>{
    let c,map,err='';
    try{c=await W.contact.get(row.ID);}catch{}
    if(!row.Numero){
     let timer;try{map=await Promise.race([W.contact.getPnLidEntry(row.ID),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Resolução de telefone excedeu 5s.')),5000))]);}catch(e){err=e.message;}finally{clearTimeout(timer);}
    }
    const name=row.Nome||c?.name||map?.contact?.name||c?.pushname||map?.contact?.pushname||c?.verifiedName||map?.contact?.verifiedName||'';
    const number=row.Numero||phone(c?.id)||phone(map?.phoneNumber);
    return {...row,Nome:name,Numero:number,Observacao:[row.Observacao,!name?'Nome indisponível':'',!number?'Número indisponível':'',err].filter(Boolean).join(' | ')};
   }));out.push(...batch);
  }return out;
 }
 throw Error('Extração desconhecida.');
}
