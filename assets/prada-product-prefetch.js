(() => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const supportsLinkPrefetch = document.createElement('link').relList?.supports?.('prefetch') === true;

  const preparedUrls = new Set();
  const fetchedUrls = new Set();
  const queuedUrls = new Set();
  const observedLinks = new WeakSet();
  const queue = [];
  const maxAutomaticPrefetches = 6;
  const maxMenuPrefetches = 8;
  let automaticPrefetches = 0;
  let menuPrefetches = 0;
  let queueScheduled = false;

  const shouldAvoidPrefetch = () => {
    const effectiveType = connection?.effectiveType || '';
    return Boolean(connection?.saveData || /(^|-)2g$/.test(effectiveType));
  };

  const isSafeContentPath = (pathname) =>
    /^\/(products|collections|pages|blogs)(\/|$)/.test(pathname) &&
    !/^\/(cart|checkout|account|search|challenge|apps|password)(\/|$)/.test(pathname);

  const getContentUrl = (link) => {
    if (!(link instanceof HTMLAnchorElement)) return null;
    if (link.target && link.target !== '_self') return null;
    if (link.hasAttribute('download') || /(^|\s)(nofollow|external)(\s|$)/i.test(link.rel || '')) return null;

    try {
      const url = new URL(link.href, window.location.href);
      url.hash = '';

      if (url.origin !== window.location.origin || !isSafeContentPath(url.pathname)) return null;
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
        if (!response.ok) throw new Error('Navigation prefetch failed');
        return response.arrayBuffer();
      })
      .catch(() => fetchedUrls.delete(url));
  };

  const prepareContent = (url, urgent = false) => {
    if (!url || shouldAvoidPrefetch() || document.visibilityState === 'hidden') return;

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
        // still warms Shopify and the browser's HTTP caches without executing it.
        fetchDocument(url);
      }
    }

    // A real tap should not wait behind a speculative low-priority request.
    // The browser coalesces/reuses the request when it is already in flight/cached.
    if (urgent && !supportsLinkPrefetch) fetchDocument(url, 'high');
  };

  const drainQueue = () => {
    queueScheduled = false;
    const url = queue.shift();

    if (url) prepareContent(url);
    if (queue.length > 0) {
      queueScheduled = true;
      window.setTimeout(drainQueue, 350);
    }
  };

  const queueContent = (url) => {
    if (
      !url ||
      shouldAvoidPrefetch() ||
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

  const observer = !shouldAvoidPrefetch() && 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            observer.unobserve(entry.target);
            queueContent(getContentUrl(entry.target));
          });
        },
        { rootMargin: '600px 0px' }
      )
    : null;

  const observePriorityLinks = (root = document) => {
    if (!observer) return;

    root.querySelectorAll?.(
      '.product-card-wrapper a[href*="/products/"], .prada-collection__item a[href*="/products/"]'
    ).forEach((link) => {
      if (observedLinks.has(link)) return;

      observedLinks.add(link);
      observer.observe(link);
    });
  };

  const prepareFromEvent = (event) => {
    const link = event.target.closest?.('a[href]');
    const url = getContentUrl(link);
    const urgent = event.type === 'pointerdown' || event.type === 'touchstart';

    if (urgent && url) {
      try {
        sessionStorage.setItem('greyexim-navigation-start', String(performance.timeOrigin + performance.now()));
        sessionStorage.setItem('greyexim-navigation-url', url);
      } catch (_error) {
        // Storage can be unavailable in private browsing; navigation must continue.
      }
    }

    prepareContent(url, urgent);
  };

  const warmVisibleMenuLinks = () => {
    if (shouldAvoidPrefetch() || menuPrefetches >= maxMenuPrefetches) return;

    const drawer = document.querySelector('details.menu-drawer-container[open], .prada-desktop-menu[aria-hidden="false"]');
    if (!drawer) return;

    const links = Array.from(drawer.querySelectorAll('a[href]')).filter((link) => {
      if (!getContentUrl(link)) return false;
      const rect = link.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight
      );
    });

    for (const link of links) {
      if (menuPrefetches >= maxMenuPrefetches) break;
      const url = getContentUrl(link);
      if (!url || preparedUrls.has(url)) continue;
      menuPrefetches += 1;
      prepareContent(url);
    }
  };

  const publishNavigationTiming = () => {
    try {
      const startedAt = Number(sessionStorage.getItem('greyexim-navigation-start'));
      const expectedUrl = sessionStorage.getItem('greyexim-navigation-url');
      if (!startedAt || !expectedUrl || new URL(expectedUrl).pathname !== window.location.pathname) return;

      const duration = Math.max(0, Math.round(performance.timeOrigin + performance.now() - startedAt));
      window.greyEximNavigationTiming = { duration, url: window.location.href };
      document.dispatchEvent(new CustomEvent('greyexim:navigation-timing', { detail: { duration } }));
      sessionStorage.removeItem('greyexim-navigation-start');
      sessionStorage.removeItem('greyexim-navigation-url');
    } catch (_error) {
      // Navigation telemetry is diagnostic only.
    }
  };

  document.addEventListener('pointerover', prepareFromEvent, { passive: true, capture: true });
  document.addEventListener('pointerdown', prepareFromEvent, { passive: true, capture: true });
  document.addEventListener('focusin', prepareFromEvent, true);
  // Retain touchstart for older iOS versions that do not emit Pointer Events.
  document.addEventListener('touchstart', prepareFromEvent, { passive: true, capture: true });
  document.addEventListener('shopify:section:load', (event) => observePriorityLinks(event.target));
  document.addEventListener('prada:collection:updated', () => {
    observePriorityLinks();
    publishNavigationTiming();
  });
  document.addEventListener('click', () => window.setTimeout(warmVisibleMenuLinks, 0), true);
  document.addEventListener('change', () => window.setTimeout(warmVisibleMenuLinks, 0), true);
  document.addEventListener('focusin', () => window.setTimeout(warmVisibleMenuLinks, 0), true);
  window.addEventListener('pageshow', publishNavigationTiming);

  observePriorityLinks();
  publishNavigationTiming();
})();
