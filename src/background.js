import {validateConfig,delayMs,inviteCode,recover} from './core.js';
import {pageOperation} from './adapter.js';
import {extractPage} from './extractor.js';
const KEY='campaignsDB';
let chain=Promise.resolve(),working=false;
const read=async()=> (await chrome.storage.local.get(KEY))[KEY]||{schema:1,campaigns:[],blocked:[]};
const mutate=fn=>{const task=chain.then(async()=>{const s=await read();const result=fn(s);await chrome.storage.local.set({[KEY]:s});return result;});chain=task.catch(()=>{});return task;};
const boot=(async()=>{
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const session=await chrome.storage.session.get('booted');
  await mutate(s=>recover(s,!session.booted));
  await chrome.storage.session.set({booted:true});
  await chrome.alarms.create('health',{periodInMinutes:0.5});
  await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
  for(const c of (await read()).campaigns)if(c.status==='running'&&c.nextAt)await schedule(c);
})();
const getCampaign=(s,id)=>{const c=s.campaigns.find(c=>c.id===id);if(!c)throw Error('Campanha não encontrada.');return c;};
async function schedule(c){if(c.status==='running'&&c.nextAt)await chrome.alarms.create('run:'+c.id,{when:Math.max(Date.now()+50,c.nextAt)});}
async function page(tabId,action,data={}){
  const result=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:pageOperation,args:[action,data]});
  if(!result?.[0] || result[0].error)throw Error(result?.[0]?.error?.message||'Sem resposta do WhatsApp.');
  return result[0].result;
}
async function connect(){
  const tabs=await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
  if(!tabs.length)throw Error('Abra o WhatsApp Web e faça login primeiro.');
  if(tabs.length>1)throw Error('Deixe apenas uma aba do WhatsApp Web aberta para iniciar.');
  const tab=tabs[0];
  const check=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>!!window.WPP?.chat});
  if(!check[0]?.result)await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['vendor/wppconnect-wa.js']});
  for(let i=0;i<30;i++){
    const status=await page(tab.id,'ready');
    if(status.ready){if(status.busy)throw Error('Envio anterior pendente. Aguarde ou recarregue o WhatsApp antes de retomar.');return {tabId:tab.id,...status};}
    await new Promise(r=>setTimeout(r,500));
  }
  throw Error('WA-JS ainda não está pronto. Aguarde a sincronização ou recarregue a aba.');
}
async function stop(id,reason,status='paused'){
  const c=await mutate(s=>{const c=getCampaign(s,id);if(!['completed','cancelled'].includes(c.status)||status==='cancelled'){c.status=status;c.reason=reason;c.nextAt=null;}return structuredClone(c);});
  await chrome.alarms.clear('run:'+id);
  if(c.tabId)await page(c.tabId,'stop',{id}).catch(()=>{});
}
const timeout=(promise,ms)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Tempo limite. Resultado não confirmado.')),ms);promise.then(v=>{clearTimeout(t);resolve(v);},e=>{clearTimeout(t);reject(e);});});
const day=()=>new Date().toLocaleDateString('en-CA');
async function tick(id){
  await boot;if(working)return;working=true;
  let tabId,token,itemId,phase='idle';
  try{
    let c=(await read()).campaigns.find(c=>c.id===id);
    if(!c||c.status!=='running'||!c.nextAt||c.nextAt>Date.now()+50)return;
    if(Date.now()-c.nextAt>120000){await stop(id,'Agendamento atrasado por suspensão/inatividade. Retome manualmente.');return;}
    tabId=c.tabId;token=c.token;
    const ready=await page(tabId,'ready');
    if(!ready.ready||ready.busy||ready.account!==c.account){await stop(id,'WhatsApp indisponível, conta alterada ou operação anterior pendente.');return;}
    const payload=await mutate(s=>{
      c=getCampaign(s,id);if(c.status!=='running')return null;
      const today=c.account+'|'+day();
      s.dailyCounts ||= {};
      const todayCount=s.dailyCounts[today]||0;
      if(todayCount>=c.daily||c.sessionAttempts>=c.batch){c.status='paused';c.reason=todayCount>=c.daily?'Limite diário de tentativas da conta atingido.':'Limite desta execução atingido. Retome manualmente.';c.nextAt=null;return null;}
      for(const i of c.items)if(i.status==='pending'&&s.blocked.includes(i.target)){i.status='skipped';i.detail='Destino na lista de exclusão.';}
      const item=c.items.find(i=>i.status==='pending');
      if(!item){c.status='completed';c.reason='Todos os destinos foram processados.';c.nextAt=null;return null;}
      item.status='processing';item.attempts++;item.startedAt=Date.now();item.history.push({event:'attempt',day:today,at:Date.now()});c.sessionAttempts++;s.dailyCounts[today]=todayCount+1;c.nextAt=null;
      return {c:structuredClone(c),item:structuredClone(item)};
    });
    if(!payload)return;
    c=payload.c;const item=payload.item;itemId=item.id;phase='prepare';
    await page(tabId,'arm',{id,token});
    if((await read()).campaigns.find(x=>x.id===id)?.status!=='running'){await page(tabId,'stop',{id});throw Error('Pausada antes de preparar.');}
    const prepared=await timeout(page(tabId,'prepare',{id,token,account:c.account,type:c.type,target:item.target,code:inviteCode(item.target),mode:c.mode,inviteCode:inviteCode(c.invite)}),60000);
    if(prepared.approval){await finish(id,itemId,{status:'approval',detail:prepared.detail});return;}
    const proceed=await mutate(s=>{
      const c=getCampaign(s,id),item=c.items.find(x=>x.id===itemId);
      if(c.status!=='running'||c.token!==token){item.status='pending';item.detail='Pausada antes do envio.';return false;}
      item.status='sending';item.resolvedTarget=prepared.target;item.groupName=prepared.groupName;return true;
    });
    if(!proceed){await page(tabId,'stop',{id});return;}
    phase='send';
    const text=c.text.replace(/\{\{nome\}\}/g,item.name||prepared.groupName||'').replace(/\{\{numero\}\}/g,c.type==='contacts'?item.target:'');
    const result=await timeout(page(tabId,'send',{id,token,account:c.account,...prepared,text,mode:c.mode,interactive:c.interactive}),60000);
    if(!(result?.ack>=1))throw Error('WhatsApp não confirmou ACK de envio.');
    await finish(id,itemId,{status:'sent',detail:'Envio confirmado pelo WhatsApp (ACK ≥ 1; não significa leitura).',messageId:result.id,ack:result.ack});
  }catch(error){
    if(tabId)await page(tabId,'stop',{id}).catch(()=>{});
    if(itemId){
      const uncertain=phase==='send'||/Tempo limite/.test(error.message);
      await finish(id,itemId,{status:uncertain?'uncertain':'error',detail:error.message},uncertain);
    }else await stop(id,error.message).catch(()=>{});
  }finally{working=false;}
}
async function finish(id,itemId,result,pause=false){
  const c=await mutate(s=>{
    const c=getCampaign(s,id),item=c.items.find(i=>i.id===itemId);if(!item)return null;
    Object.assign(item,result,{finishedAt:Date.now()});item.history.push({event:result.status,at:Date.now(),detail:result.detail});
    if(c.status==='running'){
      if(pause){c.status='paused';c.reason='Resultado incerto. Confira a conversa antes de reenviar.';c.nextAt=null;}
      else if(c.items.some(i=>i.status==='pending'))c.nextAt=Date.now()+delayMs(c.min,c.max);
      else {c.status='completed';c.reason='Processamento finalizado. Veja os resultados individuais.';c.nextAt=null;}
    }
    return structuredClone(c);
  });
  if(c)await schedule(c);
}
async function health(){
  await boot;for(const c of (await read()).campaigns.filter(c=>c.status==='running')){
    try {const t=await chrome.tabs.get(c.tabId);if(t.discarded||!t.url?.startsWith('https://web.whatsapp.com/'))throw Error('Aba fechada, suspensa ou navegou para outra página.');const r=await page(c.tabId,'ready');if(!r.ready)throw Error('WhatsApp desconectado.');if(c.nextAt&&c.nextAt<=Date.now())await tick(c.id);}
    catch(e){await stop(c.id,e.message);}
  }
}
async function handle(m){
  await boot;
  if(m.action==='state')return read();
  if(m.action==='connect')return connect();
  if(m.action==='extract'){
    if(!['groups','groupLink','participants','contacts','resolve'].includes(m.kind))throw Error('Extração inválida.');
    const tab=await chrome.tabs.get(m.tabId);
    if(!tab.url?.startsWith('https://web.whatsapp.com/'))throw Error('Aba do WhatsApp indisponível.');
    const r=await timeout(chrome.scripting.executeScript({target:{tabId:m.tabId},world:'MAIN',func:extractPage,args:[m.kind,m.options||{}]}),90000);
    if(!r?.[0]||r[0].error)throw Error(r?.[0]?.error?.message||'Falha na extração.');return r[0].result;
  }
  if(m.action==='detach')return chrome.windows.create({url:chrome.runtime.getURL('index.html'),type:'popup',width:1200,height:850});
  if(m.action==='tab')return chrome.tabs.create({url:chrome.runtime.getURL('index.html')});
  if(m.action==='save'){
    validateConfig(m.config);
    return mutate(s=>{
      let c=m.id?getCampaign(s,m.id):null;
      if(c&&(c.status==='running'||c.items.some(i=>['processing','sending'].includes(i.status))))throw Error('Pause e aguarde a operação atual para editar.');
      if(c&&['completed','cancelled'].includes(c.status))throw Error('Campanha encerrada. Crie uma nova campanha.');
      if(!c){if(!m.items?.some(i=>i.status==='pending'))throw Error('Importe pelo menos um destino válido.');c={id:crypto.randomUUID(),createdAt:Date.now(),status:'draft',items:m.items,sessionAttempts:0,nextAt:null};s.campaigns.unshift(c);}
      const {name,type,mode,text,invite,min,max,daily,batch,interactive}=m.config;
      if(c.items.length&&c.type&&c.type!==type)throw Error('O tipo dos destinatários não pode ser alterado.');
      Object.assign(c,{name:name.trim(),type,mode,text,invite,min,max,daily,batch,interactive,updatedAt:Date.now()});return c.id;
    });
  }
  if(m.action==='start'){
    if(working)throw Error('Aguarde a operação atual terminar.');
    const connection=await connect();
    const c=await mutate(s=>{
      if(s.campaigns.some(c=>c.status==='running'))throw Error('Pause a campanha em andamento antes de iniciar outra.');
      const c=getCampaign(s,m.id);validateConfig(c);
      if(['cancelled','completed'].includes(c.status))throw Error('Campanha encerrada.');
      if(!c.items.some(i=>i.status==='pending'))throw Error('Não há destinos pendentes.');
      if(c.items.some(i=>['sending','processing'].includes(i.status)))throw Error('Operação anterior ainda pendente.');
      if(c.account&&c.account!==connection.account)throw Error('Esta campanha pertence a outra conta do WhatsApp.');
      c.account=connection.account;c.status='running';c.reason='';c.tabId=connection.tabId;c.token=crypto.randomUUID();c.sessionAttempts=0;c.nextAt=Date.now()+delayMs(c.min,c.max);return structuredClone(c);
    });await schedule(c);return c.id;
  }
  if(m.action==='pause')return stop(m.id,'Pausada por você.');
  if(m.action==='cancel')return stop(m.id,'Cancelada por você. Envios já iniciados não podem ser desfeitos.','cancelled');
  if(m.action==='delete')return mutate(s=>{const c=getCampaign(s,m.id);if(c.status==='running'||c.items.some(i=>['sending','processing'].includes(i.status)))throw Error('Pause e aguarde a operação atual antes de excluir.');s.campaigns=s.campaigns.filter(c=>c.id!==m.id);});
  if(m.action==='resolve')return mutate(s=>{
    const c=getCampaign(s,m.id);if(['running','cancelled'].includes(c.status)||c.items.some(i=>['sending','processing'].includes(i.status)))throw Error('Pause e aguarde antes de alterar resultados.');
    const i=c.items.find(i=>i.id===m.itemId);if(!i||!['uncertain','error','approval'].includes(i.status))throw Error('Resultado não pode ser alterado.');
    if(!['pending','sent','skipped'].includes(m.status))throw Error('Status inválido.');
    i.status=m.status;i.detail='Decisão manual: '+m.status;i.history.push({event:'manual',at:Date.now(),status:m.status});c.status='paused';c.nextAt=null;
  });
  if(m.action==='block')return mutate(s=>{s.blocked=[...new Set(m.targets.map(String).map(s=>s.trim()).filter(Boolean))];});
  throw Error('Comando desconhecido.');
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return false;
  handle(m).then(data=>reply({ok:true,data})).catch(e=>reply({ok:false,error:e.message}));return true;
});
chrome.alarms.onAlarm.addListener(a=>{(a.name==='health'?health():a.name.startsWith('run:')?tick(a.name.slice(4)):Promise.resolve()).catch(console.error);});
chrome.tabs.onRemoved.addListener(tabId=>{boot.then(async()=>{for(const c of (await read()).campaigns)if(c.tabId===tabId&&c.status==='running')await stop(c.id,'Aba do WhatsApp fechada.');}).catch(console.error);});
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='loading'||change.discarded)boot.then(async()=>{for(const c of (await read()).campaigns)if(c.tabId===tabId&&c.status==='running')await stop(c.id,'WhatsApp recarregado ou aba suspensa. Retome manualmente.');}).catch(console.error);});
chrome.runtime.onStartup.addListener(()=>{boot.then(async()=>{for(const c of (await read()).campaigns)if(c.status==='running')await stop(c.id,'Chrome reiniciado. Retome manualmente.');}).catch(console.error);});
export {handle,tick,boot};
