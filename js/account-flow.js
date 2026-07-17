const SulitAccount = (() => {
  function savedName() {
    return (
      localStorage.getItem('groceryProfileName') ||
      localStorage.getItem('budgetProfileName') ||
      localStorage.getItem('profileName') ||
      ''
    ).trim();
  }

  function saveName(name) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('Enter your name to continue.');
    localStorage.setItem('groceryProfileName', clean);
    localStorage.setItem('budgetProfileName', clean);
    localStorage.setItem('profileName', clean);
    return clean;
  }

  async function ensureAnonymousWithName(name) {
    const clean = saveName(name);
    // Preserve the existing anonymous cloud session when Supabase is configured,
    // but never block Get Started when it is unavailable during local testing.
    try {
      if (window.CloudSync?.configured?.()) {
        const client = window.CloudSync.client?.();
        if (client?.auth) {
          let { data } = await client.auth.getSession();
          if (!data?.session) {
            await client.auth.signInAnonymously();
            data = (await client.auth.getSession()).data;
          }
          const userId = data?.session?.user?.id;
          if (userId) {
            await client.from('profiles').upsert({
              id: userId,
              display_name: clean,
              is_anonymous: true,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          }
        }
      }
    } catch (error) {
      console.warn('Anonymous cloud profile was not available; continuing locally.', error);
    }
    return clean;
  }

  function modalMarkup() {
    return `<div class="account-sheet" id="sulitAccountSheet" aria-hidden="true">
      <div class="account-sheet-backdrop" data-account-close></div>
      <section class="account-sheet-card" role="dialog" aria-modal="true" aria-labelledby="accountSheetTitle">
        <button class="account-sheet-close" type="button" data-account-close aria-label="Close">×</button>
        <div id="accountSheetContent"></div>
      </section>
    </div>`;
  }

  function ensureModal() {
    if (document.getElementById('sulitAccountSheet')) return;
    document.body.insertAdjacentHTML('beforeend', modalMarkup());
    document.querySelectorAll('[data-account-close]').forEach((element) => {
      element.addEventListener('click', closeSheet);
    });
  }

  function openSheet(html) {
    ensureModal();
    document.getElementById('accountSheetContent').innerHTML = html;
    const sheet = document.getElementById('sulitAccountSheet');
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    setTimeout(() => sheet.querySelector('input')?.focus(), 50);
  }

  function closeSheet() {
    const sheet = document.getElementById('sulitAccountSheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function setMessage(text) {
    const host = document.getElementById('accountSheetMessage');
    if (host) host.innerHTML = text ? `<div class="account-inline-message error">${text}</div>` : '';
  }

  function openName(onComplete) {
    openSheet(`<span class="account-kicker">Welcome to Sulit</span>
      <h2 id="accountSheetTitle">What's your name?</h2>
      <label for="accountNameInput">Your name</label>
      <input id="accountNameInput" autocomplete="name" maxlength="60" placeholder="Enter your name" value="">
      <div id="accountSheetMessage"></div>
      <button id="accountNameContinue" type="button" disabled>Continue</button>`);

    const input = document.getElementById('accountNameInput');
    const button = document.getElementById('accountNameContinue');
    const syncButton = () => { button.disabled = !input.value.trim(); };
    input.addEventListener('input', syncButton);
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && !button.disabled) button.click(); });
    syncButton();

    button.onclick = async () => {
      try {
        button.disabled = true;
        button.textContent = 'Setting up…';
        await ensureAnonymousWithName(input.value);
        closeSheet();
        if (typeof onComplete === 'function') onComplete();
      } catch (error) {
        setMessage(error.message || 'Please enter your name.');
        button.textContent = 'Continue';
        syncButton();
      }
    };
  }

  function boot() {
    ensureModal();
  }

  return { boot, openName, ensureAnonymousWithName, closeSheet };
})();

window.addEventListener('DOMContentLoaded', () => SulitAccount.boot());
