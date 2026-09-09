(() => {
  const initializedCollections = new WeakMap();
  const pageSize = 50;

  const updateProductCount = (root, linkedProductCount) => {
    const count = root.querySelector('.prada-collection__count');
    if (!count) return;

    const nativeProductCount = Number.parseInt(root.dataset.nativeProductCount || '0', 10);
    const totalProductCount = nativeProductCount + linkedProductCount;
    count.textContent = `${totalProductCount} ${totalProductCount === 1 ? 'product' : 'products'}`;
  };

  const appendMatchingProducts = (root, sourceDocument, collectionId, linkedProductIds) => {
    if (!root.isConnected || root.dataset.collectionId !== collectionId) return 0;

    const grid = root.querySelector('#product-grid');
    const index = sourceDocument.querySelector('[data-prada-linked-product-index]');
    if (!grid || !index || !collectionId) return 0;

    const renderedProductIds = new Set();
    grid.querySelectorAll('[data-prada-product-id]').forEach((item) => {
      if (item.dataset.pradaProductId) renderedProductIds.add(item.dataset.pradaProductId);
    });

    let appended = 0;
    index.querySelectorAll('template[data-prada-linked-product]').forEach((template) => {
      const productId = template.dataset.productId;
      const nativeCollectionIds = template.dataset.nativeCollectionIds || '|';
      const belongsToNativeCollection = nativeCollectionIds.includes(`|${collectionId}|`);
      if (template.dataset.collectionId !== collectionId || !productId || belongsToNativeCollection) return;

      linkedProductIds.add(productId);
      if (renderedProductIds.has(productId)) return;

      const item = template.content.firstElementChild?.cloneNode(true);
      if (!item) return;

      renderedProductIds.add(productId);
      grid.appendChild(item);
      appended += 1;
    });

    if (appended) {
      window.pradaCollectionCarouselSetup?.(grid);
      window.PradaWishlist?.sync?.();
      document.dispatchEvent(new Event('prada:collection:updated'));
    }

    return appended;
  };

  const loadLinkedProducts = async (root) => {
    const indexUrl = root.dataset.linkedIndexUrl;
    const productCount = Number.parseInt(root.dataset.allProductsCount || '0', 10);
    const collectionId = root.dataset.collectionId;
    if (!indexUrl || !productCount || !collectionId) return;

    const pages = Math.ceil(productCount / pageSize);
    const linkedProductIds = new Set();
    for (let page = 1; page <= pages; page += 1) {
      if (!root.isConnected || root.dataset.collectionId !== collectionId) return;

      const url = new URL(indexUrl, window.location.origin);
      url.searchParams.set('view', 'linked-index');
      url.searchParams.set('page', String(page));

      try {
        const response = await fetch(url.href, {
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          priority: 'low',
        });
        if (!response.ok) throw new Error('Unable to load linked products');

        const html = await response.text();
        const sourceDocument = new DOMParser().parseFromString(html, 'text/html');
        appendMatchingProducts(root, sourceDocument, collectionId, linkedProductIds);
        updateProductCount(root, linkedProductIds.size);
      } catch (_error) {
        if (root.dataset.collectionId === collectionId) root.dataset.linkedProductsStatus = 'failed';
        return;
      }
    }

    if (root.dataset.collectionId !== collectionId) return;
    root.dataset.linkedProductsStatus = 'ready';
    updateProductCount(root, linkedProductIds.size);
  };

  const initialize = (scope = document) => {
    scope.querySelectorAll?.('collection-component[data-linked-index-url]').forEach((root) => {
      const collectionId = root.dataset.collectionId;
      if (!collectionId || initializedCollections.get(root) === collectionId) return;

      initializedCollections.set(root, collectionId);
      root.dataset.linkedProductsStatus = 'loading';
      window.requestAnimationFrame(() => loadLinkedProducts(root));
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(), { once: true });
  } else {
    initialize();
  }

  document.addEventListener('shopify:section:load', (event) => initialize(event.target));
  document.addEventListener('prada:collection:updated', () => initialize());
})();
