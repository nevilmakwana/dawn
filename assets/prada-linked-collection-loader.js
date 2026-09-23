(() => {
  const initializedCollections = new WeakMap();
  const indexPageCache = new Map();
  const pageSize = 50;
  const primaryImageSelector =
    '#product-grid .prada-product-tile__image:not(.prada-product-tile__image--secondary)';
  const allCardImageSelector = '#product-grid .prada-product-tile__image';
  const imageObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;

              const image = entry.target;
              image.loading = 'eager';
              if (image.fetchPriority === 'low') image.fetchPriority = 'auto';
              scheduleImageRecovery(image);
              imageObserver.unobserve(image);
            });
          },
          { rootMargin: '300px 0px' }
        )
      : null;

  const imageRetrySource = (image) => {
    const source = image.currentSrc || image.src || image.getAttribute('src');
    if (!source) return '';

    try {
      const url = new URL(source, window.location.href);
      const renderedWidth = Math.max(image.clientWidth || 0, 180) * Math.max(window.devicePixelRatio || 1, 1);
      const targetWidth = [360, 540, 720, 900].find((width) => width >= renderedWidth) || 900;
      if (url.searchParams.has('width')) url.searchParams.set('width', String(targetWidth));
      url.searchParams.set('_prada_retry', String(Date.now()));
      return url.href;
    } catch (_error) {
      return source;
    }
  };

  const retryCardImage = (image) => {
    const retryCount = Number.parseInt(image.dataset.pradaImageRetryCount || '0', 10);
    if (!image.isConnected || retryCount >= 2) return;

    const retrySource = imageRetrySource(image);
    if (!retrySource) return;

    image.dataset.pradaImageRetryCount = String(retryCount + 1);
    image.loading = 'eager';
    image.fetchPriority = 'high';
    image.removeAttribute('srcset');
    window.setTimeout(() => {
      if (image.isConnected && (!image.complete || image.naturalWidth === 0)) image.src = retrySource;
    }, retryCount ? 500 : 150);
  };

  const scheduleImageRecovery = (image) => {
    if (image.dataset.pradaImageStallCheckReady === 'true') return;

    image.dataset.pradaImageStallCheckReady = 'true';
    window.setTimeout(() => {
      if (image.isConnected && (!image.complete || image.naturalWidth === 0)) retryCardImage(image);
    }, 4000);
  };

  const prepareCardImage = (image) => {
    if (image.dataset.pradaImageRecoveryReady === 'true') return;

    image.dataset.pradaImageRecoveryReady = 'true';
    image.addEventListener('error', () => retryCardImage(image));
  };

  const initializeCollectionImages = (root) => {
    const primaryImages = Array.from(root.querySelectorAll(primaryImageSelector));

    root.querySelectorAll(allCardImageSelector).forEach(prepareCardImage);
    primaryImages.forEach((image, index) => {
      if (index < 4) {
        image.loading = 'eager';
        image.fetchPriority = 'high';
        scheduleImageRecovery(image);
        imageObserver?.unobserve(image);
      } else if (imageObserver && image.dataset.pradaImageObserved !== 'true') {
        image.dataset.pradaImageObserved = 'true';
        imageObserver.observe(image);
      }
    });
  };

  const collectionIdsFromPipe = (value) => new Set((value || '').split('|').filter(Boolean));

  const activeContext = (root) => {
    const aggregateCollectionIds = collectionIdsFromPipe(root.dataset.pradaAggregateCollectionIds);
    const isAggregate = aggregateCollectionIds.size > 0;
    const targetCollectionIds = isAggregate
      ? aggregateCollectionIds
      : new Set(root.dataset.collectionId ? [root.dataset.collectionId] : []);
    const sortedTargetIds = Array.from(targetCollectionIds).sort();

    return {
      isAggregate,
      targetCollectionIds,
      key: `${root.dataset.collectionId || ''}:${isAggregate ? 'aggregate' : 'single'}:${sortedTargetIds.join(',')}`,
    };
  };

  const isCurrentContext = (root, context) => root.isConnected && activeContext(root).key === context.key;

  const renderedProductIds = (root) => {
    const productIds = new Set();
    root.querySelectorAll('#product-grid [data-prada-product-id]').forEach((item) => {
      if (item.dataset.pradaProductId) productIds.add(item.dataset.pradaProductId);
    });
    return productIds;
  };

  const includesTargetCollection = (pipeValue, targetCollectionIds) => {
    const collectionIds = collectionIdsFromPipe(pipeValue);
    return Array.from(collectionIds).some((collectionId) => targetCollectionIds.has(collectionId));
  };

  const updateProductCount = (root, context, linkedProductCount) => {
    const count = root.querySelector('.prada-collection__count');
    if (!count || !isCurrentContext(root, context)) return;

    const productCount = context.isAggregate
      ? renderedProductIds(root).size
      : Number.parseInt(root.dataset.nativeProductCount || '0', 10) + linkedProductCount;
    count.textContent = `${productCount} ${productCount === 1 ? 'product' : 'products'}`;
  };

  const appendTemplateItem = (grid, template, productId, renderedIds) => {
    if (!productId || renderedIds.has(productId)) return false;

    const item = template.content.firstElementChild?.cloneNode(true);
    if (!item) return false;

    renderedIds.add(productId);
    grid.appendChild(item);
    return true;
  };

  const appendMatchingProducts = (root, sourceDocument, context, linkedProductIds) => {
    if (!isCurrentContext(root, context)) return 0;

    let grid = root.querySelector('#product-grid');
    const index = sourceDocument.querySelector('[data-prada-linked-product-index]');
    if (!grid || !index || !context.targetCollectionIds.size) return 0;

    const renderedIds = renderedProductIds(root);
    let appended = 0;
    const gridForAppend = () => {
      if (grid.matches('ul')) return grid;

      const replacementGrid = document.createElement('ul');
      replacementGrid.className = 'prada-collection__grid';
      replacementGrid.id = 'product-grid';
      replacementGrid.dataset.id = root.dataset.sectionId || '';
      replacementGrid.setAttribute('role', 'list');
      grid.replaceWith(replacementGrid);
      grid = replacementGrid;
      return grid;
    };

    index.querySelectorAll('template[data-prada-linked-product]').forEach((template) => {
      const linkedCollectionId = template.dataset.collectionId;
      const productId = template.dataset.productId;
      if (!linkedCollectionId || !context.targetCollectionIds.has(linkedCollectionId) || !productId) return;

      const belongsToTargetNatively = includesTargetCollection(
        template.dataset.nativeCollectionIds,
        context.targetCollectionIds
      );
      if (belongsToTargetNatively) return;

      linkedProductIds.add(productId);
      if (appendTemplateItem(gridForAppend(), template, productId, renderedIds)) appended += 1;
    });

    if (context.isAggregate) {
      index.querySelectorAll('template[data-prada-native-product]').forEach((template) => {
        if (!template.dataset.collectionId || !context.targetCollectionIds.has(template.dataset.collectionId)) return;
        if (appendTemplateItem(gridForAppend(), template, template.dataset.productId, renderedIds)) appended += 1;
      });
    }

    if (appended) {
      window.pradaCollectionCarouselSetup?.(grid);
      window.PradaWishlist?.sync?.();
      document.dispatchEvent(new Event('prada:collection:updated'));
    }

    return appended;
  };

  const fetchIndexPage = (url) => {
    const cacheKey = url.href;
    if (indexPageCache.has(cacheKey)) return indexPageCache.get(cacheKey);

    const request = fetch(cacheKey, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      priority: 'low',
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load linked products');
        return response.text();
      })
      .then((html) => new DOMParser().parseFromString(html, 'text/html'))
      .catch((error) => {
        indexPageCache.delete(cacheKey);
        throw error;
      });

    indexPageCache.set(cacheKey, request);
    return request;
  };

  const loadLinkedProducts = async (root, context) => {
    const indexUrl = root.dataset.linkedIndexUrl;
    const productCount = Number.parseInt(root.dataset.allProductsCount || '0', 10);
    if (!indexUrl || !productCount || !context.targetCollectionIds.size) return;

    const pages = Math.ceil(productCount / pageSize);
    const linkedProductIds = new Set();
    for (let page = 1; page <= pages; page += 1) {
      if (!isCurrentContext(root, context)) return;

      const url = new URL(indexUrl, window.location.origin);
      url.searchParams.set('view', 'linked-index');
      url.searchParams.set('page', String(page));

      try {
        const sourceDocument = await fetchIndexPage(url);
        appendMatchingProducts(root, sourceDocument, context, linkedProductIds);
        updateProductCount(root, context, linkedProductIds.size);
      } catch (_error) {
        if (isCurrentContext(root, context)) root.dataset.linkedProductsStatus = 'failed';
        return;
      }
    }

    if (!isCurrentContext(root, context)) return;
    root.dataset.linkedProductsStatus = 'ready';
    updateProductCount(root, context, linkedProductIds.size);
  };

  const initialize = (scope = document) => {
    scope.querySelectorAll?.('collection-component[data-linked-index-url]').forEach((root) => {
      initializeCollectionImages(root);

      const context = activeContext(root);
      if (!context.targetCollectionIds.size || initializedCollections.get(root) === context.key) return;

      initializedCollections.set(root, context.key);
      root.dataset.linkedProductsStatus = 'loading';
      window.requestAnimationFrame(() => loadLinkedProducts(root, context));
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(), { once: true });
  } else {
    initialize();
  }

  document.addEventListener('shopify:section:load', (event) => initialize(event.target));
  document.addEventListener('prada:collection:updated', () => initialize());
  window.addEventListener('pageshow', () => initialize());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') initialize();
  });
})();
