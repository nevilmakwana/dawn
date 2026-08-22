(() => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slowConnection = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');

  if (slowConnection || !document.createElement('link').relList?.supports?.('prefetch')) return;

  const prefetchedUrls = new Set();
  const queuedUrls = new Set();
  const observedLinks = new WeakSet();
  const queue = [];
  const maxAutomaticPrefetches = 4;
  let automaticPrefetches = 0;
  let queueScheduled = false;

  const getProductUrl = (link) => {
    if (!(link instanceof HTMLAnchorElement)) return null;

    try {
      const url = new URL(link.href, window.location.href);
      url.hash = '';

      if (url.origin !== window.location.origin || !url.pathname.includes('/products/')) return null;
      if (url.href === `${window.location.href.split('#')[0]}`) return null;

      return url.href;
    } catch (_error) {
      return null;
    }
  };

  const prefetch = (url) => {
    if (!url || prefetchedUrls.has(url)) return;

    prefetchedUrls.add(url);
    queuedUrls.delete(url);

    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = url;
    document.head.appendChild(hint);
  };

  const drainQueue = () => {
    queueScheduled = false;
    const url = queue.shift();

    if (url) prefetch(url);
    if (queue.length > 0) {
      queueScheduled = true;
      window.setTimeout(drainQueue, 750);
    }
  };

  const queuePrefetch = (url) => {
    if (!url || prefetchedUrls.has(url) || queuedUrls.has(url) || automaticPrefetches >= maxAutomaticPrefetches) {
      return;
    }

    automaticPrefetches += 1;
    queuedUrls.add(url);
    queue.push(url);

    if (queueScheduled) return;

    queueScheduled = true;

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(drainQueue, { timeout: 1200 });
    } else {
      window.setTimeout(drainQueue, 500);
    }
  };

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            observer.unobserve(entry.target);
            queuePrefetch(getProductUrl(entry.target));
          });
        },
        { rootMargin: '350px 0px' }
      )
    : null;

  const observeProductLinks = (root = document) => {
    if (!observer) return;

    root.querySelectorAll?.('a[href*="/products/"]').forEach((link) => {
      if (observedLinks.has(link)) return;

      observedLinks.add(link);
      observer.observe(link);
    });
  };

  const prefetchFromEvent = (event) => {
    const link = event.target.closest?.('a[href*="/products/"]');
    prefetch(getProductUrl(link));
  };

  document.addEventListener('pointerover', prefetchFromEvent, { passive: true });
  document.addEventListener('focusin', prefetchFromEvent);
  document.addEventListener('touchstart', prefetchFromEvent, { passive: true });
  document.addEventListener('shopify:section:load', (event) => observeProductLinks(event.target));
  document.addEventListener('prada:collection:updated', () => observeProductLinks());

  observeProductLinks();
})();
