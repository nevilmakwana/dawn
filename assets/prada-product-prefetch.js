(() => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slowConnection = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
  const supportsLinkPrefetch = document.createElement('link').relList?.supports?.('prefetch') === true;

  const preparedUrls = new Set();
  const fetchedUrls = new Set();
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
      if (url.href === window.location.href.split('#')[0]) return null;

      return url.href;
    } catch (_error) {
      return null;
    }
  };

  const fetchDocument = (url, priority = 'low') => {
    if (!url || fetchedUrls.has(url)) return;

    fetchedUrls.add(url);
    fetch(url, {
      credentials: 'same-origin',
      cache: 'force-cache',
      priority,
    })
      // Consuming the response lets WebKit retain the complete document in its HTTP cache.
      .then((response) => {
        if (!response.ok) throw new Error('Product prefetch failed');
        return response.arrayBuffer();
      })
      .catch(() => fetchedUrls.delete(url));
  };

  const prepareProduct = (url, urgent = false) => {
    if (!url || slowConnection || document.visibilityState === 'hidden') return;

    queuedUrls.delete(url);

    if (!preparedUrls.has(url)) {
      preparedUrls.add(url);

      if (supportsLinkPrefetch) {
        const hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.as = 'document';
        hint.href = url;
        document.head.appendChild(hint);
      } else {
        // Safari/iOS does not reliably support rel=prefetch. A low-priority GET
        // warms Shopify's document cache without rendering or executing the page.
        fetchDocument(url);
      }
    }

    // A real tap should not wait behind a speculative low-priority request.
    // The browser coalesces/reuses the request when it is already in flight/cached.
    if (urgent) fetchDocument(url, 'high');
  };

  const drainQueue = () => {
    queueScheduled = false;
    const url = queue.shift();

    if (url) prepareProduct(url);
    if (queue.length > 0) {
      queueScheduled = true;
      window.setTimeout(drainQueue, 350);
    }
  };

  const queueProduct = (url) => {
    if (
      !url ||
      slowConnection ||
      preparedUrls.has(url) ||
      queuedUrls.has(url) ||
      automaticPrefetches >= maxAutomaticPrefetches
    ) {
      return;
    }

    automaticPrefetches += 1;
    queuedUrls.add(url);
    queue.push(url);

    if (queueScheduled) return;

    queueScheduled = true;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(drainQueue, { timeout: 350 });
    } else {
      window.setTimeout(drainQueue, 120);
    }
  };

  const observer = !slowConnection && 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            observer.unobserve(entry.target);
            queueProduct(getProductUrl(entry.target));
          });
        },
        { rootMargin: '600px 0px' }
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

  const prepareFromEvent = (event) => {
    const link = event.target.closest?.('a[href*="/products/"]');
    prepareProduct(getProductUrl(link), event.type === 'pointerdown' || event.type === 'touchstart');
  };

  document.addEventListener('pointerover', prepareFromEvent, { passive: true, capture: true });
  document.addEventListener('pointerdown', prepareFromEvent, { passive: true, capture: true });
  document.addEventListener('focusin', prepareFromEvent, true);
  // Retain touchstart for older iOS versions that do not emit Pointer Events.
  document.addEventListener('touchstart', prepareFromEvent, { passive: true, capture: true });
  document.addEventListener('shopify:section:load', (event) => observeProductLinks(event.target));
  document.addEventListener('prada:collection:updated', () => observeProductLinks());

  observeProductLinks();
})();
