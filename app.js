// =========================================================================
// VAŠE URL ADRESA Z GOOGLE APPS SCRIPTU
// ========================================================================= 
const API_URL = "https://script.google.com/macros/s/AKfycbwVHLODjApvEPwE4RQo5nQxdr9Y8Ng-EoWTGGsH3l45L174huUMCh_99edIV-cbXQVHQQ/exec";

let user = null; 
let appData = { akce: [], noty: [], ucast: [] };

// =====================================================
// DEFINICE NÁSTROJŮ A SKUPIN ORCHESTRU
// =====================================================


// Hierarchie a řazení nástrojových skupin TSO Bolech
const ORCHESTR_SKUPINY = {
  "Smyčcové nástroje": [
    "1. Housle", 
    "2. Housle", 
    "Violy", 
    "Violoncella", 
    "Kontrabasy"
  ],
  "Dechové nástroje": [
    "Flétny", 
    "Hoboje", 
    "Klarinety / Saxofony", 
    "Fagoty", 
    "Lesní rohy", 
    "Trubky", 
    "Trombóny a Tuba"
  ],
  "Ostatní nástroje a zpěv": [
    "Bicí nástroje", 
    "Klávesy", 
    "Kytary", 
    "Zpěv"
  ],
  "Hosté": [
    "Hosté"
  ]
};

// Hlavní ploché pole kategorií pro zobrazení (přesně odpovídá názvům výše)
const PARTITURA_SECTIONS = [
  "1. Housle", "2. Housle", "Violy", "Violoncella", "Kontrabasy", 
  "Flétny", "Hoboje", "Klarinety / Saxofony", "Fagoty", "Lesní rohy", 
  "Trubky", "Trombóny a Tuba", "Bicí nástroje", "Klávesy", "Kytary", "Zpěv", "Hosté"
];

// -----------------------------------------------------
// POMOCNÁ POLE PRO DETEKCI ZADANÝCH TEXTŮ A SKLOŇOVÁNÍ
// -----------------------------------------------------

// Kořeny slov pro smyčce (zachytí: housle, houslí, houslím, viola, violy, cello, violoncello...)
const SMYCKE_SECTIONS = [
  "housl", "viol", "cell", "kontrabas"
];

// Kořeny slov pro dechy s ohledem na českou gramatiku
const DECHOVE_SECTIONS = [
  "flétn",        // flétna, flétny, flétnou
  "hoboj",        // hoboj, hoboje, hobojem
  "klarinet",     // klarinet, klarinety
  "saxofon",      // saxofon, saxofony
  "fagot",        // fagot, fagoty
  "roh",          // roh, rohy, rohu (lesní roh)
  "trubk",        // trubka, trubky, trubku
  "trubc",        // trubce (3. a 6. pád)
  "trombón",      // s čárkou
  "trombon",      // bez čárky
  "tuba", "tuby", "tubě", "tubou" // Tuba vypsaná podrobněji, aby nebrala nesmysly
];

// Kořeny pro zachycení hostujících hráčů (host, hosté, hostující)
const HOSTE_SECTIONS = [
  "host"
];

function initTheme() {
  const savedTheme = localStorage.getItem('bolech_theme');
  if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); updateThemeIcon(true); }
}
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('bolech_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}
function updateThemeIcon(isDark) {
  const icon = document.getElementById('theme-icon');
  if (isDark) icon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  else icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
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
    
    if (!response.ok) throw new Error('Chyba serveru: ' + response.status);
    return await response.json();
  } catch (error) {
    console.error("Detail chyby sítě:", error); 
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
  btn.innerText = "Ověřuji..."; btn.disabled = true;
  runGoogleScript("authenticateMember", { query: document.getElementById('loginQuery').value, pin: document.getElementById('loginPin').value })
  .then(res => { 
    btn.innerText = "Vstoupit"; btn.disabled = false;
    if(res.success) { 
      user = res.member; localStorage.setItem('bolech_auth_member', JSON.stringify(user)); 
      document.getElementById('loginScreen').style.display = 'none'; initApp(); 
    } else alert(res.error); 
  }); 
}

function initApp() {
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("userBadge").innerText = user.name;
  
  const userRole = String(user.role || "").trim().toLowerCase();
  const isVedení = userRole !== "" && userRole !== "-";
  const jeDirigent = userRole === 'dirigent';

  // Zobrazíme tlačítko Správa pro vedení
  if (isVedení) {
    document.getElementById('btn-nav-admin').style.display = 'flex';
  }

  const cachedData = localStorage.getItem("bolech_data_cache");
  if (cachedData) { 
    appData = JSON.parse(cachedData); 
    renderEvents(); 
    vykresliNoty(appData.noty || [], user.section, jeDirigent);
    if (isVedení) vykresliAdminNoty(); // Volání pro vedení
  }

  runGoogleScript("getInitialData").then(d => { 
    if(d.akce) {
      appData = d; 
      localStorage.setItem("bolech_data_cache", JSON.stringify(appData));
      renderEvents(); 
      vykresliNoty(appData.noty || [], user.section, jeDirigent);
      if (isVedení) vykresliAdminNoty(); // Volání pro vedení
    }
  });
}

function parseDate(dateStr) {
  if (!dateStr) return 0;
  const parts = String(dateStr).trim().split('.');
  if (parts.length >= 3) return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0])).getTime();
  return new Date(dateStr).getTime() || 0;
}

