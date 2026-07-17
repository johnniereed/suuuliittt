let oneStorePlan = null;
let twoStorePlan = null;
let recommendedPlan = null;
let alternativePlan = null;

function tripTotal(plan) { return Number(plan?.basketTotal||0)+Number(plan?.estimatedTax||0)+Number(plan?.gasCost||0); }
function itemTax(productId,amount){return amount*SulitLaunch.taxRate(productById(productId));}

function buildBestSingleStorePlan(requireComplete = true) {
  const list = getList();
  if (!list.length) return null;
  let best = null;

  getStores().forEach(store => {
    let basketTotal = 0;
    let estimatedTax = 0;
    let foundItems = 0;

    list.forEach(item => {
      const saved = priceFor(item.productId, store.id);
      if (!saved) return;
      const line=Number(saved.price)*Number(item.quantity||1); basketTotal += line; estimatedTax += itemTax(item.productId,line);
      foundItems += 1;
    });

    const complete = foundItems === list.length;
    if (requireComplete && !complete) return;
    if (foundItems < 1) return;

    const plan = {
      type: "one",
      title: "One-Stop Plan",
      storeIds: [store.id],
      storeNames: [store.name],
      basketTotal,
      estimatedTax,
      foundItems,
      totalItems: list.length,
      gasCost: 2.2,
      estimatedTime: 20,
      isComplete: complete
    };

    if (!best || tripTotal(plan) < tripTotal(best)) best = plan;
  });

  return best;
}

function buildBestTwoStorePlan() {
  const stores = getStores();
  const list = getList();
  if (!list.length) return null;
  let best = null;

  for (let i = 0; i < stores.length; i += 1) {
    for (let j = i + 1; j < stores.length; j += 1) {
      const first = stores[i];
      const second = stores[j];
      let basketTotal = 0;
      let estimatedTax = 0;
      let foundItems = 0;
      const used = new Set();

      list.forEach(item => {
        const firstPrice = priceFor(item.productId, first.id);
        const secondPrice = priceFor(item.productId, second.id);
        let chosen = null;
        let storeId = null;

        if (firstPrice && secondPrice) {
          if (Number(firstPrice.price) <= Number(secondPrice.price)) {
            chosen = firstPrice;
            storeId = first.id;
          } else {
            chosen = secondPrice;
            storeId = second.id;
          }
        } else if (firstPrice) {
          chosen = firstPrice;
          storeId = first.id;
        } else if (secondPrice) {
          chosen = secondPrice;
          storeId = second.id;
        }

        if (!chosen) return;
        const line=Number(chosen.price)*Number(item.quantity||1); basketTotal += line; estimatedTax += itemTax(item.productId,line);
        foundItems += 1;
        used.add(storeId);
      });

      if (foundItems !== list.length || used.size !== 2) continue;

      const storeIds = [...used];
      const plan = {
        type: "two",
        title: "Two-Stop Plan",
        storeIds,
        storeNames: storeIds.map(id => storeById(id)?.name || "Store"),
        basketTotal,
        estimatedTax,
        foundItems,
        totalItems: list.length,
        gasCost: 3.8,
        estimatedTime: 35,
        isComplete: true
      };

      if (!best || tripTotal(plan) < tripTotal(best)) best = plan;
    }
  }

  return best;
}

function planCard(plan, number, badge, note, key) {
  const isRecommended = number === 1;
  return `
    <article class="plan-card ${isRecommended ? "selected" : ""}">
      <div class="plan-title-row">
        <div>
          <div class="route-kicker">${isRecommended ? "Recommended" : "Alternative"}</div>
          <div class="route-name">${plan.storeNames.join(" + ")}</div>
        </div>
        <span class="badge">${badge}</span>
      </div>

      <div class="route-metrics">
        <div><small>Estimated checkout</small><b>${money(tripTotal(plan))}</b></div>
        <div><small>Time</small><b>${Number(plan.estimatedTime || 0)} min</b></div>
        <div><small>Stops</small><b>${plan.storeIds.length}</b></div>
      </div>

      <div class="tax-breakdown"><div class="tax-row"><span>Basket subtotal</span><b>${money(plan.basketTotal)}</b></div><div class="tax-row"><span>Estimated tax</span><b>${money(plan.estimatedTax||0)}</b></div><div class="tax-row"><span>Estimated gas</span><b>${money(plan.gasCost||0)}</b></div></div><div class="plan-note ${note.type || ""}">${note.text}</div>
      <button class="plan-select" type="button" onclick="selectPlan('${key}')">
        ${isRecommended ? "Use Recommended Plan" : "Choose This Plan"}
      </button>
    </article>`;
}

