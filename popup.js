const $ = id => document.getElementById(id);
let current = null;
const status = message => { $('status').textContent = message; };
let contextVersion = 0;
let observedTab = null;
let scanTimer;
let placeController;
const placeCache = new Map();
function placeNames(data) {
  const p = data.features?.[0]?.properties || {};
  const settlement = ['city', 'town', 'village', 'hamlet'].includes(p.osm_value) ? p.name : '';
  return {city:p.city || settlement || p.locality || '', country:p.country || '', countryCode:/^[a-z]{2}$/i.test(p.countrycode || '') ? p.countrycode.toLowerCase() : ''};
}
function showCountry(name = '', code = '') {
  $('country').textContent = name;
  const flag = $('flag');
  flag.hidden = true;
  flag.removeAttribute('src');
  if (name && /^[a-z]{2}$/.test(code)) {
    flag.src = 'vendor/flags/' + code + '.svg';
    flag.hidden = false;
  }
}
$('flag').addEventListener('error', () => { $('flag').hidden = true; });
async function loadPlace(position) {
  placeController?.abort();
  const controller = new AbortController();
  placeController = controller;
  $('city').textContent = 'Recherche du lieu…';
  showCountry();
  const key = position.lat + ',' + position.lng;
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let place = placeCache.get(key);
    if (!place) {
      const url = 'https://photon.komoot.io/reverse?' + new URLSearchParams({lat:position.lat, lon:position.lng, lang:'fr', limit:'1'});
      const response = await fetch(url, {signal:controller.signal});
      if (!response.ok) throw new Error('Geocoding unavailable');
      place = placeNames(await response.json());
      if (placeCache.size >= 100) placeCache.delete(placeCache.keys().next().value);
      placeCache.set(key, place);
    }
    if (current !== position) return;
    current.city = place.city;
    current.country = place.country;
    $('city').textContent = place.city || 'Localité inconnue';
    showCountry(place.country || 'Pays inconnu', place.countryCode);
  } catch {
    if (current === position) {
      $('city').textContent = 'Nom indisponible';
      showCountry();
    }
  } finally { clearTimeout(timer); }
}
function hidePosition() {
  if (current) clearMap();
  placeController?.abort();
  $('city').textContent = 'Aucune position';
  showCountry();
  current = null;
  $('result').hidden = true;
}
async function scanPosition() {
  const version = contextVersion;
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (version !== contextVersion) return;
    if (observedTab !== tab?.id) { hidePosition(); observedTab = tab?.id; }
    const url = new URL(tab?.url || 'about:blank');
    if (url.protocol !== 'https:' || !(url.hostname === 'worldguessr.com' || url.hostname.endsWith('.worldguessr.com'))) {
      hidePosition(); status('Ouvre WorldGuessr.'); return;
    }
    await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:['content.js']});
    const results = await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:() => globalThis.wgLearningRead?.() || null});
    if (version !== contextVersion) return;
    const [active] = await chrome.tabs.query({active:true,currentWindow:true});
    if (version !== contextVersion || active?.id !== tab.id) return;
    const found = results.map(r => r.result).filter(Boolean).sort((a,b) => b.at-a.at)[0];
    if (!found) {
      hidePosition(); status('En attente du panorama…'); return;
    }
    // Keep the map zoom intact while the coordinates stay the same.
    if (current && current.lat === found.lat && current.lng === found.lng) return;
    current = found;
    void loadPlace(current);
    setMapPosition(current.lat, current.lng);
    const point = current.lat.toFixed(6) + ', ' + current.lng.toFixed(6);
    $('coords').textContent = point;
    $('maps').href = 'https://www.google.com/maps/search/?api=1&hl=fr&query=' + encodeURIComponent(point);
    $('osm').href = 'https://www.openstreetmap.org/?mlat=' + current.lat + '&mlon=' + current.lng + '#map=14/' + current.lat + '/' + current.lng;
    $('result').hidden = false;
    status('Position détectée.');
  } catch {
    if (version === contextVersion) {
      hidePosition(); status('Panorama inaccessible. Nouvelle tentative…');
    }
  } finally {
    // Schedule only after completion to avoid overlapping scans.
    scanTimer = setTimeout(scanPosition, 1200);
  }
}
$('copy').addEventListener('click', async () => {
  if (!current) return;
  try { await navigator.clipboard.writeText(`${current.lat}, ${current.lng}`); status('Coordonnées copiées.'); }
  catch { status('Copie indisponible. Sélectionne les coordonnées affichées.'); }
});
function resetPosition() {
  contextVersion++;
  hidePosition();
  status('Recherche du panorama…');
}
chrome.tabs.onActivated.addListener(resetPosition);
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId === observedTab && (info.status === 'loading' || info.url)) resetPosition();
});
window.addEventListener('pagehide', () => { clearTimeout(scanTimer); placeController?.abort(); });
scanPosition();
