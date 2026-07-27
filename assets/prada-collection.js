(() => {
  const countSelector = '[data-prada-collection-count]';

  const syncCount = () => {
    const source = document.getElementById('ProductCount');
    const target = document.querySelector(countSelector);
    const count = source?.dataset.productCount;

    if (target && count) target.textContent = count;
  };

  const observeCount = () => {
    const source = document.getElementById('ProductCount');
    if (!source || source.dataset.pradaCollectionObserved === 'true') return;

    source.dataset.pradaCollectionObserved = 'true';
    new MutationObserver(syncCount).observe(source, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-product-count'],
    });
  };

  const initialize = () => {
    syncCount();
    observeCount();
  };

  document.addEventListener('shopify:section:load', initialize);
  document.addEventListener('DOMContentLoaded', initialize);

  if (document.readyState !== 'loading') initialize();
})();