function escapeHtml(str) { return String(str||'').replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag])); }

function generovatIdAkce(typ) {
  let prefix = 'akce_';
  const t = String(typ).toLowerCase();
  
  if (t.includes('koncert')) prefix = 'kon_';
  else if (t.includes('generálka')) prefix = 'gen_';
  else if (t.includes('zkouška') || t.includes('zkouska')) prefix = 'zk_'; 
  else if (t.includes('informace') || t.includes('oznámení')) prefix = 'info_';

  let max = 0;
  appData.akce.forEach(a => {
    if (a.id && String(a.id).startsWith(prefix)) {
      let num = parseInt(String(a.id).replace(prefix, ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  return prefix + String(max + 1).padStart(3, '0');
}

function isEventVisibleForUser(akce) {
  const typ = String(akce.typ || "").trim();
  const userSecL = String(user.section || "").toLowerCase();
  const userRole = String(user.role || "").trim().toLowerCase();
  
  if (typ.includes("Oznámení") || typ.includes("Informace")) return true; 
  if (userRole !== "" && userRole !== "-") return true; 
  if (typ === "Zkouška smyčců") return SMYCKE_SECTIONS.some(s => userSecL.includes(s));
  if (typ === "Zkouška dechů") return DECHOVE_SECTIONS.some(s => userSecL.includes(s));
  return true; 
}

/**
 * Funkce vygeneruje seznam not pro daného hráče.
 * @param {Array} dataNoty - Získaná data z Google Tabulky (pole objektů)
 * @param {String} nastrojUzivatele - Nástroj přihlášeného hráče (např. "1. Housle")
 * @param {Boolean} jeDirigent - True, pokud je hráč dirigent
 */
function vykresliNoty(dataNoty, nastrojUzivatele, jeDirigent = false) {
  const kontejner = document.getElementById('notyContainer');
  const infoText = document.getElementById('notyNastrojInfo');
  
  if (!kontejner) return;

  // Zobrazení nástroje v hlavičce pro vizuální kontrolu hráče
  if (infoText) {
    infoText.textContent = jeDirigent ? "Režim partitury" : `Zobrazený part: ${nastrojUzivatele}`;
  }

  // 1. Filtrace podle aktivity a nástroje
  const relevantniNoty = dataNoty.filter(nota => {
    let aktivni = String(nota.aktivni || '').toUpperCase().trim();
    // Pokud nota nemá ve sloupci Aktivni slovo "ANO", přeskočíme ji
    if (aktivni !== 'TRUE' && aktivni !== 'ANO' && aktivni !== '1') return false;
    
    // Dirigent vidí vše, co je označeno jako Partitura
    if (jeDirigent && nota.sekce === 'Partitura') return true;
    
    // Shoda nástroje z tabulky s nástrojem uživatele
    if (nota.sekce === nastrojUzivatele) return true;
    
    // Společné party pro housle (pokud je v tabulce "Housle", vidí to 1. i 2. housle)
    if (nota.sekce === 'Housle' && (nastrojUzivatele === '1. Housle' || nastrojUzivatele === '2. Housle')) {
      return true;
    }
    
    return false;
  });

  if (relevantniNoty.length === 0) {
    kontejner.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 40px; padding: 20px;">Pro váš nástroj aktuálně nejsou k dispozici žádné noty na repertoáru.</p>';
    return;
  }

  // 2. Seskupení not podle sloupce Program (např. "Podzimní koncert")
  const notyPodleProgramu = {};
  relevantniNoty.forEach(nota => {
    const program = nota.program || 'Ostatní repertoár';
    if (!notyPodleProgramu[program]) notyPodleProgramu[program] = [];
    notyPodleProgramu[program].push(nota);
  });

  // 3. Generování HTML obsahu
  let html = '';
  for (const [program, noty] of Object.entries(notyPodleProgramu)) {
    
    // Sestavení textu pro odeslání všech odkazů na e-mail
    let emailPredmet = encodeURIComponent(`Noty TSO Bolech - ${program}`);
    let emailTelo = `Dobrý den,\n\nzasílám odkazy na noty pro program: ${program} (Part: ${nastrojUzivatele}).\n\n`;
    noty.forEach(n => {
      emailTelo += `- ${n.skladba}:\n  ${n.odkaz}\n\n`;
    });
    emailTelo += `V aplikaci získáte další informace.\nPortál TSO Bolech`;
    let mailtoOdkaz = `mailto:?subject=${emailPredmet}&body=${encodeURIComponent(emailTelo)}`;

    // Hlavička programu a tlačítko na e-mail
    html += `
      <div class="program-header">
        <h3 class="program-title">${program}</h3>
        <a href="${mailtoOdkaz}" class="email-btn">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
          Na e-mail
        </a>
      </div>`;
      
    // Seznam skladeb v daném programu
    noty.forEach(nota => {
      html += `
        <div class="nota-card">
          <div class="nota-info">
            <h4>${nota.skladba}</h4>
            <span>${nota.sekce}</span>
          </div>
          <a href="${nota.odkaz}" target="_blank" class="nota-open-btn">
            Otevřít
          </a>
        </div>
      `;
    });
  }
  
  kontejner.innerHTML = html;
}

// --- VYKRESLOVÁNÍ POZNÁMKY S HARMONOGRAMEM ---
function formatPoznamkaHtml(rawNote) {
  if (!rawNote) return '';
  if (!rawNote.includes('===HARMONOGRAM===')) {
    return `<div class="oznameni-text" style="margin-top:12px;">${escapeHtml(rawNote)}</div>`;
  }
  
  let parts = rawNote.split('===HARMONOGRAM===');
  let mainNote = escapeHtml(parts[0].trim());
  let sData = parts[1].trim();
  let html = '';
  
  if(mainNote) html += `<div class="oznameni-text" style="margin-top:12px;">${mainNote}</div>`;
  
  if (sData) {
    // Odstraněn rámeček a pozadí. Přidána pouze horní přerušovaná čára, zvětšeno písmo nadpisu (18px) a tabulky (16px).
    html += `<div style="margin-top:20px; padding-top:16px; border-top: 1px dashed var(--border);">
        <h4 style="margin-top:0; margin-bottom:12px; font-size:18px; color:var(--text);">⏱️ Časový plán</h4>
        <table style="width:100%; border-collapse: collapse; font-size:16px;">`;
    sData.split('\n').forEach((line, index, arr) => {
        let p = line.split('|');
        let time = escapeHtml(p[0]||'').trim();
        let desc = escapeHtml(p[1]||'').trim().replace(/\[BR\]/g, '<br>');
        let borderObj = (index === arr.length - 1) ? 'none' : '1px solid var(--border)';
        
        // Zvětšený vertikální padding buněk pro lepší čitelnost větších písmen
        html += `<tr>
            <td style="padding:8px 12px 8px 0; vertical-align:top; text-align:right; border-bottom:${borderObj}; white-space:nowrap; font-weight:bold; width:1%; color:var(--text);">${time}</td>
            <td style="padding:8px 0; vertical-align:top; border-bottom:${borderObj}; color:var(--text);">${desc}</td>
        </tr>`;
    });
    html += `</table></div>`;
  }
  return html;
}


function renderEvents() {
  const cont = document.getElementById("eventsContainer"); cont.innerHTML = "";
  const archCont = document.getElementById("archiveContainer"); archCont.innerHTML = "";
  const userRole = String(user.role||"").trim().toLowerCase();
  const isVedení = userRole !== "" && userRole !== "-";
  
  if (isVedení) {
    cont.innerHTML += `<button class="btn" style="background:var(--success); margin-bottom:16px;" onclick="openAkceForm()">➕ Přidat novou akci / informaci</button>`;
  }

  const vsechnyViditelne = appData.akce.filter(a => isEventVisibleForUser(a));
  
  const aktivniOznameni = vsechnyViditelne.filter(a => a.typ === 'Oznámení' || a.typ === 'Informace').sort((a,b) => parseDate(b.datum) - parseDate(a.datum));
  const akceNorm = vsechnyViditelne.filter(a => !a.typ.includes('Oznámení') && !a.typ.includes('Informace')).sort((a,b) => parseDate(b.datum) - parseDate(a.datum));
  const archiv = vsechnyViditelne.filter(a => a.typ === 'Oznámení (Archiv)' || a.typ === 'Informace (Infoarchiv)').sort((a,b) => parseDate(b.datum) - parseDate(a.datum));

  aktivniOznameni.forEach(a => cont.innerHTML += generateOznameniHtml(a, isVedení));
  
  if(akceNorm.length === 0 && aktivniOznameni.length === 0) {
    cont.innerHTML += `<div style="text-align:center; padding:40px; color:var(--text-muted);">Zatím nejsou naplánovány žádné akce.</div>`;
  } else {
    akceNorm.forEach(a => cont.innerHTML += generateAkceHtml(a, isVedení));
  }

  if(archiv.length === 0) archCont.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">Infoarchiv je prázdný.</div>`;
  else archiv.forEach(a => archCont.innerHTML += generateOznameniHtml(a, isVedení, true));
}

function generateAkceHtml(akce, isVedení) {
  const myVote = (appData.ucast||[]).find(u => String(u.akceId) === String(akce.id) && u.jmeno === user.name);
  let barClass = 'bar-tutti';
  if(akce.typ === 'Koncert') barClass = 'bar-koncert';
  else if(akce.typ === 'Generálka') barClass = 'bar-generalka';
  else if(akce.typ === 'Zkouška smyčců') barClass = 'bar-zkouska-smycce';
  else if(akce.typ === 'Zkouška dechů') barClass = 'bar-zkouska-dechy';
  
  let editBtn = isVedení ? `<button class="edit-btn" onclick='openAkceForm(${JSON.stringify(akce).replace(/'/g, "&#39;")})'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>` : "";

  return `
    <div class="card">
      <div class="card-top-bar ${barClass}"><span>${akce.typ}</span><span>🗓️ ${akce.datum}</span></div>
      <div class="card-body">
        <div class="card-title-row"><div class="card-title">${akce.nazev}</div>${editBtn}</div>
        ${akce.misto ? `<p style="margin-bottom:6px;">📍 ${akce.misto}</p>` : ''}
        <p style="margin-bottom:6px;">🕒 Začátek: <strong>${akce.casOd}</strong></p>
        ${akce.casSrazu ? `<p style="margin-bottom:6px;">⏰ Sraz: <strong>${akce.casSrazu}</strong></p>` : ''}
        ${akce.zacatekGeneralky ? `<p style="margin-bottom:6px;">🎻 Generálka: <strong>${akce.zacatekGeneralky}</strong></p>` : ''}
        ${akce.damy ? `<p style="margin-bottom:6px;">👗 Dámy: ${akce.damy}</p>` : ''}
        ${akce.pani ? `<p style="margin-bottom:6px;">🤵 Páni: ${akce.pani}</p>` : ''}
        ${formatPoznamkaHtml(akce.poznamka)}
        <div class="att-buttons" style="margin-top:16px;">
          <button class="btn-att ${myVote?.stav==='Ano'?'selected-ano':''}" onclick="submitUcast('${akce.id}','${akce.datum}','Ano',this)">✓ Účastním se</button>
          <button class="btn-att ${myVote?.stav==='Ne'?'selected-ne':''}" onclick="submitUcast('${akce.id}','${akce.datum}','Ne',this)">✕ Neúčastním</button>
        </div>
        <div id="duvod-${akce.id}" class="duvod-box" style="display:${myVote?.stav==='Ne'&&!myVote?.duvod?'block':'none'}">
          <input type="text" id="in-${akce.id}" placeholder="Důvod neúčasti" class="modal-input" style="margin-bottom:12px;">
          <button class="btn" onclick="saveDuvod('${akce.id}','${akce.datum}',this)">Odeslat důvod</button>
        </div>
        <div id="roster-container-${akce.id}">${generateRosterHtml(akce.id)}</div>
      </div>
    </div>`;
}

function generateOznameniHtml(akce, isVedení, isArchiv = false) {
  let editBtn = isVedení ? `<button class="edit-btn" onclick='openAkceForm(${JSON.stringify(akce).replace(/'/g, "&#39;")})'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>` : "";
  
  let akceBtn = "";
  if (isVedení) {
    if (!isArchiv) {
      akceBtn = `<button class="btn" style="background:transparent; color:var(--text-muted); border:1px solid var(--border); padding:8px; margin-top:16px; font-size:14px;" onclick="archivovatOznameni('${akce.id}')">🗃️ Přesunout do infoarchivu</button>`;
    } else {
      akceBtn = `<button class="btn" style="background:transparent; color:var(--primary-light); border:1px solid var(--primary-light); padding:8px; margin-top:16px; font-size:14px;" onclick="obnovitOznameni('${akce.id}')">↩️ Vrátit zpět na hlavní stránku</button>`;
    }
  }
  
  return `
    <div class="card card-oznameni">
      <div class="card-top-bar bar-oznameni"><span>💡 Informace</span><span>🗓️ ${akce.datum}</span></div>
      <div class="card-body" style="padding-top:12px;">
        <div class="card-title-row" style="margin-bottom:4px;"><div class="card-title" style="font-size:20px;">${akce.nazev}</div>${editBtn}</div>
        ${formatPoznamkaHtml(akce.poznamka)}
        ${akceBtn}
      </div>
    </div>`;
}

function archivovatOznameni(akceId) {
  if(confirm("Přesunout tuto informaci do infoarchivu? Zmizí z hlavní stránky.")) {
    const akce = appData.akce.find(a => String(a.id) === String(akceId));
    if(!akce) return;
    akce.typ = 'Informace (Infoarchiv)';
    runGoogleScript("saveAkce", akce).then(res => {
      if(res.success) { localStorage.setItem("bolech_data_cache", JSON.stringify(appData)); renderEvents(); }
    });
  }
}

function obnovitOznameni(akceId) {
  const akce = appData.akce.find(a => String(a.id) === String(akceId));
  if(!akce) return;
  akce.typ = 'Informace';
  runGoogleScript("saveAkce", akce).then(res => {
    if(res.success) { localStorage.setItem("bolech_data_cache", JSON.stringify(appData)); renderEvents(); }
  });
}

function generateRosterHtml(akceId) {
  const potvrdili = (appData.ucast || []).filter(u => String(u.akceId) === String(akceId) && u.stav === 'Ano');
  const grouped = {};
  potvrdili.forEach(p => {
    let hracSekce = String(p.sekce || "Ostatní").trim().toLowerCase();
    let nalezenaSekce = PARTITURA_SECTIONS.find(s => s.toLowerCase().includes(hracSekce) || hracSekce.includes(s.toLowerCase())) || "Ostatní / Hosté";
    if (!grouped[nalezenaSekce]) grouped[nalezenaSekce] = [];
    grouped[nalezenaSekce].push(p.jmeno);
  });
  let html = `<button class="roster-toggle" onclick="toggleRoster('${akceId}')"><span>👥 Přihlášeno (${potvrdili.length})</span><span id="arrow-${akceId}">▼</span></button><div id="content-${akceId}" class="roster-content">`;
  PARTITURA_SECTIONS.forEach(s => { if (grouped[s]) html += `<div class="roster-section"><div class="roster-section-title">${s}</div><div class="roster-members">${grouped[s].join(', ')}</div></div>`; });
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
  const origText = btn.innerText; btn.innerText = "Ukládám...";
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
      localStorage.setItem("bolech_data_cache", JSON.stringify(appData));
    }
  });
}

function saveDuvod(id, datum, btn) { 
  const duvod = document.getElementById('in-'+id).value; btn.innerText = "Ukládám...";
  runGoogleScript("saveUcast", {akceId: id, datumAkce: datum, jmeno: user.name, sekce: user.section, stav: 'Ne', duvod: duvod})
  .then(res => {
    btn.innerText = "Odeslat důvod";
    if(res.success) { document.getElementById('duvod-'+id).style.display = 'none'; }
  });
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).trim().split('.');
  if (parts.length === 3) {
    const d = parts[0].trim().padStart(2, '0');
    const m = parts[1].trim().padStart(2, '0');
    const y = parts[2].trim();
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

function formatDateForSave(isoDate) {
  if (!isoDate) return "";
  const parts = String(isoDate).split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  }
  return isoDate;
}

// --- PŘIDÁVÁNÍ ŘÁDKŮ HARMONOGRAMU ---
function addScheduleRow(time = '', desc = '') {
  const cont = document.getElementById('schedule-rows');
  if (!cont) return;
  const div = document.createElement('div');
  div.style = 'border: 1px dashed var(--border); padding: 8px; margin-bottom: 8px; border-radius: 6px; position: relative;';
  div.innerHTML = `
    <button type="button" style="position: absolute; top: 8px; right: 8px; background: transparent; border: 1px solid var(--danger); border-radius: 4px; color: var(--danger); font-size: 12px; padding: 2px 6px;" onclick="this.parentElement.remove()">✕</button>
    <div style="margin-top: 20px;">
        <label style="font-size: 12px; display: block; margin-bottom: 2px;">Čas (od - do):</label>
        <input type="text" class="modal-input sched-time" placeholder="např. 10:00 - 12:30" value="${escapeHtml(time)}" style="margin-bottom: 6px; padding: 6px 8px; font-size: 14px;">
        <label style="font-size: 12px; display: block; margin-bottom: 2px;">Popis programu:</label>
        <textarea class="modal-input sched-desc" placeholder="např. Dopolední zkouška" rows="2" style="padding: 6px 8px; font-size: 14px; min-height: 50px; resize: vertical;">${escapeHtml(desc).replace(/\[BR\]/g, '\n')}</textarea>
    </div>
  `;
  cont.appendChild(div);
}

function openAkceForm(akce = null) {
  const isEdit = akce !== null;
  const selectDisabledAttr = isEdit ? 'disabled style="background: var(--bg); opacity: 0.8;"' : '';
  const formDateValue = formatDateForInput(akce?.datum || '');
  
  // Rozšifrování dat pro editaci (oddělení textu a harmonogramu)
  let rawNote = akce?.poznamka || '';
  let mainNote = rawNote;
  let scheduleLines = [];
  
  if (rawNote.includes('===HARMONOGRAM===')) {
    let parts = rawNote.split('===HARMONOGRAM===');
    mainNote = parts[0].trim();
    let sData = parts[1].trim();
    if (sData) {
      scheduleLines = sData.split('\n').map(line => {
        let p = line.split('|');
        return { time: p[0]||'', desc: p[1]||'' };
      });
    }
  }

  const html = `
    <div id="akceModal" class="modal-overlay">
      <div class="modal-box" style="max-height: 90vh; overflow-y: auto;">
        <h3 style="margin-bottom:16px; font-size:24px;">${isEdit ? 'Úprava položky' : 'Nová položka'}</h3>
        <form id="editAkceForm" onsubmit="submitAkceForm(event, '${isEdit ? escapeHtml(akce.id) : ''}')">
          
          <label>Typ:</label>
          <select id="f_typ" class="modal-input" onchange="toggleAkceFields()" ${selectDisabledAttr}>
            <option value="Tutti zkouška" ${akce?.typ==='Tutti zkouška'?'selected':''}>Tutti zkouška</option>
            <option value="Zkouška smyčců" ${akce?.typ==='Zkouška smyčců'?'selected':''}>Zkouška smyčců</option>
            <option value="Zkouška dechů" ${akce?.typ==='Zkouška dechů'?'selected':''}>Zkouška dechů</option>
            <option value="Generálka" ${akce?.typ==='Generálka'?'selected':''}>Generálka</option>
            <option value="Koncert" ${akce?.typ==='Koncert'?'selected':''}>Koncert</option>
            <option value="Informace" ${(akce?.typ==='Informace' || akce?.typ==='Oznámení') ? 'selected' : ''}>Informace</option>
            <option value="Informace (Infoarchiv)" ${(akce?.typ==='Informace (Infoarchiv)' || akce?.typ==='Oznámení (Archiv)') ? 'selected' : ''}>Informace (Infoarchiv)</option>
          </select>

          <label>Název / Nadpis oznámení:</label>
          <input type="text" id="f_nazev" value="${escapeHtml(akce?.nazev||'')}" required class="modal-input">

          <div style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Datum:</label>
              <input type="date" id="f_datum" value="${escapeHtml(formDateValue)}" required class="modal-input">
            </div>
            <div id="col_casOd" style="flex:1;">
              <label>Čas od:</label>
              <input type="time" id="f_casOd" value="${escapeHtml(akce?.casOd||'')}" class="modal-input">
            </div>
          </div>

          <div id="row_misto" style="display:block;">
            <label>Místo:</label>
            <input type="text" id="f_misto" value="${escapeHtml(akce?.misto||'')}" class="modal-input">
          </div>

          <div id="row_casy" style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Čas srazu:</label>
              <input type="time" id="f_casSrazu" value="${escapeHtml(akce?.casSrazu||'')}" class="modal-input">
            </div>
            <div id="col_generalka" style="flex:1;">
              <label>Čas generálky:</label>
              <input type="time" id="f_zacatekGeneralky" value="${escapeHtml(akce?.zacatekGeneralky||'')}" class="modal-input">
            </div>
          </div>

          <div id="row_obleceni" style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Dámy (oděv):</label>
              <input type="text" id="f_damy" value="${escapeHtml(akce?.damy||'')}" class="modal-input">
            </div>
            <div style="flex:1;">
              <label>Páni (oděv):</label>
              <input type="text" id="f_pani" value="${escapeHtml(akce?.pani||'')}" class="modal-input">
            </div>
          </div>

          <label>Hlavní text (Poznámka):</label>
          <textarea id="f_poznamka" class="modal-input" style="min-height:160px; resize:vertical;">${escapeHtml(mainNote)}</textarea>

          <!-- Sekce pro harmonogram -->
          <div style="margin-top: 16px; background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
              <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                  <span style="font-weight:bold; color:var(--text);">⏱️ Připojit časový plán</span>
                  <button type="button" class="btn" style="padding:6px 12px; font-size:13px; background:var(--primary-light);" onclick="addScheduleRow()">➕ Přidat políčko</button>
              </label>
              <div id="schedule-rows"></div>
          </div>

          <div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">
            <button type="submit" id="btnSaveModal" class="btn" style="flex:1; min-width:120px;">Uložit</button>
            <button type="button" class="btn" style="background:var(--border); color:var(--text); flex:1; min-width:120px;" onclick="document.getElementById('akceModal').remove()">Zrušit</button>
            ${isEdit ? `<button type="button" class="btn" style="background:var(--danger); color:white; width:100%; margin-top:8px;" onclick="deleteAkcePrompt('${escapeHtml(akce.id)}')">🗑 Smazat položku</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  toggleAkceFields(); 
  
  // Pokud už editujeme existující harmonogram, vložíme mu jeho řádky
  scheduleLines.forEach(s => addScheduleRow(s.time, s.desc));
}

function toggleAkceFields() {
  const typ = document.getElementById('f_typ').value;
  const jeOznameni = typ.includes('Oznámení') || typ.includes('Informace');
  const jeZkouska = typ.includes('zkouška') || typ.includes('Zkouška');
  
  document.getElementById('row_misto').style.display = jeOznameni ? 'none' : 'block';
  document.getElementById('col_casOd').style.display = jeOznameni ? 'none' : 'block';
  document.getElementById('row_casy').style.display = (jeZkouska || jeOznameni) ? 'none' : 'flex';
  document.getElementById('row_obleceni').style.display = (typ === 'Koncert') ? 'flex' : 'none';
  document.getElementById('col_generalka').style.display = (typ === 'Koncert') ? 'block' : 'none';
}

function submitAkceForm(e, akceId) {
  e.preventDefault();
  document.getElementById('btnSaveModal').innerText = "Ukládám...";
  
  const typ = document.getElementById('f_typ').value;
  const jeOznameni = typ.includes('Oznámení') || typ.includes('Informace');
  const jeZkouska = typ.includes('zkouška') || typ.includes('Zkouška');
  const finalId = akceId || generovatIdAkce(typ);

  // Zpracování dat z harmonogramu zpět do textu
  let finalPoznamka = document.getElementById('f_poznamka').value.trim();
  const schedTimes = document.querySelectorAll('.sched-time');
  const schedDescs = document.querySelectorAll('.sched-desc');
  let schedText = "";
  
  for(let i = 0; i < schedTimes.length; i++) {
    let t = schedTimes[i].value.trim();
    // Skryté uložení Entrů z velkého textového pole
    let d = schedDescs[i].value.trim().replace(/\n/g, '[BR]');
    if(t || d) schedText += `\n${t}|${d}`;
  }
  
  // Skryté uložení obou věcí do jednoho sloupce v Googlu
  if (schedText !== "") {
    finalPoznamka += `\n\n===HARMONOGRAM===${schedText}`;
  }

  const payload = {
    id: finalId, typ: typ, nazev: document.getElementById('f_nazev').value, 
    datum: formatDateForSave(document.getElementById('f_datum').value), 
    misto: jeOznameni ? "" : document.getElementById('f_misto').value,
    casOd: jeOznameni ? "" : document.getElementById('f_casOd').value,
    casSrazu: (jeZkouska || jeOznameni) ? "" : document.getElementById('f_casSrazu').value,
    zacatekGeneralky: typ !== 'Koncert' ? "" : document.getElementById('f_zacatekGeneralky').value,
    damy: typ !== 'Koncert' ? "" : document.getElementById('f_damy').value, pani: typ !== 'Koncert' ? "" : document.getElementById('f_pani').value,
    poznamka: finalPoznamka
  };
  
  runGoogleScript("saveAkce", payload).then(res => {
    if (res.success) { 
      document.getElementById('akceModal').remove(); 
      localStorage.removeItem("bolech_data_cache");
      initApp(); 
    } 
    else { alert('Chyba: ' + res.error); document.getElementById('btnSaveModal').innerText = "Uložit"; }
  });
}

function deleteAkcePrompt(akceId) {
  if (confirm("Opravdu chcete tuto položku nenávratně smazat z tabulky?")) {
    runGoogleScript("deleteAkce", { id: akceId }).then(res => {
      if (res.success) { 
        document.getElementById('akceModal').remove(); 
        localStorage.removeItem("bolech_data_cache");
        initApp(); 
      } 
      else alert('Chyba při mazání: ' + res.error);
    });
  }
}

function switchTab(t, b) { 
  document.getElementById('tab-events').style.display = t === 'events' ? 'block' : 'none'; 
  document.getElementById('tab-archive').style.display = t === 'archive' ? 'block' : 'none'; 
  document.getElementById('tab-admin-noty').style.display = t === 'admin-noty' ? 'block' : 'none';

  // NOVÉ: Přepínání pro kartu not
  const tabNoty = document.getElementById('tab-sheetmusic');
  if (tabNoty) tabNoty.style.display = t === 'sheetmusic' ? 'block' : 'none'; 

  const tabAdminNoty = document.getElementById('tab-admin-noty');
  if (tabAdminNoty) tabAdminNoty.style.display = t === 'admin-noty' ? 'block' : 'none';
  
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active')); 
  if (b) b.classList.add('active'); 
  
  if (t === 'archive') document.body.classList.add('archive-open');
  else document.body.classList.remove('archive-open');
}

// Globální paměť pro bezpečné ukládání složek
window.stromSlozek = []; 

// --- GENERATOR STROMU PRO VEDENÍ (Vyladěno pro mobily) ---
function vykresliAdminNoty() {
  const cont = document.getElementById('adminNotyContainer');
  if (!cont) return;

  try {
    const slozkyMap = {};

    if (!appData.noty || appData.noty.length === 0) {
      cont.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Archiv je zatím prázdný.</p>';
      return;
    }

    // 1. Roztřídění do složek
    appData.noty.forEach(nota => {
      let skladbaText = String(nota.skladba || '').trim();
      if (!skladbaText) return;

      let lastDash = skladbaText.lastIndexOf(' - ');
      let cesta = lastDash !== -1 ? skladbaText.substring(0, lastDash).trim() : 'Základní složka';
      let soubor = lastDash !== -1 ? skladbaText.substring(lastDash + 3).trim() : skladbaText;

      if (!slozkyMap[cesta]) slozkyMap[cesta] = { cesta: cesta, soubory: [], program: '', aktivni: false };

      slozkyMap[cesta].soubory.push({ ...nota, kratkyNazev: soubor });

      let aktivniHodnota = String(nota.aktivni || '').toUpperCase().trim();
      if (aktivniHodnota === 'ANO' || aktivniHodnota === 'TRUE' || aktivniHodnota === '1') {
        slozkyMap[cesta].aktivni = true;
        if (nota.program) slozkyMap[cesta].program = nota.program;
      }
    });

    // 2. Uložení seřazených složek do bezpečné paměti
    window.stromSlozek = Object.values(slozkyMap).sort((a, b) => a.cesta.localeCompare(b.cesta));

    // 3. Vykreslení mobilního HTML
    let html = '';
    window.stromSlozek.forEach((s, index) => {
      const zobrazenyNazev = escapeHtml(s.cesta).replace(/\//g, '<span style="color:var(--text-muted); margin:0 4px;">❯</span>');
      
      // Barva pozadí checkboxu podle aktivity
      const checkBg = s.aktivni ? 'var(--success)' : 'transparent';

      html += `
        <details class="card" style="margin-bottom: 12px; padding: 0; overflow: hidden; border: 1px solid var(--border);">
          
          <summary style="padding: 12px 14px; cursor: pointer; list-style: none; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--border);">
            
            <!-- 1. Řádek: Dlouhý název složky a indikátor rozevření -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold; color: var(--text);">
              <span style="word-break: break-word; line-height: 1.3;">📁 ${zobrazenyNazev} <small style="font-weight:normal; opacity:0.6;">(${s.soubory.length})</small></span>
              <span style="opacity: 0.4; font-size: 14px; padding-left: 8px;">▼</span>
            </div>

            <!-- 2. Řádek: Vstupy roztažené na celou šířku -->
            <div class="folder-controls" onclick="event.stopPropagation();" style="display: flex; gap: 8px; align-items: center; width: 100%;">
              
              <!-- Políčko programu zabere maximum zbývajícího místa -->
              <input type="text" id="prog_${index}" class="modal-input" placeholder="Název programu..." value="${escapeHtml(s.program)}" style="flex: 1; margin: 0; padding: 10px; font-size: 14px; border-radius: 6px;">
              
              <!-- Velké dotykové tlačítko s checkboxem -->
              <label style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: ${checkBg}; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: background 0.2s;" title="Aktivní">
                <input type="checkbox" id="chk_${index}" ${s.aktivni ? 'checked' : ''} style="transform: scale(1.4); margin: 0; cursor: pointer;" onchange="this.parentElement.style.background = this.checked ? 'var(--success)' : 'transparent';">
              </label>

            </div>
          </summary>
          
          <!-- Seznam skladeb (zarovnaný ke krajům pro úsporu místa) -->
          <div class="folder-content" style="padding: 10px; display: flex; flex-direction: column; gap: 6px; background: var(--bg);">
            ${s.soubory.map(soub => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card, transparent);">
                <span style="font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 12px; color: var(--text);">📄 ${escapeHtml(soub.kratkyNazev)}</span>
                <span style="font-size: 11px; opacity: 0.8; white-space: nowrap; background: var(--border); padding: 4px 6px; border-radius: 4px; color: var(--text);">${escapeHtml(String(soub.sekce||''))}</span>
              </div>
            `).join('')}
          </div>

        </details>
      `;
    });

    cont.innerHTML = html;

  } catch (error) {
    cont.innerHTML = `<p style="color:var(--danger); padding:16px;">Chyba: ${error.message}</p>`;
  }
}

// --- ULOŽENÍ ZMĚN NA GOOGLE ---
function ulozitZmenyNot(e) {
  // 1. ZÁZRAČNÁ OPRAVA: Zabráníme prohlížeči, aby při kliknutí obnovil stránku!
  const eventObj = e || window.event;
  if (eventObj && eventObj.preventDefault) {
    eventObj.preventDefault();
  }

  // 2. Bezpečné nalezení tlačítka (i kdyby uživatel klikl na ikonku uvnitř)
  const button = eventObj ? (eventObj.currentTarget || eventObj.target) : null;
  if (button) {
    button.innerText = "⏳ Ukládám změny...";
    button.disabled = true;
  }

  const zmeny = [];

  // Projdeme pouze naši očíslovanou paměť, žádné zmatky v textech
  window.stromSlozek.forEach((s, index) => {
    const chk = document.getElementById('chk_' + index);
    const inputProg = document.getElementById('prog_' + index);

    if (chk && inputProg) {
      const novaAktivni = chk.checked;
      const novyProgram = inputProg.value.trim();

      // Pokud se u složky opravdu něco změnilo oproti původnímu stavu
      if (s.aktivni !== novaAktivni || s.program !== novyProgram) {
        const stavText = novaAktivni ? 'ANO' : '';

        s.soubory.forEach(soubor => {
          zmeny.push({
            odkaz: soubor.odkaz,
            aktivni: stavText,
            program: novyProgram
          });
        });
      }
    }
  });

  // Pokud se nic nezměnilo, ani nevoláme Google
  if (zmeny.length === 0) {
    alert("Nebyly provedeny žádné změny.");
    if (button) {
      button.disabled = false;
      button.innerText = "💾 Uložit všechny změny";
    }
    return;
  }

  // Odeslání
  runGoogleScript("updateNotyHromadne", { zmeny: zmeny }).then(res => {
    if (button) {
      button.disabled = false;
      button.innerText = "💾 Uložit všechny změny";
    }
    if (res.success) {
      alert("Změny v archivu byly úspěšně uloženy.");
      // Vymažeme paměť, aby aplikace stáhla čerstvá data
      localStorage.removeItem("bolech_data_cache");
      // Spustíme kompletní znovunačtení
      initApp(); 
    } else {
      alert("Chyba při ukládání: " + res.error);
    }
  });
}

function confirmLogout() { 
  if(confirm("Opravdu se chcete odhlásit?")) { localStorage.removeItem('bolech_auth_member'); localStorage.removeItem('bolech_data_cache'); location.reload(); } 
}
