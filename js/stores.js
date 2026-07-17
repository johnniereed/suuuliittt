function calculateStoreBasket(storeId) {
  const groceryList=getList(); let total=0,foundItems=0;
  const rows=groceryList.map(item=>{
    const product=productById(item.productId); const savedPrice=priceFor(item.productId,storeId);
    if(savedPrice){const itemTotal=savedPrice.price*item.quantity;total+=itemTotal;foundItems++;return{product,productName:product?.name||"Unknown",quantity:item.quantity,unitPrice:savedPrice.price,itemTotal,hasPrice:true}}
    return{product,productName:product?.name||"Unknown",quantity:item.quantity,unitPrice:0,itemTotal:0,hasPrice:false};
  });
  return{total,foundItems,totalItems:groceryList.length,isComplete:foundItems===groceryList.length,rows};
}
function renderStores(){
  const list=getList();
  const host=document.getElementById("stores");
  if(!list.length){
    host.innerHTML='<a class="card empty empty-link" href="add.html"><strong>Your list is waiting.</strong><div class="muted" style="margin-top:6px">Add groceries to get today\'s best plan.</div></a>';
    return;
  }
  const sorted=getStores().map(store=>({store,basket:calculateStoreBasket(store.id)})).sort((a,b)=>{
    if(a.basket.isComplete&&!b.basket.isComplete)return-1;
    if(!a.basket.isComplete&&b.basket.isComplete)return 1;
    if(a.basket.foundItems===0&&b.basket.foundItems>0)return 1;
    if(b.basket.foundItems===0&&a.basket.foundItems>0)return-1;
    return a.basket.total-b.basket.total;
  });
  const recommended=sorted.find(result=>result.basket.isComplete)||sorted.find(result=>result.basket.foundItems>0)||null;
  if(!recommended){
    host.innerHTML='<div class="card empty"><strong>Waiting for price data</strong><div class="muted" style="margin-top:6px">No store has pricing for your list yet. Uploading receipts will help build local prices.</div></div>';
    return;
  }
  const complete=[...sorted].filter(result=>result.basket.isComplete);
  const highestComplete=complete.sort((a,b)=>b.basket.total-a.basket.total)[0];
  const potentialSavings=highestComplete?Math.max(0,highestComplete.basket.total-recommended.basket.total):0;
  const missing=Math.max(0,recommended.basket.totalItems-recommended.basket.foundItems);
  const hero=`<section class="consumer-recommendation-hero" role="button" tabindex="0" onclick="showStore(${recommended.store.id})" onkeydown="if(event.key==='Enter'||event.key===' '){showStore(${recommended.store.id})}">
    <small>Recommended today</small>
    <h2>${recommended.store.name}</h2>
    <p>${recommended.basket.isComplete?'Your complete grocery list is covered in one stop.':`${missing} product${missing===1?' is':'s are'} not priced here yet. We’ll still recommend the strongest available plan.`}</p>
    <div class="consumer-hero-metrics">
      <div><span>Estimated basket</span><strong>${money(recommended.basket.total)}</strong></div>
      <div><span>${potentialSavings>0?'Potential savings':'List coverage'}</span><strong>${potentialSavings>0?money(potentialSavings):`${recommended.basket.foundItems}/${recommended.basket.totalItems}`}</strong></div>
    </div>
    <button class="consumer-hero-button">See why →</button>
  </section>`;
  const alternatives=sorted.filter(result=>result!==recommended).map((result,index)=>{
    const difference=result.basket.foundItems>0?Math.max(0,result.basket.total-recommended.basket.total):0;
    const missingCount=Math.max(0,result.basket.totalItems-result.basket.foundItems);
    const coverage=result.basket.isComplete?'Complete list':result.basket.foundItems===0?'Waiting for price data':`${missingCount} product${missingCount===1?'':'s'} unavailable`;
    return `<article class="store-card" onclick="showStore(${result.store.id})" style="--store-color:${result.store.color||'#2ca43b'}">
      <div class="store-card-top">
        <div class="store-rank">${index+2}</div>
        <div class="store-logo">${storeLogo(result.store)}</div>
        <div class="store-copy"><strong>${result.store.name}</strong><div class="store-status">${coverage}</div><div class="store-difference">${result.basket.foundItems===0?'See details →':difference>0?`${money(difference)} more than the recommendation`:'See details →'}</div></div>
        <div class="store-price"><div class="price">${result.basket.foundItems>0?money(result.basket.total):'Not available'}</div></div>
      </div>
    </article>`;
  }).join('');
  host.innerHTML=`${hero}<div class="store-ranking-label">Other options</div>${alternatives||'<div class="card muted">No other priced stores yet.</div>'}`;
}
function storeFreshnessLabel(storeId,basket){
  const priced=basket.rows.filter(row=>row.hasPrice);
  if(!priced.length)return 'Price verification pending';
  const dates=priced.map(row=>{
    const record=getPrices().find(price=>Number(price.productId)===Number(row.product?.id)&&Number(price.storeId)===Number(storeId));
    return record?.verifiedAt||record?.updatedAt||record?.createdAt||'';
  }).filter(Boolean).map(value=>new Date(value)).filter(date=>!Number.isNaN(date.getTime()));
  if(!dates.length)return 'Price verification pending';
  const newest=new Date(Math.max(...dates.map(date=>date.getTime())));
  const days=Math.max(0,Math.floor((Date.now()-newest.getTime())/86400000));
  if(days===0)return 'Verified today';
  if(days===1)return 'Verified yesterday';
  return `Verified ${days} days ago`;
}
function storeBasketTax(basket){
  return basket.rows.reduce((total,row)=>{
    if(!row.hasPrice)return total;
    const rate=window.SulitLaunch?.taxRate?Number(SulitLaunch.taxRate(row.product)||0):0;
    return total+(Number(row.itemTotal||0)*rate);
  },0);
}
function categoryName(product){
  return String(product?.category||'Other').trim()||'Other';
}
function showStore(id){
  setSelectedStore(id);
  const store=storeById(id),basket=calculateStoreBasket(id);
  const allResults=getStores().map(item=>({store:item,basket:calculateStoreBasket(item.id)})).filter(row=>row.basket.foundItems>0);
  const cheapest=allResults.sort((a,b)=>a.basket.total-b.basket.total)[0];
  const isCheapest=Number(cheapest?.store?.id)===Number(id);
  const estimatedTax=storeBasketTax(basket);
  const estimatedCheckout=Number(basket.total||0)+estimatedTax;
  const freshness=storeFreshnessLabel(id,basket);
  const grouped=basket.rows.reduce((map,row)=>{
    const key=categoryName(row.product);
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(row);
    return map;
  },new Map());
  const categorySections=[...grouped.entries()].map(([category,rows],index)=>`
    <details class="basket-category" ${index===0?'open':''}>
      <summary><span>${category}</span><span>${rows.length} item${rows.length===1?'':'s'}</span></summary>
      <div class="basket-category-items">
        ${rows.map(row=>`<div class="basket-line"><div class="basket-line-main"><div class="list-product-logo">${productIcon(row.product)}</div><div><strong>${row.productName}</strong><small>Quantity ${row.quantity}</small></div></div><div class="basket-line-price">${row.hasPrice?`<strong>${money(row.itemTotal)}</strong><small>${money(row.unitPrice)} each</small>`:'<strong class="unavailable-text">Unavailable</strong>'}</div></div>`).join('')}
      </div>
    </details>`).join('');
  const reasons=[
    isCheapest?'Lowest known basket total':'Competitive basket total',
    basket.isComplete?'Complete shopping list':`${basket.foundItems} of ${basket.totalItems} items priced`,
    freshness
  ];
  document.getElementById("storeDetails").innerHTML=`
    <section class="store-summary-screen">
      <div class="store-summary-hero">
        <div class="store-summary-identity"><div class="store-logo">${storeLogo(store)}</div><div><span class="store-summary-label">Why this recommendation</span><h2>${store.name}</h2><p>${basket.isComplete?'Everything on your list is covered.':'Review the items currently available here.'}</p></div></div>
        <div class="store-checkout"><small>Estimated checkout</small><strong>${basket.foundItems?money(estimatedCheckout):'Not available yet'}</strong><span>${basket.foundItems}/${basket.totalItems} items</span></div>
      </div>
      <div class="store-reason-panel"><h3>Why it stands out</h3>${reasons.map(reason=>`<div><span class="reason-check">✓</span><span>${reason}</span></div>`).join('')}</div>
      <div class="store-cost-summary"><div><span>Products</span><strong>${money(basket.total)}</strong></div><div><span>Estimated tax</span><strong>${money(estimatedTax)}</strong></div><div class="store-cost-total"><span>Estimated checkout</span><strong>${money(estimatedCheckout)}</strong></div></div>
      <div class="store-basket-heading"><div><span class="store-summary-label">Your basket</span><h3>Items at ${store.name}</h3></div><span>${basket.foundItems}/${basket.totalItems}</span></div>
      <div class="store-basket-groups">${categorySections}</div>
      ${!basket.isComplete?`<div class="store-missing-note"><strong>${basket.totalItems-basket.foundItems} item${basket.totalItems-basket.foundItems===1?' is':'s are'} not priced here yet.</strong><span>Your Shopping Plan will account for missing products.</span></div>`:''}
      ${basket.foundItems>0?`<a class="button store-primary-action" href="plans.html">Create Shopping Plan</a>`:`<a class="button secondary store-primary-action" href="stores.html">Choose another store</a>`}
    </section>`;
}

renderStores();


document.addEventListener("grocerysaver:catalog-updated",renderStores);
