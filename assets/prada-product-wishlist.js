(() => {
  if (window.pradaProductWishlistBound) return;
  window.pradaProductWishlistBound = true;

  const storageKey = 'greyexim-wishlist-v1';
  const buttonSelector = '[data-prada-product-wishlist]';
  const indicatorSelector = '[data-prada-wishlist-indicator]';
  const notificationId = 'prada-wishlist-notification';
  let memoryItems = [];
  let notificationTimer;

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

  const syncHeaderIndicator = (items = getItems()) => {
    const hasItems = items.length > 0;

    document.querySelectorAll(indicatorSelector).forEach((indicator) => {
      indicator.classList.toggle('is-visible', hasItems);
    });

    document.querySelectorAll('#wishlist-icon-bubble').forEach((link) => {
      link.classList.toggle('has-wishlist-items', hasItems);
    });
  };

  const getWishlistUrl = () => {
    return document.querySelector('#wishlist-icon-bubble')?.href || '/collections/all?view=wishlist';
  };

  const getNotification = () => {
    let notification = document.getElementById(notificationId);
    if (notification) return notification;

    notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = 'prada-wishlist-notification';
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');

    const content = document.createElement('div');
    content.className = 'prada-wishlist-notification__content';

    const message = document.createElement('span');
    message.className = 'prada-wishlist-notification__message';
    message.textContent = 'Item added to wishlist';

    const viewLink = document.createElement('a');
    viewLink.className = 'prada-wishlist-notification__view';
    viewLink.href = getWishlistUrl();
    viewLink.textContent = 'View';

    content.append(message, viewLink);
    notification.append(content);
    document.body.append(notification);

    return notification;
  };

  const showAddedNotification = () => {
    const notification = getNotification();
    const viewLink = notification.querySelector('.prada-wishlist-notification__view');

    if (viewLink) viewLink.href = getWishlistUrl();

    window.clearTimeout(notificationTimer);
    window.requestAnimationFrame(() => notification.classList.add('is-visible'));

    notificationTimer = window.setTimeout(() => {
      notification.classList.remove('is-visible');
    }, 5000);
  };

  const notify = () => {
    const items = getItems();
    syncButtons(items);
    syncHeaderIndicator(items);
    document.dispatchEvent(new CustomEvent('prada:wishlist-updated', { detail: { items } }));
    return items;
  };

  const add = (item) => {
    const normalisedItem = normaliseItem(item);
    if (!normalisedItem) return getItems();

    const items = getItems().filter((savedItem) => savedItem.id !== normalisedItem.id);
    items.push(normalisedItem);
    setItems(items);
    const updatedItems = notify();
    showAddedNotification();
    return updatedItems;
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
    sync: notify,
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

  document.addEventListener('shopify:section:load', () => notify());

  const initialItems = notify();
  document.dispatchEvent(new CustomEvent('prada:wishlist-ready', { detail: { items: initialItems } }));
})();
