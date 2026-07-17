
(function(){
  const PAGES={
    'add.html':{label:'TODAY’S SHOPPING',title:'',subtitle:'Let’s save on groceries today.',status:'home',icon:'basket',home:true},
    'list.html':{label:'YOUR LIST',title:'My List',subtitle:'Everything you’re planning to buy today.',status:'Review your list before comparing prices.',icon:'list'},
    'stores.html':{label:'SHOPPING PLAN',title:'Best Prices Today',subtitle:'We’ve already compared nearby stores for you.',status:'Here’s today’s strongest recommendation.',icon:'store'},
    'plans.html':{label:'RECOMMENDATION',title:'Your Best Shopping Plan',subtitle:'The best balance of price, time, and convenience.',status:'Review the recommendation, then choose your route.',icon:'trophy'},
    'route.html':{label:'READY TO SHOP',title:'Start Your Trip',subtitle:'Follow your recommended shopping route.',status:'Everything is ready before you leave.',icon:'route'},
    'receipts.html':{label:'PREVIOUS TRIPS',title:'Shopping History',subtitle:'Review your previous grocery trips.',status:'Open any receipt to see its itemized copy.',icon:'receipt'},
    'savings.html':{label:'YOUR SAVINGS',title:'My Savings',subtitle:'See how much you’ve saved over time.',status:'Every grocery trip counts.',icon:'wallet'},
    'profile.html':{label:'ACCOUNT',title:'Your Account',subtitle:'Manage your budget and preferences.',status:'Everything for your shopping in one place.',icon:'user'}
  };
  const icons={
    basket:'<path d="M5 9h14l-1.2 11H6.2z"/><path d="m8 9 4-5 4 5M9 13v3M12 13v3M15 13v3"/>',
    list:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h4"/><path d="M7.5 8h.01M7.5 12h.01M7.5 16h.01"/>',
    store:'<path d="M4 9h16v11H4z"/><path d="M3 9h18l-2-5H5zM8 20v-6h8v6"/><path d="M7 9v2a2 2 0 0 0 4 0V9M11 9v2a2 2 0 0 0 4 0V9M15 9v2a2 2 0 0 0 4 0V9"/>',
    trophy:'<path d="M8 4h8v4c0 4-1.7 6-4 6s-4-2-4-6z"/><path d="M8 6H5v2c0 2 1.2 3 3 3M16 6h3v2c0 2-1.2 3-3 3M12 14v4M8 21h8M10 18h4"/>',
    route:'<path d="M5 19c3-5 5-1 8-6s4-2 6-8"/><circle cx="5" cy="19" r="2"/><path d="M19 3c-2 0-3 1.4-3 3 0 2.2 3 5 3 5s3-2.8 3-5c0-1.6-1-3-3-3z"/>',
    receipt:'<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    wallet:'<path d="M4 7h15a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2z"/><path d="M4 8V6a2 2 0 0 1 2-2h11v3M15 12h6v4h-6a2 2 0 0 1 0-4z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.4 3.2-6.7 7.5-6.7s6.8 2.3 7.5 6.7"/>'
  };
  function file(){return location.pathname.split('/').pop()||'index.html'}
  function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'}
  function name(){return (localStorage.getItem('groceryProfileName')||localStorage.getItem('budgetProfileName')||localStorage.getItem('profileName')||'there').trim()}
  function homeStatus(){
    const budget=Number(localStorage.getItem('monthlyGroceryBudget')||0);
    let spent=0;
    try{const receipts=JSON.parse(localStorage.getItem('groceryReceipts')||localStorage.getItem('receipts')||'[]');if(Array.isArray(receipts))spent=receipts.reduce((s,r)=>s+Number(r.totalSpent||r.total||0),0)}catch(_){ }
    if(budget>0)return `Monthly budget: $${Math.max(0,budget-spent).toFixed(0)} remaining`;
    let count=0;try{const list=JSON.parse(localStorage.getItem('checkedGroceryItems')||localStorage.getItem('groceryList')||'[]');if(Array.isArray(list))count=list.length}catch(_){ }
    return count?`${count} item${count===1?'':'s'} ready to compare`:'Build your first grocery list in under a minute';
  }
  function render(){
    const cfg=PAGES[file()];if(!cfg)return;
    const old=document.querySelector('.app > header');if(!old)return;
    const title=cfg.home?`${greeting()}, ${name()} 👋`:cfg.title;
    const status=cfg.home?homeStatus():cfg.status;
    old.innerHTML=`<div class="sulit-page-header ${cfg.home?'sulit-home-header':''}"><div class="sulit-header-copy">${cfg.home?'<div class="sulit-home-brand">Sulit 🍁</div>':`<small class="sulit-header-label">${cfg.label}</small>`}<h1 class="${cfg.home?'sulit-home-greeting':''}">${title}</h1><p>${cfg.subtitle}</p><div class="sulit-header-status">${status}</div></div></div>`;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();
