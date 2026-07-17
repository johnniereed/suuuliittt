let preparedNavigationUrl = "";

function getSelectedTripPlan() {
  if (typeof getSelectedPlan === "function") {
    return getSelectedPlan();
  }

  return JSON.parse(
    localStorage.getItem("selectedPlan") || "null"
  );
}

function renderTripDetails() {
  const plan=getSelectedTripPlan();
  const container=document.getElementById("tripDetails");
  if(!plan||!Array.isArray(plan.storeIds)||!plan.storeIds.length){
    container.innerHTML=`<div class="card empty"><h2>No trip selected</h2><p class="muted">Choose a Shopping Plan first.</p><a class="button" href="plans.html">Return to Shopping Plan</a></div>`;
    return;
  }
  const storeNames=Array.isArray(plan.storeNames)?plan.storeNames:[];
  const basketTotal=Number(plan.basketTotal||0),estimatedTax=Number(plan.estimatedTax||0),gasCost=Number(plan.gasCost||0);
  const totalTrip=basketTotal+estimatedTax+gasCost;
  const stopsHtml=storeNames.map((name,index)=>`<div class="route-step"><span>${index+1}</span><div><strong>${name}</strong><small>${index===0?'First shopping stop':'Next shopping stop'}</small></div></div>`).join('');
  container.innerHTML=`
    <section class="start-shopping-screen">
      <div class="start-shopping-hero"><span class="start-kicker">${plan.title||'Shopping Plan'}</span><h2>Your best trip is ready.</h2><p>Review the plan, then open Google Maps when you’re ready to leave.</p></div>
      <div class="start-impact"><div><small>Estimated total</small><strong>${money(totalTrip)}</strong></div><div><small>Time</small><strong>${Number(plan.estimatedTime||0)} min</strong></div><div><small>Stops</small><strong>${storeNames.length}</strong></div></div>
      <div class="start-route-block"><div class="start-section-heading"><span>Your route</span><small>Road preview</small></div><div class="route-steps">${stopsHtml}</div><div id="routeMapPreview" class="route-map-preview"><div class="route-map-fallback">Finding the best road route…</div></div></div>
      <div class="start-cost-lines"><div><span>Groceries</span><strong>${money(basketTotal)}</strong></div><div><span>Estimated tax</span><strong>${money(estimatedTax)}</strong></div><div><span>Estimated gas</span><strong>${money(gasCost)}</strong></div><div class="start-cost-total"><span>Total trip estimate</span><strong>${money(totalTrip)}</strong></div></div>
      <div class="start-ready-message"><strong>You’re ready to go.</strong><span>Your selected stores will open in Google Maps in the right order.</span></div>
      <button id="startNavigationButton" type="button" onclick="startNavigating()">Start Your Trip</button>
    </section>`;
  renderRoutePreview(plan);
}

function showRouteMessage(text, type = "") {
  const message =
    document.getElementById("routeMessage");

  if (!message) return;

  message.innerHTML = `
    <div class="${type || "notice"}">
      ${text}
    </div>
  `;
}

async function startNavigating() {
  const plan = getSelectedTripPlan();

  if (
    !plan ||
    !Array.isArray(plan.storeIds) ||
    plan.storeIds.length === 0
  ) {
    showRouteMessage(
      "Choose a shopping plan first.",
      "error"
    );
    return;
  }

  if (!navigator.geolocation) {
    showRouteMessage(
      "Location is not supported on this device.",
      "error"
    );
    return;
  }

  const button =
    document.getElementById(
      "startNavigationButton"
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      "Preparing your trip…";
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      openGoogleMapsRoute(
        position,
        plan
      );
    },

    error => {
      if (button) {
        button.disabled = false;
        button.textContent =
          "Start Your Trip";
      }

      const messages = {
        1: "Please allow location access in Safari or your browser settings.",
        2: "Your current location could not be determined.",
        3: "The location request timed out. Try again."
      };

      showRouteMessage(
        messages[error.code] ||
        "Location could not be accessed.",
        "error"
      );
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    }
  );
}