function renderPlans() {
  const list = getList();
  const host = document.getElementById("plans");
  const message = document.getElementById("planMessage");

  if (!list.length) {
    host.innerHTML = '<a class="card empty empty-link" href="add.html"><strong>Add groceries first.</strong><div class="muted" style="margin-top:6px">Tap here to start your grocery list.</div></a>';
    if (message) message.innerHTML = "";
    return;
  }

  oneStorePlan = buildBestSingleStorePlan(true);
  twoStorePlan = buildBestTwoStorePlan();
  recommendedPlan = null;
  alternativePlan = null;

  let recommendationTitle = "Best plan available today";
  let recommendationText = "Sulit balanced your checkout total, travel time, and number of stops.";

  if (oneStorePlan && twoStorePlan) {
    const oneTotal = tripTotal(oneStorePlan);
    const twoTotal = tripTotal(twoStorePlan);
    const savings = oneTotal - twoTotal;
    const extraTime = Math.max(0, twoStorePlan.estimatedTime - oneStorePlan.estimatedTime);

    if (savings < 5) {
      recommendedPlan = oneStorePlan;
      alternativePlan = twoStorePlan;
      recommendationTitle = `Shop only at ${oneStorePlan.storeNames[0]}`;
      recommendationText = savings > 0
        ? `A second stop saves only <strong>${money(savings)}</strong>. It is not worth the extra drive today.`
        : "One store is already your best choice today.";
    } else if (savings <= 10) {
      const worthIt = extraTime <= 12;
      recommendedPlan = worthIt ? twoStorePlan : oneStorePlan;
      alternativePlan = worthIt ? oneStorePlan : twoStorePlan;
      recommendationTitle = worthIt ? "A second stop may be worth it" : `Shop only at ${oneStorePlan.storeNames[0]}`;
      recommendationText = worthIt
        ? `Save <strong>${money(savings)}</strong> for about ${extraTime} extra minutes.`
        : `You could save ${money(savings)}, but the extra ${extraTime} minutes may not be worth your time.`;
    } else {
      recommendedPlan = twoStorePlan;
      alternativePlan = oneStorePlan;
      recommendationTitle = "Visit two stores and save more";
      recommendationText = `Save <strong>${money(savings)}</strong> for about ${extraTime} extra minutes of driving.`;
    }
  } else if (oneStorePlan) {
    recommendedPlan = oneStorePlan;
    recommendationTitle = `Shop only at ${oneStorePlan.storeNames[0]}`;
    recommendationText = "Everything on your list is available in one stop.";
  } else if (twoStorePlan) {
    recommendedPlan = twoStorePlan;
    recommendationTitle = "Visit two stores";
    recommendationText = "This is the lowest complete plan available for your list.";
  }

  if (!recommendedPlan) {
    const incomplete = buildBestSingleStorePlan(false);
    if (!incomplete) {
      host.innerHTML = '<div class="card empty"><h2>No shopping plan yet</h2><p class="muted">No store has pricing for the products in your list yet.</p><a class="button" href="stores.html">Return to store details</a></div>';
      if (message) message.innerHTML = "";
      localStorage.removeItem("selectedPlan");
      return;
    }

    const missing = Math.max(0, incomplete.totalItems - incomplete.foundItems);
    recommendedPlan = incomplete;
    if (message) {
      message.innerHTML = `<div class="sulit-recommendation"><small>Sulit recommendation</small><h2>Best available store</h2><p>We found ${incomplete.foundItems} of ${incomplete.totalItems} products. ${missing} ${missing === 1 ? "product is" : "products are"} not priced yet.</p></div>`;
    }
    host.innerHTML = planCard(
      incomplete,
      1,
      "Missing items",
      { type: "warning", text: `${missing} ${missing === 1 ? "product isn’t" : "products aren’t"} available at this store. We’ll recommend another store if it helps you save more.` },
      "recommended"
    );
    return;
  }

  if (message) {
    message.innerHTML = `<div class="sulit-recommendation"><small>Sulit recommendation</small><h2>${recommendationTitle}</h2><p>${recommendationText}</p></div>`;
  }

  let html = planCard(
    recommendedPlan,
    1,
    "Recommended",
    { type: "success", text: recommendedPlan.storeIds.length === 2 ? "✓ Route 2 includes every product in your grocery list." : "✓ Every product in your grocery list is covered." },
    "recommended"
  );

  if (alternativePlan) {
    const recommendedTotal = tripTotal(recommendedPlan);
    const alternativeTotal = tripTotal(alternativePlan);
    const hasCoverageBenefit = Boolean(alternativePlan.isComplete) && !Boolean(recommendedPlan.isComplete);
    const hasStopBenefit = alternativePlan.storeIds.length < recommendedPlan.storeIds.length;
    const isCheaper = alternativeTotal < recommendedTotal;
    const hasMeaningfulBenefit = isCheaper || hasCoverageBenefit || hasStopBenefit;

    // Do not present a more expensive route as an alternative unless it offers a real benefit.
    if (hasMeaningfulBenefit) {
      const difference = Math.abs(alternativeTotal - recommendedTotal);
      const isOneStop = alternativePlan.storeIds.length === 1;
      const badge = isOneStop ? "One stop" : "Alternative";
      const text = isOneStop
        ? `Complete list in one store${difference ? ` · ${money(difference)} difference` : ""}.`
        : `Complete list across two stores${difference ? ` · ${money(difference)} difference` : ""}.`;
      html += planCard(alternativePlan, 2, badge, { type: "success", text: `✓ ${text}` }, "alternative");
    }
  }

  host.innerHTML = html;
}

function selectPlan(key) {
  const plan = key === "alternative" ? alternativePlan : recommendedPlan;
  if (!plan) return;
  if (typeof saveSelectedPlan === "function") saveSelectedPlan(plan);
  else localStorage.setItem("selectedPlan", JSON.stringify(plan));
  location.href = "route.html";
}

renderPlans();
document.addEventListener("grocerysaver:catalog-updated", renderPlans);
