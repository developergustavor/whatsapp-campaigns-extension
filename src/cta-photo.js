/* Runs in MAIN world. Hooks are scoped by the outgoing message ID, never by
 * a global 'currently sending' flag. Ordinary photos and other messages pass through. */
(()=>{
 const root=window.__campanhasWA ||= {tokens:{},busy:false};
 if(root.photoCtaVersion===1)return;
 const W=window.WPP,pending=new Map(),owned=new WeakMap();
 let installed=false;
 const key=x=>x?.toString?.()||'';
 const validUrl=url=>{try{return typeof url==='string'&&url===url.trim()&&/^https:\/\//.test(url)&&new URL(url).protocol==='https:';}catch{return false;}};
 function install(){
  if(installed)return;
  if(!W?.isFullReady)throw Error('WA-JS ainda não está completamente carregado.');
  const names=['createMsgProtobuf','createFanoutMsgStanza'];
  const modules=names.map(name=>{
   const fn=W.whatsapp.functions[name],id=W.whatsapp._moduleIdMap.get(fn);
   const module=id&&W.loader.loadModule(id);
   if(!module||typeof module[name]!=='function')throw Error(`Hook ${name} indisponível.`);
   const descriptor=Object.getOwnPropertyDescriptor(module,name);
   if(!descriptor?.writable)throw Error(`Hook ${name} não permite alteração.`);
   return {name,module,original:module[name]};
  });
  const proto=modules[0],fanout=modules[1];
  const protoWrapper=function(...args){
   const job=pending.get(key(args[0]?.id));
   if(!job)return proto.original.apply(this,args);
   // No buttons/template options are supplied to sendFileMessage. Its original
   // media flow produces the fully uploaded imageMessage before this conversion.
   const raw=proto.original.apply(this,args),img=raw?.imageMessage;
   for(const field of ['url','directPath','mediaKey','fileEncSha256','fileSha256','fileLength','jpegThumbnail'])
    if(img?.[field]==null||img[field]==='')throw Error(`CTA: imagem enviada incompleta (${field}).`);
   if(img.mimetype!=='image/jpeg')throw Error('CTA: a imagem preparada não é JPEG.');
   const message={interactiveMessage:{header:{title:'',hasMediaAttachment:true,imageMessage:img},body:{text:job.text||' '},footer:{text:job.footer||''},nativeFlowMessage:{messageVersion:1,buttons:job.buttons.map(b=>({name:'cta_url',buttonParamsJson:JSON.stringify({display_text:b.text,url:b.url,merchant_url:b.url})}))}}};
   owned.set(message,job);job.protobufBuilt=true;return message;
  };
  const fanoutWrapper=async function(...args){
   const named=args.length===1&&args[0]?.msgProtobuf!==undefined?args[0]:null;
   const message=named?.msgProtobuf||(args[1]?.id?args[2]:args[1]);
   if(!message||!owned.has(message))return fanout.original.apply(this,args);
   // This returns the built stanza; transport encoding/sending follows it.
   const result=await fanout.original.apply(this,args),node=result?.stanza||result;
   if(node?.tag!=='message'||!Array.isArray(node.content))throw Error('CTA: estrutura da stanza não reconhecida.');
   if(node.content.some(n=>n.tag==='bot'))throw Error('CTA: stanza inesperada com nó bot; envio interrompido.');
   const bizNodes=node.content.filter(n=>n.tag==='biz');
   if(bizNodes.length>1)throw Error('CTA: stanza com múltiplos nós biz.');
   let biz=bizNodes[0];
   if(!biz){biz={tag:'biz',attrs:{},content:[]};node.content.push(biz);}
   if(biz.content==null)biz.content=[];
   if(!Array.isArray(biz.content))throw Error('CTA: conteúdo biz incompatível.');
   biz.content=biz.content.filter(n=>n.tag!=='interactive');
   biz.content.push({tag:'interactive',attrs:{type:'native_flow',v:'1'},content:[{tag:'native_flow',attrs:{v:'9',name:'mixed'},content:null}]});
   owned.get(message).stanzaBuilt=true;
   return result;
  };
  try{proto.module[proto.name]=protoWrapper;fanout.module[fanout.name]=fanoutWrapper;installed=true;}
  catch(error){proto.module[proto.name]=proto.original;fanout.module[fanout.name]=fanout.original;throw error;}
 }
 root.sendPhotoCta=async(data,opts,active)=>{
  const x=data.interactive||{},buttons=(x.buttons||[]).filter(b=>validUrl(b.url)&&b.text?.trim()).slice(0,3);
  if(!/^data:image\/jpeg;base64,/.test(x.image||''))throw Error('Selecione uma foto JPEG para o CTA e salve a campanha.');
  const fallbackText=[data.text||' ',...buttons.map(b=>b.url)].join('\n');
  const fallback=async reason=>{
   if(!active())throw Error('Campanha pausada antes do fallback.');
   const result=await W.chat.sendFileMessage(data.target,x.image,{...opts,type:'image',mimetype:'image/jpeg',filename:'campanha.jpg',caption:fallbackText});
   return {...result,deliveryFormat:'photo_link',detail:`Foto comum com link (fallback): ${reason}`};
  };
  if(!buttons.length)return fallback('nenhum botão com URL HTTPS válida');
  try{install();}catch(error){return fallback(error.message);}
  const id=await W.chat.generateMessageID(data.target),idString=key(id);
  const job={text:data.text,footer:x.footer,buttons,protobufBuilt:false,stanzaBuilt:false};
  pending.set(idString,job);
  try{
   if(!active())throw Error('Campanha pausada antes do envio.');
   const result=await W.chat.sendFileMessage(data.target,x.image,{...opts,type:'image',mimetype:'image/jpeg',filename:'campanha.jpg',caption:data.text||' ',messageId:id});
   // An ACK alone does not prove that the hook was reached or the CTA renders.
   if(!job.protobufBuilt||!job.stanzaBuilt)throw Error('CTA: pipeline não confirmou protobuf e stanza. Confira o grupo; resultado incerto.');
   if(result.ack<0)return fallback('rejeição confirmada pelo WhatsApp');
   return {...result,deliveryFormat:'photo_cta',detail:'CTA enviado com foto e native_flow mixed; renderização precisa ser conferida nos aparelhos.'};
  }catch(error){
   // Only an explicit server rejection permits an automatic second transmission.
   // Transport exceptions/timeouts are ambiguous and must never silently retry.
   if(Number(error?.status)===405||Number(error?.statusCode)===405)return fallback('servidor rejeitou o interativo (405)');
   throw error;
  }finally{pending.delete(idString);}
 };
 root.photoCtaVersion=1;
})();
