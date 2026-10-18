/* Shared state helpers, also exercised by Node's built-in test runner. */
(function () {
  'use strict';
  function entityKey(id) {
    return String(id || '').replace(/^(?:text_sensor|binary_sensor|sensor|button)[/-]/, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function numeric(value) {
    if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function reading(model, key, now) {
    const entry = model[key];
    const value = numeric(entry && entry.value);
    const age = model.can_datenalter;
    const canAge = numeric(age && age.value);
    const stale = !entry || value === null || now - entry.at > 60000 ||
      !age || canAge === null || now - age.at > 30000 || canAge > 30;
    return {value, stale};
  }
  function format(value, decimals) {
    return value === null || !Number.isFinite(value) ? '—' : value.toLocaleString('de-DE', {
      minimumFractionDigits:decimals, maximumFractionDigits:decimals
    });
  }
  async function restartRequest(preview, fetcher) {
    if (preview) return 'preview';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetcher('/button/ESP%20neu%20starten/press', {
        method:'POST', credentials:'same-origin', signal:controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return 'requested';
    } finally { clearTimeout(timer); }
  }
  function eventReading(model, key, connected, requiresCan, now) {
    const entry=model[key],value=entry?entry.value:null;
    return {value,stale:!connected || !entry || value===null || value===undefined || value==='' ||
      value==='Keine Daten' || (requiresCan && reading(model,'can_datenalter',now).stale)};
  }
  function bindPageLifecycle(page, stop) {
    page.addEventListener('pagehide',stop,{once:true});
    page.addEventListener('pageshow',event=>{if(event.persisted)page.location.reload();});
  }
  const api = {entityKey, numeric, reading, format, eventReading, bindPageLifecycle, restartRequest};
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof window !== 'undefined') window.PyromatDashboard = api;
})();

(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const {entityKey,numeric,reading,format,eventReading,bindPageLifecycle,restartRequest} = window.PyromatDashboard;
  const preview = document.documentElement.dataset.preview === 'true';
  const model = Object.create(null);
  const fields = {
    kesseltemperatur:['Kesseltemperatur','°C',1], kesseltemperatur_soll:['Kesseltemperatur Soll','°C',1],
    abgastemperatur:['Abgastemperatur','°C',1], kesselruecklauf:['Kesselrücklauf','°C',1],
    systemtemperatur:['Systemtemperatur','°C',1], puffer_oben:['Puffer oben','°C',1],
    puffer_mitte:['Puffer Mitte','°C',1], puffer_unten:['Puffer unten','°C',1], heizungsvorlauf:['Heizungsvorlauf','°C',1],
    restsauerstoff:['Restsauerstoff','%',1], restsauerstoff_soll_kandidat:['Restsauerstoff Soll','%',1,'candidate'],
    luefterdrehzahl:['Lüfterdrehzahl','rpm',0], primaerluftklappe:['Primärluftklappe','%',0], sekundaerluftklappe:['Sekundärluftklappe','%',0],
    ventil_ruecklaufmischer_rohwert:['Rücklaufmischer · Rohwert','',0,'raw'], ventil_puffer_rohwert:['Pufferventil · Rohwert','',0,'raw'],
    register_0117_wert_1:['Register 0x0117 · Wert 1','',0,'raw'], register_0117_wert_2:['Register 0x0117 · Wert 2','',0,'raw'],
    betriebsstatus_rohwert:['Betriebsstatus · Rohwert','',0,'raw'], kesseluhr:['Kesseluhr','','text'],
    kesseldatum:['Kesseldatum','','text'], kesselwochentag:['Wochentag','','text'],
    can_datenalter:['Letztes CAN-Telegramm','s',0,'system'], can_telegramme:['Empfangene Telegramme','',0,'system'],
    wlan_signal:['WLAN-Signal','dBm',0,'system'], betriebszeit:['Betriebszeit','s',0,'system'],
    ip_adresse:['IP-Adresse','','text','system'], wlan_name:['WLAN','','text','system'],
    can_empfang:['CAN-Empfang','','binary'], wlan_verbindung:['WLAN-Verbindung','','binary','system']
  };
  const icons = {
    home:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    pulse:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    restart:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    temperature:'<path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/>',
    flame:'<path d="M13 3c1 5-4 5-3 9 1-1 2-2 3-2 0 3 4 3 4 6a5 5 0 0 1-10 0c0-5 0-8 6-13Z"/>',
    air:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h17M3 16h10a3 3 0 1 1-3 3"/>',
    fan:'<circle cx="12" cy="12" r="2"/><path d="M10 10C3 2 17 0 14 10m0 2c10-3 6 11-1 3m-2-1c-2 10-13 0-3-2"/>'
  };
  const icon = key => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[key]+'</svg>';
  const value = key => '<span data-value="'+key+'">—</span>';
  const row = key => '<div class="row"><span class="row-name">'+fields[key][0]+(fields[key][3]==='candidate'?'<span class="candidate">Zuordnung prüfen</span>':'')+'</span><span class="row-value">'+value(key)+'<small>'+fields[key][1]+'</small></span></div>';
  const panel = (title,keys,subtitle='') => '<section class="panel"><div class="panel-head"><div><h2>'+title+'</h2>'+(subtitle?'<p>'+subtitle+'</p>':'')+'</div></div><div class="rows">'+keys.map(row).join('')+'</div></section>';
  const metric = (key,foot,tone,symbol) => '<section class="metric" data-tone="'+tone+'"><div class="metric-label">'+fields[key][0]+icon(symbol)+'</div><div class="metric-value">'+value(key)+'<small>'+fields[key][1]+'</small></div><div class="metric-foot"><span class="dot"></span><span data-freshness="'+key+'">'+foot+'</span></div></section>';
  const diagram = `<svg viewBox="0 0 900 365" role="img" aria-labelledby="hydraulic-title hydraulic-desc">
    <title id="hydraulic-title">Kessel, Pufferspeicher und Heizkreis</title><desc id="hydraulic-desc">Vereinfachtes Hydraulikschema mit den empfangenen Temperaturwerten. Kein verbindlicher Anlagenplan.</desc>
    <defs><linearGradient id="tank-gradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e8b18b"/><stop offset=".52" stop-color="#e8d2ac"/><stop offset="1" stop-color="#a3bec3"/></linearGradient></defs>
    <path class="diagram-pipe-hot" d="M239 129H399M517 99H732V129"/><path class="diagram-pipe-cold" d="M239 276H399M517 276H794V232"/>
    <path d="m309 124 8 5-8 5m305-40 8 5-8 5" fill="none" stroke="#ce8259" stroke-width="2"/><path d="m327 271-8 5 8 5m312-5-8 5 8 5" fill="none" stroke="#7097ad" stroke-width="2"/>
    <text x="160" y="39" text-anchor="middle" class="diagram-label">PYROMAT ECO</text><text x="459" y="39" text-anchor="middle" class="diagram-label">PUFFERSPEICHER</text><text x="761" y="39" text-anchor="middle" class="diagram-label">HEIZKREIS</text>
    <rect x="81" y="70" width="159" height="238" rx="13" fill="#344b3e"/><rect x="91" y="80" width="139" height="218" rx="9" fill="#3e5747"/>
    <rect x="107" y="99" width="106" height="40" rx="5" fill="#293d31"/><text x="160" y="124" text-anchor="middle" fill="#eaf1df" style="fill:#eaf1df;font-size:20px" class="diagram-value" data-value="kesseltemperatur">—</text>
    <rect x="107" y="155" width="106" height="99" rx="7" fill="#2c4033" stroke="#6d8270" stroke-width="1"/><path d="M163 178c3 14-15 17-7 30 1-5 6-8 8-10 0 7 9 10 9 17a15 15 0 0 1-30 0c0-13 6-26 20-37Z" fill="#d5a479" opacity=".9"/>
    <path d="M146 270h29" stroke="#a4b39b" stroke-width="3" stroke-linecap="round"/><rect x="99" y="307" width="15" height="7" rx="2" fill="#293d31"/><rect x="207" y="307" width="15" height="7" rx="2" fill="#293d31"/>
    <rect x="399" y="68" width="118" height="245" rx="35" fill="url(#tank-gradient)" stroke="#c9c8b3"/><path d="M405 148h106M405 231h106" stroke="#fff" stroke-opacity=".5" stroke-dasharray="3 5"/>
    <rect x="426" y="86" width="64" height="24" rx="5" fill="#ffffff7a"/><text x="458" y="102" text-anchor="middle" style="font-size:12px" class="diagram-value" data-value="puffer_oben">—</text>
    <rect x="426" y="178" width="64" height="24" rx="5" fill="#ffffff7a"/><text x="458" y="194" text-anchor="middle" style="font-size:12px" class="diagram-value" data-value="puffer_mitte">—</text>
    <rect x="426" y="270" width="64" height="24" rx="5" fill="#ffffff7a"/><text x="458" y="286" text-anchor="middle" style="font-size:12px" class="diagram-value" data-value="puffer_unten">—</text>
    <text x="459" y="128" text-anchor="middle" class="diagram-note diagram-tank-label">OBEN · °C</text><text x="459" y="219" text-anchor="middle" class="diagram-note diagram-tank-label">MITTE · °C</text><text x="459" y="334" text-anchor="middle" class="diagram-note diagram-tank-label">UNTEN · °C</text>
    <rect x="711" y="130" width="105" height="102" rx="8" fill="var(--soft)" stroke="#a4b09e" stroke-width="2"/><path d="M730 143v75m20-75v75m20-75v75m20-75v75" stroke="#b9c3b0" stroke-width="7" stroke-linecap="round"/>
    <rect x="268" y="75" width="103" height="36" rx="7" class="diagram-chip"/><text x="319" y="98" text-anchor="middle" class="diagram-value" style="font-size:13px" data-value="kesseltemperatur">—</text><text x="319" y="63" text-anchor="middle" class="diagram-note diagram-muted">KESSEL · °C</text>
    <rect x="268" y="296" width="103" height="36" rx="7" class="diagram-chip"/><text x="319" y="319" text-anchor="middle" class="diagram-value" style="font-size:13px" data-value="kesselruecklauf">—</text><text x="319" y="350" text-anchor="middle" class="diagram-note diagram-muted">RÜCKLAUF · °C</text>
    <rect x="600" y="47" width="103" height="36" rx="7" class="diagram-chip"/><text x="652" y="70" text-anchor="middle" class="diagram-value" style="font-size:13px" data-value="heizungsvorlauf">—</text><text x="652" y="31" text-anchor="middle" class="diagram-note diagram-muted">VORLAUF · °C</text>
    </svg>`;
  document.documentElement.lang='de';
  document.title='Pyromat Eco · Anlagenübersicht';
  if (!document.querySelector('meta[name=viewport]')) {
    const meta=document.createElement('meta');meta.name='viewport';meta.content='width=device-width, initial-scale=1';document.head.append(meta);
  }
  const shell=document.createElement('div');
  shell.innerHTML=(preview?`<div class="preview-banner"><strong>VORSCHAU · Beispieldaten</strong><span>Keine Verbindung zu einem Kessel</span><button data-demo="live" aria-pressed="true">Beispieldaten</button><button data-demo="empty" aria-pressed="false">Ohne Daten</button><button data-demo="offline" aria-pressed="false">Verbindungsausfall</button></div>`:'')+`
    <aside class="sidebar"><div class="brand"><div class="brand-mark">${icon('flame')}</div><div><strong>pyromat</strong><small>ECOTRONIC MONITOR</small></div></div><div class="nav-label">DEINE ANLAGE</div>
    <nav class="nav" role="tablist" aria-label="Ansichten"><button id="tab-overview" role="tab" aria-selected="true" aria-controls="view-overview" data-tab="overview">${icon('home')}Übersicht</button><button id="tab-values" role="tab" aria-selected="false" aria-controls="view-values" data-tab="values">${icon('list')}Alle Werte</button><button id="tab-diagnostics" role="tab" aria-selected="false" aria-controls="view-diagnostics" data-tab="diagnostics">${icon('pulse')}Diagnose</button></nav>
    <div class="sidebar-bottom"><div class="device-label"><b>Lokale Verbindung</b>ESP32 · CAN · ESPHome</div><div class="version">PYROMAT ESPHOME · 2.0</div></div></aside>
    <main class="layout"><header class="header"><div><div class="eyebrow">DEIN HEIZRAUM. DIREKT VERBUNDEN.</div><h1 id="device-title">Pyromat Eco</h1><p>Wärme, Temperaturen und Zustände auf einen Blick.</p></div><div class="header-actions"><button id="theme-button" class="icon-button" aria-label="Darstellung wechseln" title="Hell / Dunkel">${icon('sun')}</button><button id="restart-button" class="button" aria-label="ESP neu starten" title="ESP neu starten" disabled>${icon('restart')}<span class="restart-label">ESP neu starten</span></button></div></header>
    <div class="status-strip" aria-live="polite"><span class="badge" id="connection-badge"><span class="dot"></span><span id="connection-label">Verbindung wird aufgebaut</span></span><span class="badge" id="can-badge"><span class="dot"></span><span id="can-label">Warte auf CAN-Daten</span></span><span class="status-right">Letztes CAN-Telegramm: <span data-value="can_datenalter">—</span> s</span></div>
    <div class="view" role="tabpanel" aria-labelledby="tab-overview" id="view-overview"><div class="metrics">${metric('kesseltemperatur','Empfangener Messwert','warm','temperature')}${metric('abgastemperatur','Empfangener Messwert','neutral','flame')}${metric('restsauerstoff','Empfangener Messwert','green','air')}${metric('luefterdrehzahl','Empfangener Messwert','blue','fan')}</div>
    <section class="panel hydraulic"><div class="panel-head"><div><h2>Anlagenübersicht</h2><p>Kessel, Pufferspeicher und Heizkreis</p></div><span class="badge">HYDRAULIKSCHEMA</span></div><div class="hydraulic-body">${diagram}</div><div class="hydraulic-foot"><div class="legend"><span><i></i>Vorlauf</span><span><i class="cold"></i>Rücklauf</span></div><p>Schematische Darstellung · Temperaturen aus dem CAN-Bus</p></div></section>
    <div class="bottom-grid"><section class="panel"><div class="panel-head"><h2>Verbrennung &amp; Luft</h2></div><div class="rows">${['primaerluftklappe','sekundaerluftklappe'].map(key=>'<div class="row bar-row"><span class="row-name">'+fields[key][0]+'</span><div class="bar"><i data-bar="'+key+'"></i></div><span class="row-value">'+value(key)+'<small>%</small></span></div>').join('')}${row('kesseltemperatur_soll')}${row('restsauerstoff_soll_kandidat')}</div></section>
    <section class="panel"><div class="panel-head"><h2>Kesseluhr</h2><span class="badge">VOM KESSEL</span></div><div class="clock">${value('kesseluhr')}</div><div class="clock-sub">${value('kesselwochentag')} · ${value('kesseldatum')}</div><div class="clock-note">Zuletzt empfangene Kesselzeit · aktualisiert sich mit den Telegrammen</div></section></div></div>
    <div class="view" role="tabpanel" aria-labelledby="tab-values" id="view-values" hidden><div class="section-title"><h2>Alle Messwerte</h2><p>Empfangene Werte deiner Anlage. Ein Strich bedeutet: noch kein gültiger Messwert.</p></div><div class="value-groups">${panel('Kessel & Heizkreis',['kesseltemperatur','kesseltemperatur_soll','kesselruecklauf','systemtemperatur','abgastemperatur','heizungsvorlauf'])}${panel('Pufferspeicher',['puffer_oben','puffer_mitte','puffer_unten'])}${panel('Verbrennung & Luft',['restsauerstoff','restsauerstoff_soll_kandidat','luefterdrehzahl','primaerluftklappe','sekundaerluftklappe'])}${panel('Datum & Uhrzeit',['kesseluhr','kesseldatum','kesselwochentag'])}</div></div>
    <div class="view" role="tabpanel" aria-labelledby="tab-diagnostics" id="view-diagnostics" hidden><div class="section-title"><h2>Verbindung & Diagnose</h2><p>Empfang, Netzwerk und noch nicht zugeordnete Datenfelder.</p></div><div class="notice"><strong>Rohwerte bleiben Rohwerte.</strong> Ventil- und Statuskennungen sind noch nicht vollständig entschlüsselt. Sie werden ohne erfundene Einheit angezeigt. Der Sauerstoff-Sollwert ist ein Kandidat und muss am Kesseldisplay bestätigt werden.</div><div class="value-groups">${panel('CAN-Bus',['can_empfang','can_datenalter','can_telegramme','betriebsstatus_rohwert'])}${panel('ESP32 & Netzwerk',['wlan_verbindung','wlan_signal','betriebszeit','ip_adresse','wlan_name'])}${panel('Ventile · Zuordnung offen',['ventil_ruecklaufmischer_rohwert','ventil_puffer_rohwert'])}${panel('Weitere Register · Zuordnung offen',['register_0117_wert_1','register_0117_wert_2'])}</div></div>
    <footer class="footer"><span>Pyromat ESPHome · Lokaler Anlagenmonitor</span><a href="https://github.com/landvogt78/Pyromat-ESPHome" target="_blank" rel="noopener noreferrer">Dokumentation &amp; Projekt ↗</a></footer></main>
    <div id="toast" class="toast" role="status" hidden></div><div id="restart-modal" class="modal-backdrop" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="restart-title" aria-describedby="restart-description"><h2 id="restart-title">ESP32 neu starten?</h2><p id="restart-description">Die Datenverbindung wird kurz unterbrochen. Der Heizkessel selbst wird dadurch nicht neu gestartet.</p><div class="modal-actions"><button id="restart-cancel" class="button">Abbrechen</button><button id="restart-confirm" class="button danger">Jetzt neu starten</button></div></section></div>`;
  document.body.replaceChildren(shell);
  const $=id=>document.getElementById(id);
  let connected=false, lastMessage=0, restartPending=false, toastTimer, source;
  let demoState='live';
  function fieldState(key,now) {
    const def=fields[key],entry=model[key];
    if (!def || !entry) return {text:'—',stale:true};
    const system=def[3]==='system';
    if (def[2]==='text' || def[2]==='binary') {
      const item=eventReading(model,key,connected,!system,now);
      let text=item.value;
      if (def[2]==='binary') text=(text===true || text==='ON')?'Verbunden':(text===false || text==='OFF')?'Getrennt':'—';
      if (text===null || text===undefined || text==='' || text==='Keine Daten') text='—';
      return {text:String(text),stale:item.stale || text==='—'};
    }
    const item=system?{value:numeric(entry.value),stale:now-entry.at>60000}:reading(model,key,now);
    return {text:format(item.value,def[2]),stale:item.stale || !connected};
  }
  function render() {
    const now=Date.now();
    if (connected && !preview && now-lastMessage>30000) connected=false;
    const ageEntry=model.can_datenalter,age=numeric(ageEntry&&ageEntry.value);
    const canGood=connected && age!==null && age<=30 && now-ageEntry.at<30000;
    $('connection-label').textContent=restartPending?'Neustart angefordert':connected?(preview?'Vorschau aktiv':'ESP verbunden'):'Verbindung unterbrochen';
    $('connection-badge').className='badge '+(connected?'good':'warn');
    $('can-label').textContent=canGood?'CAN-Daten aktuell':age===null?'Warte auf CAN-Daten':'CAN-Daten veraltet';
    $('can-badge').className='badge '+(canGood?'good':'warn');
    $('restart-button').disabled=(!connected && !preview) || restartPending;
    document.querySelectorAll('[data-value]').forEach(element=>{
      const item=fieldState(element.dataset.value,now);
      if (element.textContent!==item.text) element.textContent=item.text;
      element.classList.toggle('stale',item.stale);
      element.title=item.stale?'Noch keine aktuellen Daten':fields[element.dataset.value][0];
    });
    document.querySelectorAll('[data-freshness]').forEach(element=>{
      const item=fieldState(element.dataset.freshness,now);
      element.textContent=item.text==='—'?'Warte auf Messwert':item.stale?'Messwert veraltet':preview?'Beispielwert':'Messwert aktuell';
    });
    document.querySelectorAll('[data-bar]').forEach(element=>{
      const item=reading(model,element.dataset.bar,now);
      element.style.width=(item.value===null?0:Math.max(0,Math.min(100,item.value)))+'%';
      element.classList.toggle('stale',item.stale || !connected);
    });
  }
  function notify(text) {
    $('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>$('toast').hidden=true,6000);
  }
  const tabs=[...document.querySelectorAll('[data-tab]')];
  function selectTab(button) {
    tabs.forEach(tab=>{const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
    document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!=='view-'+button.dataset.tab);
  }
  tabs.forEach((button,index)=>{
    button.addEventListener('click',()=>selectTab(button));
    button.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();selectTab(tabs[next]);tabs[next].focus();}
    });
  });
  selectTab(tabs[0]);
  try { document.documentElement.dataset.theme=localStorage.getItem('pyromat-theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); } catch {document.documentElement.dataset.theme='light';}
  $('theme-button').addEventListener('click',()=>{
    const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;
    try {localStorage.setItem('pyromat-theme',theme);}catch{}
  });
  function closeModal() {$('restart-modal').hidden=true;document.body.style.overflow='';$('restart-button').focus();}
  $('restart-button').addEventListener('click',()=>{$('restart-modal').hidden=false;document.body.style.overflow='hidden';$('restart-cancel').focus();});
  $('restart-cancel').addEventListener('click',closeModal);
  $('restart-modal').addEventListener('click',event=>{if(event.target===$('restart-modal'))closeModal();});
  $('restart-modal').addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();closeModal();}
    if(event.key==='Tab'){
      const first=$('restart-cancel'),last=$('restart-confirm');
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  $('restart-confirm').addEventListener('click',async()=>{
    $('restart-confirm').disabled=true;
    try {
      const result=await restartRequest(preview,window.fetch.bind(window));
      closeModal();
      if(result==='preview'){notify('Vorschau: Es wird kein Gerät neu gestartet.');return;}
      restartPending=true;connected=false;notify('Neustart angefordert. Die Verbindung wird automatisch wieder aufgebaut.');render();
      setTimeout(()=>{if(restartPending){restartPending=false;render();notify('Noch keine Verbindung. Netzwerk und Gerät prüfen.');}},60000);
    } catch(error) {notify('Neustart nicht bestätigt: '+(error.name==='AbortError'?'Zeitüberschreitung':error.message));}
    finally {$('restart-confirm').disabled=false;}
  });
  const sample={kesseltemperatur:77.4,kesseltemperatur_soll:86,abgastemperatur:168.2,kesselruecklauf:63.1,
    systemtemperatur:76.8,puffer_oben:76.2,puffer_mitte:57.8,puffer_unten:34.6,heizungsvorlauf:38.5,
    restsauerstoff:6.8,restsauerstoff_soll_kandidat:7,luefterdrehzahl:1380,primaerluftklappe:42,sekundaerluftklappe:31,
    ventil_ruecklaufmischer_rohwert:62736,ventil_puffer_rohwert:2800,register_0117_wert_1:140,register_0117_wert_2:980,
    betriebsstatus_rohwert:6,kesseluhr:'14:32:08',kesseldatum:'30.10.2024',kesselwochentag:'Mittwoch',can_datenalter:2,
    can_telegramme:181073,wlan_signal:-58,betriebszeit:86400,ip_adresse:'192.168.1.42',wlan_name:'Heimnetz',can_empfang:true,wlan_verbindung:true};
  function loadPreview(state) {
    demoState=state;
    for(const key of Object.keys(model))delete model[key];
    if(state!=='empty') for(const [key,value] of Object.entries(sample))model[key]={value,at:Date.now()};
    connected=state!=='offline';lastMessage=Date.now();
    document.querySelectorAll('[data-demo]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.demo===state)));
    render();
  }
  if(preview) {
    document.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>loadPreview(button.dataset.demo)));
    loadPreview('live');
  } else {
    source=new EventSource('/events');
    source.onopen=()=>{connected=true;lastMessage=Date.now();restartPending=false;render();};
    source.onerror=()=>{connected=false;render();};
    source.addEventListener('ping',event=>{
      connected=true;lastMessage=Date.now();
      try {const data=JSON.parse(event.data);if(data.title){$('device-title').textContent=data.title;document.title=data.title+' · Anlagenübersicht';}}catch{}
      render();
    });
    source.addEventListener('state',event=>{
      try {
        const data=JSON.parse(event.data),key=entityKey(data.id);
        if(!Object.hasOwn(fields,key))return;
        model[key]={value:Object.hasOwn(data,'value')?data.value:data.state,at:Date.now()};
        connected=true;lastMessage=Date.now();render();
      } catch { /* A malformed event must not stop later updates. */ }
    });
    render();
  }
  const refresh=setInterval(()=>{
    if(preview && demoState==='live') for(const entry of Object.values(model))entry.at=Date.now();
    render();
  },1000);
  bindPageLifecycle(window,()=>{clearInterval(refresh);if(source)source.close();});
})();
