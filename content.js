(() => {
  if (globalThis.wgLearningInstalled) return;
  globalThis.wgLearningInstalled = true;
  const isEmbed = /\/svEmbed\/?$/.test(location.pathname);
  globalThis.wgLearningRead = () => {
    const candidates = [...document.querySelectorAll('iframe[src]')].filter(frame => {
      const r = frame.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && frame.getClientRects().length && getComputedStyle(frame).visibility !== 'hidden';
    }).sort((a,b) => {
      const x=a.getBoundingClientRect(), y=b.getBoundingClientRect();
      return y.width*y.height-x.width*x.height;
    });
    for (const frame of candidates) {
      try {
        const url = new URL(frame.src, location.href);
        if (!['www.google.com','maps.google.com','www.google.fr'].includes(url.hostname) || url.pathname !== '/maps/embed/v1/streetview') continue;
        const point = url.searchParams.get('location')?.split(',');
        if (!point || point.length !== 2 || point.some(v => !v.trim())) continue;
        const [lat,lng]=point.map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180) {
          return {lat,lng,source:'Cadre Street View visible',at:Date.now()};
        }
      } catch {}
    }
    return isEmbed ? globalThis.wgLearningLocation || null : null;
  };
  if (!isEmbed) return;
  function accept(lat, lng, source) {
    if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') {
      globalThis.wgLearningLocation = null; return;
    }
    lat = Number(lat); lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      globalThis.wgLearningLocation = null; return;
    }
    globalThis.wgLearningLocation = {lat, lng, source, at: Date.now()};
  }
  const params = new URL(location.href).searchParams;
  accept(params.get('lat'), params.get('long'), 'URL du panorama');
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    if (event.data?.type !== 'updateProps' || !event.data.props) return;
    accept(event.data.props.lat, event.data.props.long, 'Mise à jour de la manche');
  });
})();
