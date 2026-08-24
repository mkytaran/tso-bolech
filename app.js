// =========================================================================
// VAŠE URL ADRESA Z GOOGLE APPS SCRIPTU
// =========================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbxna8cDlco_UY1LI80oTv1FGVdHXi2_aHZcLR0zf9jY2UKDPJU6P__YufBFXTtd5WPHCw/exec";
let user = null; 
let appData = { akce: [], noty: [], ucast: [] };

const PARTITURA_SECTIONS = ["1. Housle", "2. Housle", "Violy", "Violoncella", "Kontrabasy", "Flétny / Pikola", "Oboje / Anglický roh", "Klarinety", "Fagoty", "Lesní rohy", "Trubky", "Pozouny", "Tuba", "Bicí nástroje", "Klávesy / Klavír", "Ostatní / Hosté"];
const SMYCKE_SECTIONS = ["housle", "viola", "violy", "cello", "violoncello", "kontrabas"];
const DECHOVE_SECTIONS = ["flétn", "pikol", "oboj", "klarinet", "fagot", "roh", "trubk", "pozoun", "tuba"];

// --- DARK MODE LOGIKA ---
function initTheme() {
  const savedTheme = localStorage.getItem('bolech_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    updateThemeIcon(true);
  }
}
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('bolech_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}
function updateThemeIcon(isDark) {
  const icon = document.getElementById('theme-icon');
  if (isDark) {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }
}
initTheme(); 

async function runGoogleScript(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, payload: payload }),
      redirect: 'follow'
    });
    if (!response.ok) throw new Error('Chyba sítě: ' + response.status);
    return await response.json();
  } catch (error) {
    console.error("Chyba API:", error);
    alert("Chyba při komunikaci se serverem. Zkontrolujte připojení.");
    return { success: false, error: error.toString() };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("bolech_auth_member");
  if(saved) { user = JSON.parse(saved); initApp(); } 
  else { document.getElementById("loginScreen").style.display = "block"; }
});

function handleLoginSubmit(e) { 
  e.preventDefault(); 
  const btn = document.getElementById('loginBtn');
  btn.innerText = "Ověřuji...";
  btn.disabled = true;

  const queryValue = document.getElementById('loginQuery').value;
  const pinValue = document.getElementById('loginPin').value;

  runGoogleScript("authenticateMember", { query: queryValue, pin: pinValue })
  .then(res => { 
    btn.innerText = "Vstoupit";
    btn.disabled = false;
    if(res.success) { 
      user = res.member; 
      localStorage.setItem('bolech_auth_member', JSON.stringify(user)); 
      document.getElementById('loginScreen').style.display = 'none'; 
      document.getElementById('loginPin').value = ''; 
      initApp(); 
    } else {
      alert(res.error); 
    }
  }); 
}

function initApp() {
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("userBadge").innerText = user.name;
  runGoogleScript("getInitialData").then(d => { 
    appData = d; 
    renderEvents(); 
    renderSheets(); 
  });
}

function parseDate(dateStr) {
  if (!dateStr) return 0;
  const parts = String(dateStr).trim().split('.');
  if (parts.length >= 3) return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0])).getTime();
  return new Date(dateStr).getTime() || 0;
}

function escapeHtml(str) {
  return String(str||'').replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag]));
}

