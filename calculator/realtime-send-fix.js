(()=>{
if(!window.supabase?.createClient)return;
const originalCreate=window.supabase.createClient.bind(window.supabase);
window.supabase.createClient=(...args)=>{
  const client=originalCreate(...args);
  const originalChannel=client.channel.bind(client);
  client.channel=(topic,opts)=>{
    const ch=originalChannel(topic,opts);
    ch.httpSend=async(event,payload)=>{
      let subscribed=false;
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Realtime subscribe timeout')),5000);
        ch.subscribe(status=>{
          if(status==='SUBSCRIBED'){
            subscribed=true;
            clearTimeout(timer);
            resolve();
          }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
            clearTimeout(timer);
            reject(new Error('Realtime channel '+status));
          }
        });
      });
      if(!subscribed)throw new Error('Realtime channel not ready');
      const result=await ch.send({type:'broadcast',event,payload});
      if(result!=='ok')throw new Error('Realtime send failed: '+String(result));
      await new Promise(r=>setTimeout(r,120));
      return {status:'ok'};
    };
    return ch;
  };
  return client;
};
})();