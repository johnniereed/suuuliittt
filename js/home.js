function normalizeProductName(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizeUnit(value){return String(value||"").trim().toLowerCase()}

let pendingHomeSelection = null;

function variantsForSelection(name, unit = "") {
  const nameKey = normalizeProductName(name);
  const unitKey = normalizeUnit(unit);
  return getProducts().filter(product =>
    normalizeProductName(product.name) === nameKey &&
    (!unitKey || normalizeUnit(product.unit) === unitKey)
  );
}

function cheapestVariant(name, unit = "") {
  const variants = variantsForSelection(name, unit);
  return variants.slice().sort((a, b) => {
    const ap = lowestPrice(a.id)?.price ?? Number.POSITIVE_INFINITY;
    const bp = lowestPrice(b.id)?.price ?? Number.POSITIVE_INFINITY;
    return ap - bp;
  })[0] || null;
}

function listItemForSelection(name, unit = "") {
  const ids = new Set(variantsForSelection(name, unit).map(product => Number(product.id)));
  return getList().find(item => ids.has(Number(item.productId))) || null;
}

function searchTokens(value) {
  return normalizeProductName(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(token => token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token);
}

function matchingSelections(searchText) {
  const queryTokens = searchTokens(searchText);
  if (!queryTokens.length) return [];
  const groups = new Map();
  const aliasGroups = typeof getProductAliases === "function" ? getProductAliases() : [];
  getProducts().forEach(product => {
    const aliasText = (aliasGroups.find(group => Number(group.productId) === Number(product.id))?.aliases || []).join(" ");
    const searchableTokens = searchTokens(`${product.name} ${product.unit || ""} ${product.category || ""} ${product.brand || ""} ${aliasText}`);
    const searchableText = searchableTokens.join(" ");
    const matches = queryTokens.every(query =>
      searchableTokens.some(token => token.startsWith(query) || query.startsWith(token)) || searchableText.includes(query)
    );
    if (!matches) return;
    const key = `${normalizeProductName(product.name)}|${normalizeUnit(product.unit)}`;
    if (!groups.has(key)) groups.set(key, {name: product.name, unit: product.unit || ""});
  });
  return [...groups.values()].sort((a,b)=>{
    const qa=normalizeProductName(searchText);
    const aExact=normalizeProductName(a.name).startsWith(qa)?0:1;
    const bExact=normalizeProductName(b.name).startsWith(qa)?0:1;
    return aExact-bExact || a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit);
  }).slice(0,10);
}


function cleanCatalogDisplayName(name, unit){
  const raw=String(name||'').trim(); const u=String(unit||'').trim();
  if(!u) return raw;
  const esc=u.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return raw.replace(new RegExp('\\s*'+esc+'\\s*$','i'),'').trim()||raw;
}

function matchingNames(searchText){return matchingSelections(searchText).map(item=>item.name)}

function renderProducts(searchText) {
  const results = document.getElementById("results");
  const addButton = document.getElementById("searchAddButton");
  const selections = matchingSelections(searchText);
  document.getElementById("quantityEditor").innerHTML = "";
  addButton.classList.add("hidden");
  addButton.dataset.name = "";
  if (!normalizeProductName(searchText)) { results.innerHTML = ""; return; }
  results.innerHTML = selections.length ? selections.map(selection => {
    const product = cheapestVariant(selection.name, selection.unit);
    const existing = listItemForSelection(selection.name, selection.unit);
    return `<button type="button" class="phase1-search-result" onclick="selectHomeSearchResult('${encodeURIComponent(selection.name)}','${encodeURIComponent(selection.unit)}')">
      <span class="result-art">${productIcon(product)}</span>
      <span class="result-copy"><strong>${cleanCatalogDisplayName(selection.name, selection.unit)}</strong><small>${selection.unit || "Choose size"}${existing ? " · In your list" : ""}</small>${(()=>{const f=SulitLaunch.freshness(lowestPrice(product.id));return `<span class="freshness ${f.state}">${f.label}</span>`})()}</span>
      <span class="result-chevron">›</span>
    </button>`;
  }).join("") : `<div class="launch-request-card"><div class="not-found-icon">⌕</div><h3>We couldn’t find “${String(searchText).replace(/[<>]/g,'')}” yet</h3><p>Add it to Sulit with one tap. We’ll notify you when it becomes available.</p><button type="button" onclick="submitProductRequest()">Add “${String(searchText).replace(/[<>]/g,'')}” to Sulit</button></div>`;
}

function ensureHomeBrandSheet(){
  let sheet=document.getElementById('homeBrandSheet');
  if(sheet)return sheet;
  sheet=document.createElement('div');
  sheet.id='homeBrandSheet';
  sheet.className='brand-sheet';
  sheet.innerHTML='<div class="brand-sheet-card" role="dialog" aria-modal="true"><div class="brand-sheet-handle"></div><div id="homeBrandSheetContent"></div></div>';
  sheet.addEventListener('click',event=>{if(event.target===sheet)closeHomeBrandSheet()});
  document.body.appendChild(sheet);
  return sheet;
}
function closeHomeBrandSheet(){const sheet=document.getElementById('homeBrandSheet');if(sheet)sheet.classList.remove('show')}

function selectHomeSearchResult(encodedName, encodedUnit = "") {
  const name = decodeURIComponent(encodedName);
  const unit = decodeURIComponent(encodedUnit || "");
  const variants = variantsForSelection(name, unit).slice().sort((a,b)=>(lowestPrice(a.id)?.price??Infinity)-(lowestPrice(b.id)?.price??Infinity));
  if(!variants.length)return;
  const current=listItemForSelection(name,unit);
  pendingHomeSelection={name,unit,productId:Number(current?.productId||variants[0].id),quantity:Number(current?.quantity||1)};
  const sheet=ensureHomeBrandSheet();
  const content=document.getElementById('homeBrandSheetContent');
  content.innerHTML=`<div class="brand-sheet-head"><div><h2>Choose brand</h2><div class="muted">${name} · ${unit}</div></div><button class="brand-sheet-close" type="button" onclick="closeHomeBrandSheet()">×</button></div>
  <p class="brand-sheet-intro">We’ll show the cheapest option first.</p>
  <div>${variants.map(v=>{const p=lowestPrice(v.id),store=p?storeById(p.storeId):null;return `<button type="button" class="brand-choice ${Number(v.id)===pendingHomeSelection.productId?'selected':''}" onclick="chooseHomeBrand(${v.id},this)"><span class="brand-choice-main"><span class="brand-choice-logo">${productIcon(v)}</span><span><strong>${v.brand||'No Brand'}</strong><small>${store?store.name:'No store price'}</small></span></span><span class="brand-choice-price"><strong>${p?money(p.price):'—'}</strong><span class="brand-radio"></span></span></button>`}).join('')}</div>
  <div class="brand-sheet-quantity"><span>Quantity</span><div class="quantity-control"><button type="button" onclick="changeHomeSheetQuantity(-1)">−</button><b id="homeSheetQuantity">${pendingHomeSelection.quantity}</b><button type="button" onclick="changeHomeSheetQuantity(1)">+</button></div></div>
  <button class="brand-sheet-add" type="button" onclick="confirmHomeSelection()">Add to list</button>`;
  requestAnimationFrame(()=>sheet.classList.add('show'));
}
function chooseHomeBrand(productId,button){pendingHomeSelection.productId=Number(productId);document.querySelectorAll('#homeBrandSheet .brand-choice').forEach(el=>el.classList.remove('selected'));if(button)button.classList.add('selected')}
function changeHomeSheetQuantity(change){if(!pendingHomeSelection)return;pendingHomeSelection.quantity=Math.max(1,pendingHomeSelection.quantity+change);const q=document.getElementById('homeSheetQuantity');if(q)q.textContent=pendingHomeSelection.quantity}
function confirmHomeSelection(){
  if(!pendingHomeSelection)return;
  const list=getList();
  const ids=new Set(variantsForSelection(pendingHomeSelection.name,pendingHomeSelection.unit).map(p=>Number(p.id)));
  const index=list.findIndex(item=>ids.has(Number(item.productId)));
  const item={productId:Number(pendingHomeSelection.productId),quantity:Number(pendingHomeSelection.quantity)};
  if(index>=0)list[index]=item;else list.push(item);
  saveList(list);localStorage.removeItem('selectedPlan');
  closeHomeBrandSheet();
  const search=document.getElementById('search');search.value='';document.getElementById('results').innerHTML='';
  updateItemCount();showAddedToast(pendingHomeSelection.name,pendingHomeSelection.unit);pendingHomeSelection=null;
}
function showAddedToast(name,unit){let toast=document.getElementById('phase1Toast');if(!toast){toast=document.createElement('div');toast.id='phase1Toast';toast.className='phase1-toast';document.body.appendChild(toast)}toast.innerHTML=`<span>✓</span><div><strong>Added to your list</strong><small>${name}${unit?' · '+unit:''}</small></div>`;toast.classList.add('show');clearTimeout(window.__phase1ToastTimer);window.__phase1ToastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}

function startHomeQuantity(name){const first=matchingSelections(name)[0];if(first)selectHomeSearchResult(encodeURIComponent(first.name),encodeURIComponent(first.unit))}
function renderQuantityEditor(){}
function changePendingHomeQuantity(){}
function finishHomeAdd(){}

function updateItemCount() {
  const count = getList().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const label = document.getElementById("itemCountLabel");
  if (label) label.textContent = `${count} ${count === 1 ? "item" : "items"} on the list`;
}

const searchInput = document.getElementById("search");
const searchAddButton = document.getElementById("searchAddButton");
searchInput.addEventListener("input", event => renderProducts(event.target.value));
searchAddButton.addEventListener("click",()=>{});
updateItemCount();
document.addEventListener("grocerysaver:catalog-updated", () => {renderProducts(searchInput?.value || "");updateItemCount();});

async function submitProductRequest(){
  const query=document.getElementById('search')?.value||'';
  if(!query.trim())return;
  const button=document.querySelector('.launch-request-card button');
  if(button){button.disabled=true;button.textContent='Adding request…'}
  await SulitLaunch.requestProduct(query);
  const results=document.getElementById('results');
  results.innerHTML=`<div class="launch-request-card"><div style="font-size:34px">✓</div><h3>Added to Sulit</h3><p>We’ll notify you when “${query.replace(/[<>]/g,'')}” is available.</p></div>`;
}