async function openGoogleMapsRoute(
  position,
  plan
) {
  const userLat =
    position.coords.latitude;

  const userLng =
    position.coords.longitude;

  const nearestBranches =
    plan.storeIds
      .map(chainId =>
        findNearestBranch(
          chainId,
          userLat,
          userLng
        )
      )
      .filter(Boolean);

  if (!nearestBranches.length) {
    showRouteMessage(
      "No nearby store branches were found.",
      "error"
    );

    resetNavigationButton();
    return;
  }

  const resolvedBranches =
    await Promise.all(
      nearestBranches.map(branch =>
        typeof resolveBranchCoordinates ===
        "function"
          ? resolveBranchCoordinates(branch)
          : Promise.resolve(branch)
      )
    );

  resolvedBranches.sort(
    (first, second) =>
      getDistance(
        userLat,
        userLng,
        first.lat,
        first.lng
      ) -
      getDistance(
        userLat,
        userLng,
        second.lat,
        second.lng
      )
  );

  const finalStore =
    resolvedBranches[
      resolvedBranches.length - 1
    ];

  const destination =
    typeof branchMapsDestination ===
    "function"
      ? branchMapsDestination(finalStore)
      : `${finalStore.chain}, ${finalStore.address}`;

  const waypoints =
    resolvedBranches
      .slice(0, -1)
      .map(branch =>
        typeof branchMapsDestination ===
        "function"
          ? branchMapsDestination(branch)
          : `${branch.chain}, ${branch.address}`
      )
      .join("|");

  let mapsUrl =
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${encodeURIComponent(
      `${userLat},${userLng}`
    )}` +
    `&destination=${encodeURIComponent(
      destination
    )}` +
    "&travelmode=driving" +
    "&dir_action=navigate";

  if (waypoints) {
    mapsUrl +=
      `&waypoints=${encodeURIComponent(
        waypoints
      )}`;
  }

  localStorage.setItem(
    "shoppingSessionActive",
    "true"
  );

  localStorage.setItem(
    "shoppingReturnPromptPending",
    "true"
  );

  localStorage.setItem(
    "shoppingNavigationStartedAt",
    String(Date.now())
  );

  const mapsWindow = window.open(
    mapsUrl,
    "_blank"
  );

  if (!mapsWindow) {
    showRouteMessage(
      "Please allow pop-ups so navigation can open.",
      "error"
    );
  }

  resetNavigationButton();
}

function resetNavigationButton() {
  const button =
    document.getElementById(
      "startNavigationButton"
    );

  if (!button) return;

  button.disabled = false;
  button.textContent =
    "Start Your Trip";
}

renderTripDetails();


function checkForShoppingReturn() {
  const pending =
    localStorage.getItem(
      "shoppingReturnPromptPending"
    ) === "true";

  const startedAt = Number(
    localStorage.getItem(
      "shoppingNavigationStartedAt"
    ) || 0
  );

  const enoughTimePassed =
    Date.now() - startedAt > 1500;

  if (!pending || !enoughTimePassed) {
    return;
  }

  const modal =
    document.getElementById(
      "shoppingReturnModal"
    );

  if (modal) {
    modal.classList.add("show");
  }
}

function continueShopping() {
  localStorage.setItem(
    "shoppingReturnPromptPending",
    "false"
  );

  document
    .getElementById("shoppingReturnModal")
    ?.classList.remove("show");

  window.location.href =
    "list.html?shopping=1";
}

function finishShopping() {
  localStorage.setItem(
    "shoppingReturnPromptPending",
    "false"
  );

  localStorage.setItem(
    "shoppingSessionActive",
    "false"
  );

  document
    .getElementById("shoppingReturnModal")
    ?.classList.remove("show");

  window.location.href =
    "savings.html?fromShopping=1&scan=1";
}

window.addEventListener(
  "focus",
  () => {
    setTimeout(
      checkForShoppingReturn,
      400
    );
  }
);

window.addEventListener(
  "pageshow",
  () => {
    setTimeout(
      checkForShoppingReturn,
      400
    );
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState === "visible"
    ) {
      setTimeout(
        checkForShoppingReturn,
        400
      );
    }
  }
);

async function getLiveRouteOrigin(){
  if(!window.isSecureContext && !['localhost','127.0.0.1'].includes(location.hostname)){
    throw new Error('Live location requires HTTPS.');
  }
  if(!navigator.geolocation){
    throw new Error('Location is not supported on this device.');
  }
  return new Promise((resolve,reject)=>{
    navigator.geolocation.getCurrentPosition(
      pos=>resolve([Number(pos.coords.latitude),Number(pos.coords.longitude)]),
      err=>reject(new Error(({1:'Location permission was denied.',2:'Your current location could not be determined.',3:'The location request timed out.'})[err.code]||'Your location is unavailable.')),
      {enableHighAccuracy:true,timeout:20000,maximumAge:0}
    );
  });
}

function routePreviewRetry(){
  const plan=getSelectedTripPlan();
  if(plan)renderRoutePreview(plan);
}

async function renderRoutePreview(plan){
  const host=document.getElementById('routeMapPreview');
  if(!host)return;
  if(!window.L){
    host.innerHTML='<div class="route-map-fallback"><strong>Map preview needs an internet connection.</strong><span>Google Maps navigation will still work.</span></div>';
    return;
  }
  host.innerHTML='<div class="route-map-fallback"><strong>Getting your live location…</strong><span>Please allow location access when your browser asks.</span></div>';
  try{
    const origin=await getLiveRouteOrigin();
    const branches=(plan.storeIds||[]).map(chainId=>findNearestBranch(chainId,origin[0],origin[1])).filter(Boolean);
    if(!branches.length)throw new Error('No store branch coordinates are available.');

    const valid=branches.filter(branch=>Number.isFinite(Number(branch.lat))&&Number.isFinite(Number(branch.lng)));
    if(!valid.length)throw new Error('The selected stores do not have valid coordinates.');

    // Keep the selected plan order. Do not reorder stops independently of the plan.
    const coordinates=[origin,...valid.map(branch=>[Number(branch.lat),Number(branch.lng)])];
    host.innerHTML='';
    const map=L.map(host,{zoomControl:true,attributionControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);

    const userIcon=L.divIcon({className:'sulit-map-pin user-pin',html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]});
    const storeIcon=L.divIcon({className:'sulit-map-pin store-pin',html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]});
    L.marker(origin,{icon:userIcon}).addTo(map).bindTooltip('Your live location');
    valid.forEach((branch,index)=>L.marker([Number(branch.lat),Number(branch.lng)],{icon:storeIcon}).addTo(map).bindTooltip(`${index+1}. ${branch.chain} ${branch.branch||''}`.trim()));

    const osrmCoords=coordinates.map(point=>`${point[1]},${point[0]}`).join(';');
    const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&steps=false&alternatives=false`);
    if(!response.ok)throw new Error('The road routing service is temporarily unavailable.');
    const payload=await response.json();
    const geometry=payload?.routes?.[0]?.geometry?.coordinates;
    if(!Array.isArray(geometry)||!geometry.length)throw new Error('No drivable route was returned for these stops.');
    const roadPoints=geometry.map(point=>[point[1],point[0]]);
    L.polyline(roadPoints,{color:'#2f8f57',weight:5,opacity:.92,lineCap:'round',lineJoin:'round'}).addTo(map);
    map.fitBounds(L.latLngBounds(roadPoints).pad(.12));
    setTimeout(()=>map.invalidateSize(),120);
  }catch(error){
    console.warn('Route preview unavailable:',error);
    host.innerHTML=`<div class="route-map-fallback"><strong>We couldn’t use your live location.</strong><span>${error.message||'Check your browser location permission and try again.'}</span><button type="button" class="secondary compact-button" onclick="routePreviewRetry()">Try again</button></div>`;
  }
}

