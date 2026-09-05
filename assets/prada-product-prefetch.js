(() => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slowConnection = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
  const supportsLinkPrefetch = document.createElement('link').relList?.supports?.('prefetch');

  const prefetchedUrls = new Set();
  const queuedUrls = new Set();
  const observedLinks = new WeakSet();
  const queue = [];
  const maxAutomaticPrefetches = 4;
  const blockedPath = /(^|\/)(admin|apps|account|cart|challenge|checkout|customer_authentication|localization|password)(\/|$)/;
  let automaticPrefetches = 0;
  let queueScheduled = false;
  let navigationFeedbackTimer;

  const isThemeAction = (link) =>
    link.matches(
      '[data-prada-contact-open], [data-prada-load-more-link], [aria-haspopup="dialog"], [role="button"]'
    ) || Boolean(link.closest('[data-prada-collection-tabs], [data-prada-support-tabs]'));

  const getNavigationUrl = (link) => {
    if (!(link instanceof HTMLAnchorElement)) return null;
    const target = link.getAttribute('target');
    if (
      link.hasAttribute('download') ||
      (target && target !== '_self') ||
      link.getAttribute('aria-disabled') === 'true' ||
      link.relList.contains('external') ||
      link.relList.contains('nofollow') ||
      isThemeAction(link)
    ) {
      return null;
    }

    try {
      const url = new URL(link.href, window.location.href);
      url.hash = '';

      if (url.protocol !== window.location.protocol || url.origin !== window.location.origin) return null;
      if (blockedPath.test(url.pathname)) return null;
      if (url.href === `${window.location.href.split('#')[0]}`) return null;

      return url.href;
    } catch (_error) {
      return null;
    }
  };

  const prefetch = (url) => {
    if (!supportsLinkPrefetch || slowConnection || !url || prefetchedUrls.has(url)) return;

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

  const observer = !slowConnection && 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            observer.unobserve(entry.target);
            queuePrefetch(getNavigationUrl(entry.target));
          });
        },
        { rootMargin: '350px 0px' }
      )
    : null;

  const prepareNavigationLinks = (root = document) => {
    root.querySelectorAll?.('a[href]').forEach((link) => {
      const url = getNavigationUrl(link);
      if (!url) return;

      if (!slowConnection) link.dataset.instantNavigation = '';

      if (!observer || !url.includes('/products/') || observedLinks.has(link)) return;

      observedLinks.add(link);
      observer.observe(link);
    });
  };

  const prefetchFromEvent = (event) => {
    const link = event.target.closest?.('a[href]');
    prefetch(getNavigationUrl(link));
  };

  const showNavigationFeedback = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const link = event.target.closest?.('a[href]');
    if (!getNavigationUrl(link)) return;

    document.documentElement.classList.add('is-page-navigating');
    window.clearTimeout(navigationFeedbackTimer);
    navigationFeedbackTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('is-page-navigating');
    }, 5000);
  };

  document.addEventListener('pointerover', prefetchFromEvent, { passive: true });
  document.addEventListener('focusin', prefetchFromEvent);
  document.addEventListener('touchstart', prefetchFromEvent, { passive: true });
  document.addEventListener('click', showNavigationFeedback);
  document.addEventListener('shopify:section:load', (event) => prepareNavigationLinks(event.target));
  document.addEventListener('prada:collection:updated', () => prepareNavigationLinks());
  window.addEventListener('pageshow', () => document.documentElement.classList.remove('is-page-navigating'));

  prepareNavigationLinks();
})();
