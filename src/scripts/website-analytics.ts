const liveDomain = /(^|\.)relaxbridge\.nl$/i;
const storageKey = 'relax-bridge-anonymous-visit-v1';

if (
  liveDomain.test(window.location.hostname)
  && navigator.doNotTrack !== '1'
) {
  try {
    if (!window.sessionStorage.getItem(storageKey)) {
      window.sessionStorage.setItem(storageKey, 'pending');

      let referrerHost = '';
      try {
        referrerHost = document.referrer ? new URL(document.referrer).hostname : '';
      } catch {}

      const locale = document.documentElement.lang.toLowerCase().split('-')[0];
      const payload = {
        locale,
        entryPath: window.location.pathname,
        referrerHost,
        utmSource: new URLSearchParams(window.location.search).get('utm_source') || '',
      };

      void fetch('/api/website-visit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).then((response) => {
        if (!response.ok) throw new Error('Visit could not be recorded.');
        window.sessionStorage.setItem(storageKey, 'recorded');
      }).catch(() => {
        window.sessionStorage.removeItem(storageKey);
      });
    }
  } catch {
    // If session storage is unavailable, do not fall back to persistent tracking.
  }
}
