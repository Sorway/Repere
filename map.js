maplibregl.setWorkerUrl(chrome.runtime.getURL('vendor/maplibre/maplibre-gl-csp-worker.js'));
const locationMap = new maplibregl.Map({
  container:'map', style:chrome.runtime.getURL('assets/map-style.json'),
  center:[0,20], zoom:1, minZoom:1,
  locale:{'NavigationControl.ZoomIn':'Zoomer','NavigationControl.ZoomOut':'Dézoomer','AttributionControl.ToggleAttribution':'Afficher les crédits'}
});
locationMap.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
locationMap.on('error', () => { document.getElementById('map-error').hidden = false; });
locationMap.on('idle', () => { document.getElementById('map-error').hidden = locationMap.areTilesLoaded(); });
let locationMarker;
function setMapPosition(lat, lng) {
  const point = [Math.max(-180, Math.min(180, lng)), Math.max(-85, Math.min(85, lat))];
  if (locationMarker) locationMarker.setLngLat(point);
  else locationMarker = new maplibregl.Marker({color:'#76dfc0'}).setLngLat(point).addTo(locationMap);
  locationMap.jumpTo({center:point, zoom:14});
}
function clearMap() {
  if (locationMarker) { locationMarker.remove(); locationMarker = null; }
  locationMap.jumpTo({center:[0,20], zoom:1});
}
let resizeFrame;
const mapObserver = new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => locationMap.resize());
});
mapObserver.observe(document.getElementById('map'));
document.addEventListener('visibilitychange', () => { if (!document.hidden) locationMap.resize(); });
window.addEventListener('pagehide', () => { mapObserver.disconnect(); cancelAnimationFrame(resizeFrame); });