// -------------------------------------------------------------------------
// GENEROVÁNÍ VLASTNÍHO ID PRO AKCE
// -------------------------------------------------------------------------
function generovatIdAkce(typ) {
  let prefix = 'akce_';
  if (typ === 'Koncert') prefix = 'kon_';
  else if (typ === 'Generálka') prefix = 'gen_';
  else if (typ === 'Tutti zkouška') prefix = 'tutti_';
  else if (typ === 'Zkouška smyčců') prefix = 'zk_sm_';
  else if (typ === 'Zkouška dechů') prefix = 'zk_dech_';

  let max = 0;
  appData.akce.forEach(a => {
    if (a.id && String(a.id).startsWith(prefix)) {
      let num = parseInt(String(a.id).replace(prefix, ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  return prefix + String(max + 1).padStart(3, '0');
}

// -------------------------------------------------------------------------
// FILTROVÁNÍ ZKOUŠEK PODLE SEKCE HRÁČE
// -------------------------------------------------------------------------
function isEventVisibleForUser(akce) {
  const typ = String(akce.typ || "").trim();
  const userSecL = String(user.section || "").toLowerCase();
  const userRole = String(user.role || "").trim().toLowerCase();
  
  if (userRole !== "" && userRole !== "-") return true; 
  if (typ === "Zkouška smyčců") return SMYCKE_SECTIONS.some(s => userSecL.includes(s));
  if (typ === "Zkouška dechů") return DECHOVE_SECTIONS.some(s => userSecL.includes(s));
  return true; 
}

function renderEvents() {
  const cont = document.getElementById("eventsContainer"); cont.innerHTML = "";
  const userRole = String(user.role||"").trim().toLowerCase();
  
  if (userRole !== "" && userRole !== "-") {
    cont.innerHTML += `<button class="btn" style="background:var(--success); margin-bottom:16px;" onclick="openAkceForm()">➕ Přidat novou akci</button>`;
  }

  const visibleAkce = appData.akce.filter(a => isEventVisibleForUser(a))
                                  .sort((a,b) => parseDate(b.datum) - parseDate(a.datum));
  
  if(visibleAkce.length === 0) {
    cont.innerHTML += `<div style="text-align:center; padding:40px; color:var(--text-muted);">Zatím nejsou naplánovány žádné akce.</div>`;
    return;
  }

  visibleAkce.forEach(akce => {
    const myVote = (appData.ucast||[]).find(u => String(u.akceId) === String(akce.id) && u.jmeno === user.name);
    
    // PŘIŘAZENÍ BAREV PODLE NOVÝCH TYPŮ ZKOUŠEK
    let barClass = '';
    switch (akce.typ) {
      case 'Koncert': barClass = 'bar-koncert'; break;
      case 'Generálka': barClass = 'bar-generalka'; break;
      case 'Zkouška smyčců': barClass = 'bar-zkouska-smycce'; break;
      case 'Zkouška dechů': barClass = 'bar-zkouska-dechy'; break;
      default: barClass = 'bar-tutti';
    }
    
    let editBtn = "";
    if (userRole !== "" && userRole !== "-") {
      editBtn = `<button class="edit-btn" onclick='openAkceForm(${JSON.stringify(akce).replace(/'/g, "&#39;")})' title="Upravit akci">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
      </button>`;
    }

    cont.innerHTML += `
      <div class="card">
        <div class="card-top-bar ${barClass}"><span>${akce.typ}</span><span>📅 ${akce.datum}</span></div>
        <div class="card-body">
          <div class="card-title-row">
            <div class="card-title">${akce.nazev}</div>
            ${editBtn}
          </div>
          
          ${akce.misto ? `<p style="margin-bottom:6px;">📍 ${akce.misto}</p>` : ''}
          <p style="margin-bottom:6px;">🕒 Začátek: <strong>${akce.casOd}</strong></p>
          ${akce.casSrazu ? `<p style="margin-bottom:6px;">⏰ Sraz: <strong>${akce.casSrazu}</strong></p>` : ''}
          ${akce.zacatekGeneralky ? `<p style="margin-bottom:6px;">🎻 Generálka: <strong>${akce.zacatekGeneralky}</strong></p>` : ''}
          ${akce.damy ? `<p style="margin-bottom:6px;">👗 Dámy: ${akce.damy}</p>` : ''}
          ${akce.pani ? `<p style="margin-bottom:6px;">🤵 Páni: ${akce.pani}</p>` : ''}
          ${akce.poznamka ? `<p style="margin-top:12px; color:var(--text-muted);"><strong>Pozn.:</strong> ${akce.poznamka}</p>` : ''}
          ${akce.uzavierka ? `<div class="deadline-box">⏳ Uzávěrka pro vyjádření: ${akce.uzavierka}</div>` : ''}
          
          <div class="att-buttons">
            <button class="btn-att ${myVote?.stav==='Ano'?'selected-ano':''}" onclick="submitUcast('${akce.id}','${akce.datum}','Ano',this)">✓ Účastním se</button>
            <button class="btn-att ${myVote?.stav==='Ne'?'selected-ne' : ''}" onclick="submitUcast('${akce.id}','${akce.datum}','Ne',this)">✕ Neúčastním</button>
          </div>
          
          <div id="duvod-${akce.id}" class="duvod-box" style="display:${myVote?.stav==='Ne'&&!myVote?.duvod?'block':'none'}">
            <input type="text" id="in-${akce.id}" placeholder="Uveďte prosím důvod neúčasti" class="modal-input" style="margin-bottom:12px;">
            <button class="btn" onclick="saveDuvod('${akce.id}','${akce.datum}',this)">Odeslat důvod</button>
          </div>
          
          <div id="roster-container-${akce.id}">${generateRosterHtml(akce.id)}</div>
        </div>
      </div>`;
  });
}

function generateRosterHtml(akceId) {
  const potvrdili = (appData.ucast || []).filter(u => String(u.akceId) === String(akceId) && u.stav === 'Ano');
  const grouped = {};
  
  potvrdili.forEach(p => {
    let hracSekce = String(p.sekce || "Ostatní").trim().toLowerCase();
    let nalezenaSekce = PARTITURA_SECTIONS.find(s => 
      s.toLowerCase().includes(hracSekce) || hracSekce.includes(s.toLowerCase())
    ) || "Ostatní / Hosté";
    if (!grouped[nalezenaSekce]) grouped[nalezenaSekce] = [];
    grouped[nalezenaSekce].push(p.jmeno);
  });

  let html = `<button class="roster-toggle" onclick="toggleRoster('${akceId}')">
                <span>👥 Přihlášeno (${potvrdili.length})</span>
                <span id="arrow-${akceId}">▼</span>
              </button>
              <div id="content-${akceId}" class="roster-content">`;
  
  PARTITURA_SECTIONS.forEach(s => {
    if (grouped[s]) html += `<div class="roster-section"><div class="roster-section-title">${s}</div><div class="roster-members">${grouped[s].join(', ')}</div></div>`;
  });
  if (grouped["Ostatní / Hosté"]) html += `<div class="roster-section"><div class="roster-section-title">Ostatní / Hosté</div><div class="roster-members">${grouped["Ostatní / Hosté"].join(', ')}</div></div>`;
  if (potvrdili.length === 0) html += '<div style="font-size:15px; color:var(--text-muted); font-style:italic; padding:8px 0;">Zatím nikdo nepotvrdil účast.</div>';

  return html + '</div>';
}

function toggleRoster(id) { 
  const content = document.getElementById('content-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (content.style.display === 'block') { content.style.display = 'none'; arrow.innerText = '▼'; } 
  else { content.style.display = 'block'; arrow.innerText = '▲'; }
}

function submitUcast(id, datum, stav, btn) { 
  const origText = btn.innerText;
  btn.innerText = "Ukládám...";
  runGoogleScript("saveUcast", {akceId: id, datumAkce: datum, jmeno: user.name, sekce: user.section, stav: stav})
  .then(res => {
    btn.innerText = origText;
    if(res.success) {
      document.getElementById('duvod-'+id).style.display = (stav === 'Ne') ? 'block' : 'none'; 
      btn.parentElement.querySelectorAll('.btn-att').forEach(b => b.className = 'btn-att'); 
      btn.classList.add(stav === 'Ano' ? 'selected-ano' : 'selected-ne');
      
      let exist = appData.ucast.find(u => u.akceId === id && u.jmeno === user.name);
      if(exist) exist.stav = stav; else appData.ucast.push({akceId:id, jmeno:user.name, sekce:user.section, stav:stav});
      document.getElementById('roster-container-'+id).innerHTML = generateRosterHtml(id);
    }
  });
}

function saveDuvod(id, datum, btn) { 
  const duvod = document.getElementById('in-'+id).value; 
  btn.innerText = "Ukládám...";
  runGoogleScript("saveUcast", {akceId: id, datumAkce: datum, jmeno: user.name, sekce: user.section, stav: 'Ne', duvod: duvod})
  .then(res => {
    btn.innerText = "Odeslat důvod";
    if(res.success) document.getElementById('duvod-'+id).style.display = 'none';
  });
}

function openAkceForm(akce = null) {
  const isEdit = akce !== null;
  // Pokud jde o editaci, vložíme k roletce atribut "disabled"
  const selectDisabledAttr = isEdit ? 'disabled style="background: var(--bg); opacity: 0.8;"' : '';
  
  const html = `
    <div id="akceModal" class="modal-overlay">
      <div class="modal-box">
        <h3 style="margin-bottom:8px; font-size:24px;">${isEdit ? 'Upravit akci' : 'Nová akce'}</h3>
        <p style="color:var(--text-muted); margin-bottom:20px; font-size:15px;">Vyplňte údaje, nepotřebná pole nechte prázdná.</p>
        <form id="editAkceForm" onsubmit="submitAkceForm(event, '${isEdit ? escapeHtml(akce.id) : ''}')">
          
          <label>Typ akce:</label>
          <select id="f_typ" class="modal-input" onchange="toggleAkceFields()" ${selectDisabledAttr}>
            <option value="Tutti zkouška" ${akce?.typ==='Tutti zkouška'?'selected':''}>Tutti zkouška</option>
            <option value="Zkouška smyčců" ${akce?.typ==='Zkouška smyčců'?'selected':''}>Zkouška smyčců</option>
            <option value="Zkouška dechů" ${akce?.typ==='Zkouška dechů'?'selected':''}>Zkouška dechů</option>
            <option value="Generálka" ${akce?.typ==='Generálka'?'selected':''}>Generálka</option>
            <option value="Koncert" ${akce?.typ==='Koncert'?'selected':''}>Koncert</option>
          </select>
          ${isEdit ? `<small style="color:var(--danger); font-size:13px; display:block; margin-top:4px;">Typ akce nelze po vytvoření měnit.</small>` : ''}

          <label>Název:</label>
          <input type="text" id="f_nazev" value="${escapeHtml(akce?.nazev||'')}" required class="modal-input">

          <label>Místo:</label>
          <input type="text" id="f_misto" value="${escapeHtml(akce?.misto||'')}" class="modal-input">

          <div style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Datum:</label>
              <input type="text" id="f_datum" value="${escapeHtml(akce?.datum||'')}" placeholder="24. 12. 2026" required class="modal-input">
            </div>
            <div style="flex:1;">
              <label>Čas od:</label>
              <input type="text" id="f_casOd" value="${escapeHtml(akce?.casOd||'')}" placeholder="18:00" class="modal-input">
            </div>
          </div>

          <div id="row_casy" style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Čas srazu:</label>
              <input type="text" id="f_casSrazu" value="${escapeHtml(akce?.casSrazu||'')}" placeholder="17:30" class="modal-input">
            </div>
            <div id="col_generalka" style="flex:1;">
              <label>Čas generálky:</label>
              <input type="text" id="f_zacatekGeneralky" value="${escapeHtml(akce?.zacatekGeneralky||'')}" placeholder="18:00" class="modal-input">
            </div>
          </div>

          <div id="row_obleceni" style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Dámy (oděv):</label>
              <input type="text" id="f_damy" value="${escapeHtml(akce?.damy||'')}" placeholder="černé dlouhé" class="modal-input">
            </div>
            <div style="flex:1;">
              <label>Páni (oděv):</label>
              <input type="text" id="f_pani" value="${escapeHtml(akce?.pani||'')}" placeholder="frak" class="modal-input">
            </div>
          </div>

          <label>Poznámka pro hráče:</label>
          <textarea id="f_poznamka" class="modal-input" style="min-height:80px;">${escapeHtml(akce?.poznamka||'')}</textarea>

          <div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">
            <button type="submit" id="btnSaveModal" class="btn" style="flex:1; min-width:120px;">Uložit akci</button>
            <button type="button" class="btn" style="background:var(--border); color:var(--text); flex:1; min-width:120px;" onclick="document.getElementById('akceModal').remove()">Zrušit</button>
            ${isEdit ? `<button type="button" class="btn" style="background:var(--danger); color:white; width:100%; margin-top:8px;" onclick="deleteAkcePrompt('${escapeHtml(akce.id)}')">🗑 Smazat akci</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  toggleAkceFields(); 
}

function toggleAkceFields() {
  const typ = document.getElementById('f_typ').value;
  const jeZkouska = typ.includes('zkouška') || typ.includes('Zkouška');
  document.getElementById('row_casy').style.display = jeZkouska ? 'none' : 'flex';
  document.getElementById('row_obleceni').style.display = (typ === 'Koncert') ? 'flex' : 'none';
  document.getElementById('col_generalka').style.display = (typ === 'Koncert') ? 'block' : 'none';
}

function submitAkceForm(e, akceId) {
  e.preventDefault();
  document.getElementById('btnSaveModal').innerText = "Ukládám...";
  
  const typ = document.getElementById('f_typ').value;
  const jeZkouska = typ.includes('zkouška') || typ.includes('Zkouška');
  
  // Pokud akceID už existuje (editace), zachová se staré, pokud ne, vygeneruje se z typu.
  const finalId = akceId || generovatIdAkce(typ);

  const payload = {
    id: finalId, typ: typ, nazev: document.getElementById('f_nazev').value, misto: document.getElementById('f_misto').value,
    datum: document.getElementById('f_datum').value, casOd: document.getElementById('f_casOd').value,
    casSrazu: jeZkouska ? "" : document.getElementById('f_casSrazu').value,
    zacatekGeneralky: typ !== 'Koncert' ? "" : document.getElementById('f_zacatekGeneralky').value,
    damy: typ !== 'Koncert' ? "" : document.getElementById('f_damy').value, pani: typ !== 'Koncert' ? "" : document.getElementById('f_pani').value,
    poznamka: document.getElementById('f_poznamka').value
  };
  
  runGoogleScript("saveAkce", payload).then(res => {
    if (res.success) { document.getElementById('akceModal').remove(); initApp(); } 
    else { alert('Chyba: ' + res.error); document.getElementById('btnSaveModal').innerText = "Uložit akci"; }
  });
}

function deleteAkcePrompt(akceId) {
  if (confirm("Opravdu chcete tuto akci nenávratně smazat z tabulky?")) {
    runGoogleScript("deleteAkce", { id: akceId }).then(res => {
      if (res.success) { document.getElementById('akceModal').remove(); initApp(); } 
      else alert('Chyba při mazání: ' + res.error);
    });
  }
}

function switchTab(t, b) { 
  document.getElementById('tab-events').style.display = t==='events'?'block':'none'; 
  document.getElementById('tab-sheets').style.display = t==='sheets'?'block':'none'; 
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
}

function renderSheets() {
  const cont = document.getElementById("sheetsContainer");
  if(appData.noty.length === 0) { cont.innerHTML = "<div style='text-align:center; padding:40px; color:var(--text-muted);'>Žádné noty v archivu.</div>"; return; }
  cont.innerHTML = appData.noty.map(n => `<div class="card card-body" style="display:flex; justify-content:space-between; align-items:center;"><div><strong style="font-size:18px;">${n.nazev}</strong><br><span style="color:var(--text-muted);">${n.skladatel}</span></div>${n.link ? `<a href="${n.link}" target="_blank" class="btn" style="width:auto; padding:10px 16px;">Otevřít PDF</a>` : ''}</div>`).join('');
}

function confirmLogout() { 
  if(confirm("Opravdu se chcete odhlásit?")) { localStorage.removeItem('bolech_auth_member'); location.reload(); } 
}