(function(){
  const REQUESTS_KEY='sulitProductRequests';
  const NOTIFICATIONS_KEY='sulitNotifications';
  const WEEKLY_KEY='sulitWeeklyList';

  const clean=v=>String(v||'').trim();
  const normalize=v=>clean(v).toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  const read=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));

  window.SulitLaunch={
    getRequests(){return read(REQUESTS_KEY,[])},
    async requestProduct(query){
      const label=clean(query); if(!label)return null;
      const key=normalize(label); const userId=typeof getCurrentUserId==='function'?getCurrentUserId():'local';
      const requests=read(REQUESTS_KEY,[]); let item=requests.find(r=>r.key===key&&r.status!=='fulfilled');
      if(!item){item={id:(crypto.randomUUID?crypto.randomUUID():`request-${Date.now()}`),key,query:label,status:'pending',searchCount:0,userIds:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};requests.push(item)}
      item.searchCount=Number(item.searchCount||0)+1;
      if(!item.userIds.includes(userId))item.userIds.push(userId);
      item.updatedAt=new Date().toISOString(); write(REQUESTS_KEY,requests);
      try{
        const client=window.CloudSync?.getClient?.(); const user=await window.CloudSync?.ensureCustomerSession?.();
        if(client&&user){await client.from('product_requests').upsert({normalized_query:key,display_query:label,user_id:user.id,status:'pending',updated_at:new Date().toISOString()},{onConflict:'normalized_query,user_id'});}
      }catch(err){console.info('Product request saved locally; cloud table may not be installed yet.',err?.message||err)}
      return item;
    },
    async loadCloudRequests(){
      try{const client=window.CloudSync?.getClient?.();if(!client)return [];const result=await client.from('product_requests').select('*').eq('status','pending').order('updated_at',{ascending:false});if(result.error)throw result.error;return result.data||[]}catch(err){console.info('Cloud demand queue unavailable.',err?.message||err);return []}
    },
    async fulfillCloudQuery(normalizedQuery,productId,productName){
      try{const client=window.CloudSync?.getClient?.();if(!client)return false;const pending=await client.from('product_requests').select('id,user_id').eq('normalized_query',normalizedQuery).eq('status','pending');if(pending.error)throw pending.error;const update=await client.from('product_requests').update({status:'fulfilled',fulfilled_product_id:productId||null,updated_at:new Date().toISOString()}).eq('normalized_query',normalizedQuery).eq('status','pending');if(update.error)throw update.error;const rows=(pending.data||[]).map(r=>({user_id:r.user_id,title:`${productName} is now available`,message:'You can add it to your grocery list now.',request_query:normalizedQuery}));if(rows.length){const notes=await client.from('notifications').insert(rows);if(notes.error)throw notes.error}return true}catch(err){console.info('Cloud request fulfillment unavailable.',err?.message||err);return false}
    },
    async syncNotifications(){
      try{const client=window.CloudSync?.getClient?.();const user=await window.CloudSync?.ensureCustomerSession?.();if(!client||!user)return this.getNotifications();const result=await client.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false});if(result.error)throw result.error;const notes=(result.data||[]).map(r=>({id:r.id,title:r.title,message:r.message,read:Boolean(r.read_at),createdAt:r.created_at,requestKey:r.request_query}));write(NOTIFICATIONS_KEY,notes);return notes}catch(err){console.info('Cloud notifications unavailable.',err?.message||err);return this.getNotifications()}
    },
    fulfillRequest(id,productName){
      const requests=read(REQUESTS_KEY,[]); const req=requests.find(r=>r.id===id); if(!req)return;
      req.status='fulfilled'; req.fulfilledAt=new Date().toISOString(); req.productName=productName||req.query; write(REQUESTS_KEY,requests);
      const notifications=read(NOTIFICATIONS_KEY,[]); notifications.unshift({id:`note-${Date.now()}`,title:`${req.productName} is now available`,message:'You can add it to your grocery list now.',read:false,createdAt:new Date().toISOString(),requestKey:req.key}); write(NOTIFICATIONS_KEY,notifications);
    },
    getNotifications(){return read(NOTIFICATIONS_KEY,[])},
    unreadCount(){return read(NOTIFICATIONS_KEY,[]).filter(n=>!n.read).length},
    markNotificationsRead(){const n=read(NOTIFICATIONS_KEY,[]).map(x=>({...x,read:true}));write(NOTIFICATIONS_KEY,n)},
    saveWeeklyList(){const list=typeof getList==='function'?getList():[];write(WEEKLY_KEY,{items:list,savedAt:new Date().toISOString()});return list.length},
    getWeeklyList(){return read(WEEKLY_KEY,{items:[],savedAt:null})},
    useWeeklyList(){const weekly=this.getWeeklyList();if(!weekly.items?.length)return 0;if(typeof saveList==='function')saveList(weekly.items);localStorage.removeItem('selectedPlan');return weekly.items.length},
    taxRate(product){
      if(Number.isFinite(Number(product?.taxRate)))return Number(product.taxRate);
      const category=normalize(product?.category); const name=normalize(product?.name);
      const zeroRated=['dairy','bakery','fruit','fruits','meat','vegetable','vegetables','seafood','basic grocery'];
      if(zeroRated.some(v=>category.includes(v)))return 0;
      if(/milk|egg|bread|rice|flour|banana|apple|potato|onion|chicken|beef|fish/.test(name))return 0;
      return .05;
    },
    freshness(price){
      const raw=price?.checkedDate||price?.updatedAt; if(!raw)return {label:'Price not verified yet',days:null,state:'stale'};
      const date=new Date(raw); if(Number.isNaN(date.getTime()))return {label:'Price not verified yet',days:null,state:'stale'};
      const days=Math.max(0,Math.floor((Date.now()-date.getTime())/86400000));
      if(days===0)return {label:'Verified today',days,state:'fresh'};
      if(days===1)return {label:'Verified yesterday',days,state:'fresh'};
      return {label:`Verified ${days} days ago`,days,state:days<=4?'fresh':days<=10?'aging':'stale'};
    }
  };
})();
