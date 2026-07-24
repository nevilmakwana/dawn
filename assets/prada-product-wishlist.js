(() => {
  if (window.pradaProductWishlistBound) return;
  window.pradaProductWishlistBound = true;

  const storageKey = 'greyexim-wishlist-v1';
  const buttonSelector = '[data-prada-product-wishlist]';
  let memoryItems = [];

  const normaliseItem = (item) => {
    if (!item?.id || !item?.title || !item?.url) return null;

    return {
      id: String(item.id),
      title: String(item.title),
      url: String(item.url),
      image: item.image ? String(item.image) : '',
      imageAlt: item.imageAlt ? String(item.imageAlt) : String(item.title),
      price: item.price ? String(item.price) : '',
      variantId: item.variantId ? String(item.variantId) : '',
      available: item.available !== false && item.available !== 'false',
    };
  };

  const getItems = () => {
    try {
      const savedItems = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(savedItems)) return memoryItems;

      const itemIds = new Set();
      const items = savedItems
        .map(normaliseItem)
        .filter((item) => item && !itemIds.has(item.id) && itemIds.add(item.id));

      memoryItems = items;
      return items;
    } catch {
      return memoryItems;
    }
  };

  const setItems = (items) => {
    memoryItems = items;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // The current page session remains usable when browser storage is unavailable.
    }
  };

  const itemFromButton = (button) => {
    return normaliseItem({
      id: button.dataset.productId,
      title: button.dataset.productTitle,
      url: button.dataset.productUrl,
      image: button.dataset.productImage,
      imageAlt: button.dataset.productImageAlt,
      price: button.dataset.productPrice,
      variantId: button.dataset.productVariantId,
      available: button.dataset.productAvailable,
    });
  };

  const setWishlistState = (button, isActive) => {
    const productTitle = button.getAttribute('data-product-title') || 'product';

    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.setAttribute(
      'aria-label',
      `${isActive ? 'Remove' : 'Add'} ${productTitle} ${isActive ? 'from' : 'to'} wishlist`,
    );
  };

  const syncButtons = (items = getItems()) => {
    const wishlistedIds = new Set(items.map((item) => item.id));

    document.querySelectorAll(buttonSelector).forEach((button) => {
      setWishlistState(button, wishlistedIds.has(button.dataset.productId));
    });
  };

  const notify = () => {
    const items = getItems();
    syncButtons(items);
    document.dispatchEvent(new CustomEvent('prada:wishlist-updated', { detail: { items } }));
    return items;
  };

  const add = (item) => {
    const normalisedItem = normaliseItem(item);
    if (!normalisedItem) return getItems();

    const items = getItems().filter((savedItem) => savedItem.id !== normalisedItem.id);
    items.push(normalisedItem);
    setItems(items);
    return notify();
  };

  const remove = (productId) => {
    const items = getItems().filter((item) => item.id !== String(productId));
    setItems(items);
    return notify();
  };

  const toggle = (item) => {
    const normalisedItem = normaliseItem(item);
    if (!normalisedItem) return { items: getItems(), isActive: false };

    const isActive = getItems().some((savedItem) => savedItem.id === normalisedItem.id);
    const items = isActive ? remove(normalisedItem.id) : add(normalisedItem);
    return { items, isActive: !isActive };
  };

  window.PradaWishlist = {
    add,
    get: getItems,
    has: (productId) => getItems().some((item) => item.id === String(productId)),
    remove,
    sync: syncButtons,
    toggle,
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest(buttonSelector);
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    toggle(itemFromButton(button));
  });

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) notify();
  });

  document.addEventListener('shopify:section:load', () => syncButtons());

  syncButtons();
  document.dispatchEvent(new CustomEvent('prada:wishlist-ready', { detail: { items: getItems() } }));
})();
