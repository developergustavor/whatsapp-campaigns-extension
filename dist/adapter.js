// Executada no MAIN world via chrome.scripting; não expõe ponte postMessage.
export async function pageOperation(action, data={}) {
  const root=window.__campanhasWA ||= {tokens:{},busy:false};
  if(action==='stop'){root.tokens[data.id]=null;return {ok:true};}
  const W=window.WPP;
  const wid=x=>typeof x==='string'?x:x?._serialized||(x?.user&&x?.server?`${x.user}@${x.server}`:'');
  const ready=()=>!!(W?.conn?.isMainReady?.() && navigator.onLine);
  const account=wid(W?.conn?.getMyUserId?.());
  if(action==='ready')return {ready:ready(),busy:root.busy,account,version:W?.version||''};
  if(!ready())throw Error('WhatsApp desconectado ou ainda sincronizando.');
  if(action==='arm'){root.tokens[data.id]=data.token;return {ok:true};}
  const active=()=>root.tokens[data.id]===data.token && ready() && (!data.account||data.account===wid(W.conn.getMyUserId()));
  if(!active())throw Error('Execução pausada ou desconectada.');
  if(action==='prepare') {
    let target=data.target; let groupName='';
    if(data.type==='groups') {
      const info=await W.group.getGroupInfoFromInviteCode(data.code);
      if(!active())throw Error('Pausada.');
      const groups=await W.group.getAllGroups();
      const existing=groups.find(g=>g&&wid(g.id)===wid(info.id));
      if(!existing){
        if(!active())throw Error('Pausada.');
        const joined=await W.group.join(data.code);
        if(joined?.pendingApproval)return {approval:true,detail:'Entrada solicitada; aguarda aprovação do administrador.'};
        target=wid(joined?.id)||wid(info.id);
      } else target=wid(existing.id);
      groupName=info.subject||'';
      if(!target.endsWith('@g.us'))throw Error('Não foi possível resolver o ID do grupo.');
      const chat=await W.group.ensureGroup(target);
      if(chat.groupMetadata?.announce && !(await W.group.iAmAdmin(target)))throw Error('Grupo permite mensagens apenas de administradores.');
    } else target=target+'@c.us';
    let invitation=null;
    if(data.mode==='invite'){
      if(typeof W.chat.sendGroupInviteMessage!=='function')throw Error('Convite nativo não disponível nesta versão do WA-JS.');
      const info=await W.group.getGroupInfoFromInviteCode(data.inviteCode);
      invitation={inviteCode:data.inviteCode,groupId:wid(info.id),groupName:info.subject};
    }
    if(!active())throw Error('Pausada.');
    return {target,groupName,invitation};
  }
  if(action==='send') {
    if(root.busy)throw Error('Há uma operação anterior pendente nesta aba.');
    root.busy=true;
    try {
      if(!active())throw Error('Pausada antes do envio.');
      const opts={waitForAck:true,markIsRead:false,detectMentioned:false};
      let result;
      if(data.invitation)result=await W.chat.sendGroupInviteMessage(data.target,{...opts,...data.invitation,caption:data.text||undefined});
      else if(data.mode==='list')result=await W.chat.sendListMessage(data.target,{...opts,...data.interactive,description:data.text});
      else if(['cta','quick_reply'].includes(data.mode))result=await W.chat.sendTextMessage(data.target,data.text,{...opts,...data.interactive,useInteractiveMessage:true});
      else result=await W.chat.sendTextMessage(data.target,data.text,opts);
      return {id:wid(result.id)||String(result.id||''),ack:result.ack};
    } finally {root.busy=false;}
  }
  throw Error('Operação desconhecida.');
}
