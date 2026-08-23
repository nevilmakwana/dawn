(() => {
  const SUPPORT_SELECTOR = '[data-prada-support-page]';
  const TABS_SELECTOR = '[data-prada-support-tabs]';
  const SUPPORT_VIEWS = new Set(['contact', 'track-order', 'returns', 'faq']);
  const state = { request: null, navigationId: 0 };
  let currentPathSearch = `${window.location.pathname}${window.location.search}`;
  let canvasContext;

  const textFrom = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
  const isSupportStylesheet = (link) => link.href.includes('/prada-support-tabs.css');

  const getViewFromUrl = (url) => {
    const target = new URL(url, window.location.origin);
    const view = target.searchParams.get('view');
    if (view && SUPPORT_VIEWS.has(view)) return view;
    if (target.pathname.replace(/\/$/, '') === '/pages/contact') return 'contact';
    return null;
  };

  const getTabTextElement = (tab) => {
    const existingText = tab.querySelector('.prada-support-tabs__text');
    if (existingText) return existingText;

    const labelText = document.createElement('span');
    labelText.className = 'prada-support-tabs__text';
    labelText.textContent = textFrom(tab);
    tab.replaceChildren(labelText);
    return labelText;
  };

  const measureTabText = (labelText) => {
    const text = textFrom(labelText);
    if (!text) return 0;

    if (!canvasContext) canvasContext = document.createElement('canvas').getContext('2d');

    const styles = window.getComputedStyle(labelText);
    canvasContext.font = styles.font;
    return canvasContext.measureText(text).width;
  };

  const updateIndicator = (tabs, activeTab) => {
    if (!tabs || !activeTab) return;

    const tabsRect = tabs.getBoundingClientRect();
    const labelText = getTabTextElement(activeTab);
    const labelRect = labelText.getBoundingClientRect();
    const measuredWidth = measureTabText(labelText);
    const indicatorWidth = measuredWidth || labelRect.width || activeTab.getBoundingClientRect().width;
    let indicatorLeft = labelRect.left - tabsRect.left + tabs.scrollLeft;

    if (labelRect.width > indicatorWidth) {
      indicatorLeft += (labelRect.width - indicatorWidth) / 2;
    }

    tabs.style.setProperty('--prada-support-tab-indicator-left', `${indicatorLeft}px`);
    tabs.style.setProperty('--prada-support-tab-indicator-width', `${Math.max(indicatorWidth, 16)}px`);
  };

  const queueIndicatorUpdate = (tabs) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        updateIndicator(tabs, tabs.querySelector('a.is-active'));
        if (tabs.dataset.pradaSupportIndicatorSettling === 'true') {
          window.requestAnimationFrame(() => {
            delete tabs.dataset.pradaSupportIndicatorSettling;
          });
        }
      });
    });
  };

  const setActiveTab = (root, view) => {
    root.querySelectorAll(`${TABS_SELECTOR} a`).forEach((tab) => {
      const isActive = getViewFromUrl(tab.href) === view;
      tab.classList.toggle('is-active', isActive);
      if (isActive) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    root.querySelectorAll(TABS_SELECTOR).forEach(queueIndicatorUpdate);
  };

  const initializeTabs = (scope = document) => {
    scope.querySelectorAll(TABS_SELECTOR).forEach((tabs) => {
      if (tabs.dataset.pradaSupportTabsReady !== 'true') {
        tabs.dataset.pradaSupportTabsReady = 'true';
        tabs.addEventListener('scroll', () => updateIndicator(tabs, tabs.querySelector('a.is-active')), { passive: true });
      }

      tabs.querySelectorAll('a').forEach(getTabTextElement);
      queueIndicatorUpdate(tabs);
      document.fonts?.ready?.then(() => queueIndicatorUpdate(tabs));
    });
  };

  const initializeFaq = (scope = document) => {
    scope.querySelectorAll('[data-prada-faq]').forEach((root) => {
      if (root.dataset.pradaFaqReady === 'true') return;
      root.dataset.pradaFaqReady = 'true';

      const overview = root.querySelector('[data-faq-overview]');
      const details = root.querySelector('[data-faq-details]');
      const panels = Array.from(root.querySelectorAll('[data-faq-panel]'));
      if (!overview || !details || !panels.length) return;

      const showOverview = (updateHistory = true) => {
        details.hidden = true;
        overview.hidden = false;
        panels.forEach((panel) => {
          panel.hidden = true;
        });
        if (updateHistory) history.pushState({}, '', `${location.pathname}${location.search}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      const showTopic = (topic, questionId, updateHistory = true) => {
        const panel = panels.find((item) => item.dataset.faqPanel === topic);
        if (!panel) return;

        overview.hidden = true;
        details.hidden = false;
        panels.forEach((item) => {
          item.hidden = item !== panel;
        });
        panel.querySelectorAll('details').forEach((item) => {
          item.open = item.id === questionId;
        });
        if (updateHistory) history.pushState({}, '', questionId ? `#${questionId}` : `#topic-${topic}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      const applyHash = () => {
        const hash = location.hash.slice(1);
        if (hash.startsWith('topic-')) {
          showTopic(hash.replace('topic-', ''), null, false);
          return;
        }

        const question = hash && root.querySelector(`#${CSS.escape(hash)}`);
        if (question) {
          const blockLink = root.querySelector(`[href="#${CSS.escape(hash)}"]`);
          showTopic(blockLink?.dataset.faqTopic || question.closest('[data-faq-panel]')?.dataset.faqPanel, hash, false);
        } else {
          showOverview(false);
        }
      };

      root.addEventListener('click', (event) => {
        const question = event.target.closest('[data-faq-question-link]');
        const topic = event.target.closest('[data-faq-topic-link]');

        if (question) {
          event.preventDefault();
          showTopic(question.dataset.faqTopic, question.hash.slice(1));
        } else if (topic) {
          event.preventDefault();
          showTopic(topic.dataset.faqTopicLink);
        } else if (event.target.closest('[data-faq-back]')) {
          showOverview();
        }
      });

      window.addEventListener('popstate', applyHash);
      applyHash();
    });
  };

  const syncStyles = (sourceDocument) => {
    sourceDocument.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
      const alreadyLoaded = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
        .some((existingLink) => existingLink.href === link.href);
      if (alreadyLoaded) return;
      document.head.appendChild(link.cloneNode(true));
    });

    const supportStylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
      .find(isSupportStylesheet);
    if (supportStylesheet) document.head.appendChild(supportStylesheet);
  };

  const syncScripts = (sourceDocument, callback) => {
    const scripts = Array.from(sourceDocument.querySelectorAll('script[src]'));
    const pending = scripts
      .filter((script) => !Array.from(document.querySelectorAll('script[src]')).some((existingScript) => existingScript.src === script.src))
      .map((script) => script.src);

    if (!pending.length) {
      callback();
      return;
    }

    let remaining = pending.length;
    pending.forEach((src) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.addEventListener('load', () => {
        remaining -= 1;
        if (!remaining) callback();
      });
      script.addEventListener('error', () => {
        remaining -= 1;
        if (!remaining) callback();
      });
      document.body.appendChild(script);
    });
  };

  const copyIndicatorState = (fromRoot, toRoot) => {
    const fromTabs = fromRoot.querySelector(TABS_SELECTOR);
    const toTabs = toRoot.querySelector(TABS_SELECTOR);
    if (!fromTabs || !toTabs) return;

    updateIndicator(fromTabs, fromTabs.querySelector('a.is-active'));

    ['--prada-support-tab-indicator-left', '--prada-support-tab-indicator-width'].forEach((property) => {
      const value = fromTabs.style.getPropertyValue(property);
      if (value) toTabs.style.setProperty(property, value);
    });

    toTabs.dataset.pradaSupportIndicatorSettling = 'true';
  };

  const initializeSupportPage = (root) => {
    initializeTabs(root);
    initializeFaq(root);
    window.pradaInitializeForms?.(root);
    window.pradaInitializeExclusiveAccordions?.(root);
    document.dispatchEvent(new CustomEvent('prada:support-page:updated', { detail: { root } }));
  };

  const replaceSupportPage = (sourceDocument, targetUrl) => {
    const sourceRoot = sourceDocument.querySelector(SUPPORT_SELECTOR);
    const targetRoot = document.querySelector(SUPPORT_SELECTOR);
    if (!sourceRoot || !targetRoot) return false;

    syncStyles(sourceDocument);
    copyIndicatorState(targetRoot, sourceRoot);
    targetRoot.replaceWith(sourceRoot);
    document.title = sourceDocument.title || document.title;
    window.history.pushState({ pradaSupportUrl: targetUrl.href }, '', targetUrl.href);
    currentPathSearch = `${window.location.pathname}${window.location.search}`;

    const view = getViewFromUrl(targetUrl.href);
    if (view) setActiveTab(sourceRoot, view);
    syncScripts(sourceDocument, () => initializeSupportPage(sourceRoot));

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    return true;
  };

  const loadSupportHtml = (url, signal) => (
    fetch(url.href, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
      signal,
    }).then((response) => {
      if (!response.ok) throw new Error(`Unable to load ${url.href}`);
      return response.text();
    })
  );

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.(`${SUPPORT_SELECTOR} a`);
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    const targetUrl = new URL(link.href, window.location.origin);
    const view = getViewFromUrl(targetUrl.href);
    if (!view || targetUrl.origin !== window.location.origin) return;
    if (targetUrl.hash && targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;

    event.preventDefault();

    const currentRoot = document.querySelector(SUPPORT_SELECTOR);
    if (!currentRoot) {
      window.location.href = targetUrl.href;
      return;
    }

    if (targetUrl.href === window.location.href) {
      setActiveTab(currentRoot, view);
      return;
    }

    if (state.request) state.request.abort();

    const controller = new AbortController();
    const navigationId = state.navigationId + 1;
    state.navigationId = navigationId;
    state.request = controller;

    setActiveTab(currentRoot, view);

    loadSupportHtml(targetUrl, controller.signal)
      .then((html) => {
        if (state.request !== controller || state.navigationId !== navigationId) return;

        const sourceDocument = new DOMParser().parseFromString(html, 'text/html');
        if (!replaceSupportPage(sourceDocument, targetUrl)) window.location.href = targetUrl.href;
      })
      .catch((error) => {
        if (error.name !== 'AbortError') window.location.href = targetUrl.href;
      })
      .finally(() => {
        if (state.request === controller) state.request = null;
      });
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll(TABS_SELECTOR).forEach(queueIndicatorUpdate);
  });

  window.addEventListener('popstate', () => {
    const nextPathSearch = `${window.location.pathname}${window.location.search}`;
    if (document.querySelector(SUPPORT_SELECTOR) && nextPathSearch !== currentPathSearch) {
      window.location.reload();
      return;
    }
    currentPathSearch = nextPathSearch;
  });

  initializeTabs();
  initializeFaq();
})();
