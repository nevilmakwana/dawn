const updatePradaCartIcon = (itemCount) => {
  const cartLink = document.querySelector('.prada-header-btn--cart#cart-icon-bubble');
  if (!cartLink) return;

  // The cart button owns the Prada SVG. Only manage its numeric badge here.
  // Replacing or removing child markup makes Dawn's default cart SVG appear.
  let badge = cartLink.querySelector(':scope > .prada-cart-badge');

  if (itemCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'prada-cart-badge';
      badge.setAttribute('aria-hidden', 'true');
      cartLink.append(badge);
    }
    badge.textContent = String(itemCount);
  } else {
    badge?.remove();
  }

  cartLink.querySelector(':scope > .cart-count-bubble')?.remove();
  cartLink.setAttribute('aria-label', itemCount > 0 ? `Cart (${itemCount})` : 'Cart');

  document.querySelectorAll('[data-prada-drawer-cart-count]').forEach((count) => {
    count.classList.toggle('is-hidden', itemCount === 0);
    count.lastChild.textContent = String(itemCount);
    count.setAttribute('aria-label', `${itemCount} items in shopping bag`);
  });
};

const refreshPradaCartIcon = async () => {
  try {
    const cartUrl = window.routes?.cart_url || '/cart';
    const cart = typeof CartItems !== 'undefined'
      ? await CartItems.fetchCartData()
      : await fetch(`${cartUrl}.js`, { headers: { Accept: 'application/json' } }).then((response) =>
          response.ok ? response.json() : null
        );
    if (typeof cart?.item_count === 'number') updatePradaCartIcon(cart.item_count);
  } catch (_error) {
    // A badge refresh must never interrupt a successful add-to-cart action.
  }
};

window.PradaCartHeader = window.PradaCartHeader || {};
window.PradaCartHeader.update = updatePradaCartIcon;
window.PradaCartHeader.refresh = refreshPradaCartIcon;

if (!window.pradaFastCheckoutBound) {
  window.pradaFastCheckoutBound = true;
  document.addEventListener('click', (event) => {
    const checkoutButton = event.target.closest('[data-prada-fast-checkout]');
    if (!checkoutButton || checkoutButton.disabled || checkoutButton.getAttribute('aria-disabled') === 'true') return;

    const checkoutUrl = checkoutButton.dataset.pradaFastCheckout;
    if (!checkoutUrl) return;

    event.preventDefault();
    document.querySelectorAll('[data-prada-fast-checkout]').forEach((button) => {
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-disabled', 'true');
      if ('disabled' in button) button.disabled = true;
    });
    window.location.assign(checkoutUrl);
  });
}

const isPradaCartPage = () => {
  const cartPath = new URL(window.routes?.cart_url || '/cart', window.location.origin).pathname.replace(/\/+$/, '') || '/';
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

  return currentPath === cartPath;
};

const PRADA_CART_DRAWER_TRANSITION_DURATION = 260;

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.bindOverlay();
    this.setHeaderCartIconAccessibility();
  }

  beginOptimisticAdd(item, triggeredBy) {
    if (!item) return null;
    let carriedState = null;
    if (this.optimisticState) {
      if (this.optimisticState.confirmed && !this.optimisticState.removalPending) {
        const confirmedRow = [...this.querySelectorAll('.prada-cart-drawer__optimistic .cart-item')]
          .find((row) => this.getOptimisticRowVariantId(row) === String(this.optimisticState.item.variantId));
        if (confirmedRow && this.optimisticState.addedLineKey) {
          confirmedRow.dataset.pradaOptimisticLineKey = this.optimisticState.addedLineKey;
        }
        const carriedRows = [...this.querySelectorAll('.prada-cart-drawer__optimistic .cart-item')]
          .map((row) => row.cloneNode(true));
        carriedState = this.completeOptimisticAdd();
        carriedState.optimisticRows = carriedRows;
        this.dataset.cartItemCount = String(carriedState.optimisticCount);
        this.dataset.cartTotalPrice = String(carriedState.optimisticTotal);
        this.classList.remove('is-empty');
        this.classList.toggle('prada-cart-drawer--multiple', carriedState.optimisticLineCount > 1);
      } else {
        this.cancelOptimisticAdd(this.optimisticState, { keepDrawer: true });
      }
    }

    const previousCount = Number.parseInt(this.dataset.cartItemCount || '0', 10) || 0;
    const previousTotal = Number.parseInt(this.dataset.cartTotalPrice || '0', 10) || 0;
    const quantity = Number.parseInt(item.quantity || '1', 10) || 1;
    const optimisticCount = previousCount + quantity;
    const existingVariantInput = [...this.querySelectorAll('[data-quantity-variant-id]')]
      .find((input) => String(input.dataset.quantityVariantId) === String(item.variantId));
    const renderedExistingQuantity = Number.parseInt(existingVariantInput?.value || '0', 10) || 0;
    const carriedExistingQuantity =
      String(carriedState?.item?.variantId) === String(item.variantId)
        ? carriedState.optimisticLineQuantity
        : 0;
    const existingQuantity = Math.max(renderedExistingQuantity, carriedExistingQuantity);
    const hasExistingVariant = Boolean(existingVariantInput || carriedExistingQuantity);
    const renderedLineCount = carriedState?.optimisticLineCount ?? this.querySelectorAll('.cart-item').length;
    const optimisticLineCount = renderedLineCount + (hasExistingVariant ? 0 : 1);
    const optimisticTotal = previousTotal + item.priceCents * quantity;
    const state = {
      id: `${Date.now()}-${Math.random()}`,
      item,
      previousCount,
      previousTotal,
      optimisticCount,
      optimisticTotal,
      optimisticLineCount,
      optimisticLineQuantity: existingQuantity + quantity,
      wasEmpty: this.classList.contains('is-empty'),
      wasMultiple: this.classList.contains('prada-cart-drawer--multiple'),
      wasOpen: this.classList.contains('active') || this.classList.contains('is-opening'),
      queuedDestination: null,
      confirmed: false,
      addedLineKey: null,
      parsedState: null,
      removeQueued: false,
      removalPending: false,
    };

    this.optimisticState = state;
    this.querySelector('.prada-cart-drawer__optimistic')?.remove();
    this.dataset.cartItemCount = String(optimisticCount);
    this.dataset.cartTotalPrice = String(optimisticTotal);
    this.classList.remove('is-empty');
    this.classList.add('is-optimistic');
    this.classList.toggle('prada-cart-drawer--multiple', optimisticLineCount > 1);
    updatePradaCartIcon(optimisticCount);

    const panel = document.createElement('div');
    panel.className = 'prada-cart-drawer__optimistic';
    panel.dataset.optimisticId = state.id;

    const header = document.createElement('div');
    header.className = 'drawer__header';
    const heading = document.createElement('h2');
    heading.className = 'drawer__heading';
    const desktopHeading = document.createElement('span');
    desktopHeading.className = 'prada-cart-drawer__heading-desktop';
    desktopHeading.textContent = `Your selection (${optimisticCount})`;
    const mobileHeading = document.createElement('span');
    mobileHeading.className = 'prada-cart-drawer__heading-mobile';
    mobileHeading.textContent = `Added to shopping bag (${optimisticCount})`;
    heading.append(desktopHeading, mobileHeading);

    const sourceClose = this.querySelector('.drawer__header .drawer__close, .drawer__inner-empty .drawer__close');
    const closeButton = sourceClose?.cloneNode(true) || document.createElement('button');
    closeButton.type = 'button';
    closeButton.classList.add('drawer__close');
    closeButton.removeAttribute('onclick');
    closeButton.setAttribute('aria-label', 'Close shopping bag');
    if (!closeButton.hasChildNodes()) closeButton.textContent = '×';
    closeButton.addEventListener('click', () => this.close());
    header.append(heading, closeButton);

    const items = document.createElement('div');
    items.className = 'prada-cart-drawer__optimistic-items';
    this.populateOptimisticCartItems(items, item, quantity, existingQuantity, optimisticLineCount, carriedState);
    state.optimisticItemsHandler = (event) => {
      const removeButton = event.target.closest('.prada-cart-drawer__remove');
      if (!removeButton || !items.contains(removeButton)) return;

      event.preventDefault();
      event.stopPropagation();
      this.beginOptimisticRemove(state, removeButton, event);
    };
    items.addEventListener('click', state.optimisticItemsHandler, true);

    const footer = this.querySelector('.drawer__inner > .drawer__footer')?.cloneNode(true);
    if (footer) {
      footer.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      const total = footer.querySelector('.totals__total-value');
      if (total && item.priceCents) {
        total.textContent = this.formatOptimisticMoney(optimisticTotal, total.textContent);
      }
      const checkoutButton = footer.querySelector('[data-prada-fast-checkout]');
      if (checkoutButton) {
        checkoutButton.disabled = false;
        checkoutButton.removeAttribute('disabled');
        checkoutButton.removeAttribute('aria-disabled');
      }
      state.pendingActionHandler = (event) => {
        const action = event.target.closest('.prada-cart-drawer__view-cart, [data-prada-fast-checkout]');
        if (!action || !footer.contains(action)) return;

        const destination = action.matches('.prada-cart-drawer__view-cart')
          ? action.href
          : action.dataset.pradaFastCheckout;
        if (!destination) return;

        event.preventDefault();
        event.stopPropagation();

        if (state.confirmed && !state.removalPending) {
          state.queuedDestination = null;
          window.location.assign(destination);
          return;
        }

        state.queuedDestination = destination;
        action.setAttribute('aria-busy', 'true');
      };
      footer.addEventListener('click', state.pendingActionHandler, true);
    }

    panel.append(header, items);
    if (footer) panel.append(footer);
    this.querySelector('.drawer__inner')?.append(panel);
    this.setActiveElement(triggeredBy);
    this.open();
    return state;
  }

  populateOptimisticCartItems(container, item, addedQuantity, existingQuantity, lineCount, carriedState) {
    const carriedRows = carriedState?.optimisticRows || [];
    const renderedRows = [...this.querySelectorAll('.drawer__cart-items-wrapper .cart-item')]
      .map((row) => row.cloneNode(true));
    const rows = (carriedRows.length ? carriedRows : renderedRows);
    const matchesVariant = (row) =>
      String(
        row.dataset.pradaOptimisticVariantId ||
        row.querySelector('[data-quantity-variant-id]')?.dataset.quantityVariantId ||
        '',
      ) === String(item.variantId);
    const existingRow = rows.find(matchesVariant) || null;
    const updatedRow = this.createOptimisticCartItem(item, addedQuantity, existingQuantity, existingRow);
    const orderedRows = [updatedRow, ...rows.filter((row) => !matchesVariant(row))];

    orderedRows.forEach((row) => {
      row.removeAttribute('id');
      row.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'drawer__cart-items-wrapper';
    const table = document.createElement('table');
    table.className = 'cart-items prada-cart-drawer__items';
    table.setAttribute('role', 'table');
    const body = document.createElement('tbody');
    body.setAttribute('role', 'rowgroup');
    body.append(...orderedRows);
    table.append(body);
    wrapper.append(table);
    container.classList.toggle('is-multiple', lineCount > 1);
    table.classList.toggle('prada-cart-drawer__items--multiple', lineCount > 1);
    container.append(wrapper);
  }

  createOptimisticCartItem(item, addedQuantity, carriedExistingQuantity = 0, sourceItem = null) {
    const existingQuantityInput = sourceItem?.querySelector('[data-quantity-variant-id]') ||
      [...this.querySelectorAll('[data-quantity-variant-id]')]
        .find((input) => String(input.dataset.quantityVariantId) === String(item.variantId));
    const existingItem = sourceItem || existingQuantityInput?.closest('.cart-item');
    const existingQuantity = Math.max(
      Number.parseInt(existingQuantityInput?.value || '0', 10) || 0,
      carriedExistingQuantity,
    );
    const optimisticQuantity = existingQuantity + addedQuantity;

    if (existingItem) {
      const clonedItem = existingItem.cloneNode(true);
      clonedItem.dataset.pradaOptimisticVariantId = String(item.variantId);
      clonedItem.removeAttribute('id');
      clonedItem.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      const quantityLabel = clonedItem.querySelector('.prada-cart-drawer__quantity');
      if (quantityLabel) quantityLabel.textContent = `Qty: ${optimisticQuantity}`;
      const clonedImage = clonedItem.querySelector('.cart-item__image');
      if (clonedImage && item.image) {
        clonedImage.src = item.image;
        clonedImage.alt = item.imageAlt || item.title;
      }
      clonedItem.querySelectorAll('.quantity__input').forEach((input) => {
        input.value = String(optimisticQuantity);
        input.setAttribute('value', String(optimisticQuantity));
      });
      return clonedItem;
    }

    const product = document.createElement('tr');
    product.className = 'cart-item prada-cart-drawer__optimistic-new-item';
    product.dataset.pradaOptimisticVariantId = String(item.variantId);
    product.setAttribute('role', 'row');

    const media = document.createElement('td');
    media.className = 'cart-item__media';
    media.setAttribute('role', 'cell');
    if (item.image) {
      const imageLink = document.createElement('a');
      imageLink.className = 'cart-item__link';
      imageLink.href = item.url || '#';
      imageLink.tabIndex = -1;
      imageLink.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.className = 'cart-item__image';
      image.src = item.image;
      image.alt = item.imageAlt || item.title;
      image.width = 150;
      image.height = 188;
      image.decoding = 'async';
      imageLink.append(image);
      media.append(imageLink);
    }

    const details = document.createElement('td');
    details.className = 'cart-item__details';
    details.setAttribute('role', 'cell');
    const titleWrap = document.createElement('div');
    titleWrap.className = 'cart-item__title';
    const title = document.createElement('a');
    title.className = 'cart-item__name h4 break';
    title.href = item.url || '#';
    title.textContent = item.title;
    titleWrap.append(title);
    details.append(titleWrap);

    const itemInfo = document.createElement('div');
    itemInfo.className = 'prada-cart-drawer__item-info';
    item.options?.forEach((option) => {
      const row = document.createElement('p');
      row.className = 'prada-cart-drawer__option';
      row.textContent = `${option.name}: ${option.value}`;
      itemInfo.append(row);
    });
    const quantity = document.createElement('p');
    quantity.className = 'prada-cart-drawer__quantity';
    quantity.textContent = `Qty: ${optimisticQuantity}`;
    itemInfo.append(quantity);
    if (item.price) {
      const price = document.createElement('p');
      price.className = 'prada-cart-drawer__price money';
      price.textContent = item.price;
      itemInfo.append(price);
    }
    const removeWrap = document.createElement('span');
    removeWrap.className = 'prada-cart-drawer__remove-wrap';
    const remove = document.createElement('button');
    remove.className = 'prada-cart-drawer__remove';
    remove.type = 'button';
    remove.textContent = 'Remove';
    removeWrap.append(remove);
    itemInfo.append(removeWrap);
    details.append(itemInfo);
    product.append(media, details);
    return product;
  }

  formatOptimisticMoney(cents, referenceText = '') {
    const locale = document.documentElement.lang || 'en-IN';
    const currency = window.Shopify?.currency?.active || 'INR';
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
    const prefix = referenceText.trim().match(/^[^\d-]+/)?.[0]?.trim();

    if (prefix) return `${prefix} ${formattedNumber}`;
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
  }

  parseOptimisticMoney(text = '') {
    const value = Number.parseFloat(String(text).replace(/[^\d.,-]/g, '').replace(/,/g, ''));
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }

  getOptimisticRowVariantId(row) {
    return String(
      row?.dataset.pradaOptimisticVariantId ||
      row?.querySelector('[data-quantity-variant-id]')?.dataset.quantityVariantId ||
      '',
    );
  }

  getOptimisticRowLineKey(row) {
    return row?.dataset.pradaOptimisticLineKey ||
      row?.querySelector('[data-quantity-line-key]')?.dataset.quantityLineKey ||
      null;
  }

  getOptimisticRowQuantity(row) {
    const inputQuantity = Number.parseInt(row?.querySelector('[data-quantity-variant-id]')?.value || '0', 10) || 0;
    if (inputQuantity > 0) return inputQuantity;

    const label = row?.querySelector('.prada-cart-drawer__quantity')?.textContent || '';
    return Number.parseInt(label.match(/\d+/)?.[0] || '1', 10) || 1;
  }

  beginOptimisticRemove(state, removeButton, event) {
    if (!state || this.optimisticState?.id !== state.id || state.removalPending) return;

    const removedItem = removeButton.closest('.cart-item');
    const removedVariantId = this.getOptimisticRowVariantId(removedItem);
    const removedLineKey = this.getOptimisticRowLineKey(removedItem);
    if (!removedItem || (!removedVariantId && !removedLineKey)) return;

    const removedLineQuantity = this.getOptimisticRowQuantity(removedItem);
    const displayedUnitPrice = this.parseOptimisticMoney(
      removedItem.querySelector('.prada-cart-drawer__price')?.textContent,
    );
    const removingAddedLine = removedVariantId === String(state.item.variantId);
    const unitPrice = displayedUnitPrice || (removingAddedLine ? state.item.priceCents : 0);

    this.cancelScheduledOptimisticRefresh(state);
    state.removeQueued = true;
    state.removalPending = true;
    state.queuedDestination = null;
    state.removedItem = removedItem;
    state.removedVariantId = removedVariantId;
    state.removedLineKey = removedLineKey;
    state.removedLineQuantity = removedLineQuantity;
    state.removedLineTotal = unitPrice * removedLineQuantity;
    state.removingAddedLine = removingAddedLine;
    removedItem.setAttribute('hidden', '');

    const nextCount = Math.max(0, state.optimisticCount - removedLineQuantity);
    const nextTotal = Math.max(0, state.optimisticTotal - state.removedLineTotal);
    state.removedCount = nextCount;
    state.removedTotal = nextTotal;
    this.dataset.cartItemCount = String(nextCount);
    this.dataset.cartTotalPrice = String(nextTotal);
    updatePradaCartIcon(nextCount);

    const panel = this.querySelector(`.prada-cart-drawer__optimistic[data-optimistic-id="${state.id}"]`);
    const desktop = panel?.querySelector('.prada-cart-drawer__heading-desktop');
    const mobile = panel?.querySelector('.prada-cart-drawer__heading-mobile');
    if (desktop) desktop.textContent = `Your selection (${nextCount})`;
    if (mobile) mobile.textContent = `Shopping bag (${nextCount})`;
    const subtotal = panel?.querySelector('.totals__total-value');
    if (subtotal) subtotal.textContent = this.formatOptimisticMoney(nextTotal, subtotal.textContent);

    if (nextCount === 0) this.showOptimisticEmptyState(state, panel);
    if (event) CartPerformance.measureFromEvent('remove:optimistic-ui', event);
    if (state.confirmed) void this.performOptimisticRemove(state);
  }

  showOptimisticEmptyState(state, panel) {
    if (!panel || panel.querySelector('.prada-cart-drawer__optimistic-empty')) return;

    panel.querySelector(':scope > .drawer__header')?.setAttribute('hidden', '');
    panel.querySelector(':scope > .prada-cart-drawer__optimistic-items')?.setAttribute('hidden', '');
    panel.querySelector(':scope > .drawer__footer')?.setAttribute('hidden', '');

    const sourceEmpty = this.querySelector('.drawer__inner-empty');
    const empty = sourceEmpty?.cloneNode(true) || document.createElement('div');
    empty.classList.add('drawer__inner-empty', 'prada-cart-drawer__optimistic-empty');
    empty.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));

    const closeButton = empty.querySelector('.drawer__close');
    if (closeButton) {
      closeButton.removeAttribute('onclick');
      closeButton.addEventListener('click', () => this.close());
    }

    if (!empty.hasChildNodes()) {
      const message = document.createElement('p');
      message.className = 'cart__empty-text';
      message.textContent = 'Your shopping bag is empty';
      empty.append(message);
    }

    panel.append(empty);
    this.classList.add('is-empty', 'is-optimistic-empty');
    this.classList.remove('prada-cart-drawer--multiple');
    state.optimisticEmpty = empty;
  }

  async performOptimisticRemove(state) {
    if (!state || this.optimisticState?.id !== state.id || state.removeRequestStarted) return;
    const lineIdentifier = state.removingAddedLine
      ? state.addedLineKey || state.removedLineKey || state.removedVariantId
      : state.removedLineKey || state.removedVariantId;
    if (!lineIdentifier) return;

    state.removeRequestStarted = true;
    const mutationMarker = CartPerformance.createStartingMarker('remove:mutation');
    try {
      const body = JSON.stringify({
        id: lineIdentifier,
        quantity: 0,
        sections: this.getSectionsToRender().map((section) => section.id),
        sections_url: window.location.pathname,
      });
      const removeRequest = () =>
        fetch(`${routes.cart_change_url}`, { ...fetchConfig(), body }).then(async (response) => ({
          response,
          parsedState: await response.json(),
        }));
      const { response, parsedState } = window.PradaCartMutations?.enqueue
        ? await window.PradaCartMutations.enqueue(removeRequest)
        : await removeRequest();
      if (!response.ok || parsedState.status) throw new Error(parsedState.description || 'Unable to remove item');

      this.completeOptimisticAdd();
      this.renderContents(parsedState, { shouldOpen: false });
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'cart-items',
        variantId: state.removedVariantId,
        cartData: parsedState,
      });
    } catch (error) {
      console.error(error);
      this.restoreOptimisticRemove(state);
    } finally {
      CartPerformance.measureFromMarker('remove:mutation', mutationMarker);
    }
  }

  restoreOptimisticRemove(state) {
    if (!state || this.optimisticState?.id !== state.id) return;

    state.removeQueued = false;
    state.removalPending = false;
    state.removeRequestStarted = false;
    state.removedItem?.removeAttribute('hidden');
    state.optimisticEmpty?.remove();
    state.optimisticEmpty = null;
    const panel = this.querySelector(`.prada-cart-drawer__optimistic[data-optimistic-id="${state.id}"]`);
    panel?.querySelector(':scope > .drawer__header')?.removeAttribute('hidden');
    panel?.querySelector(':scope > .prada-cart-drawer__optimistic-items')?.removeAttribute('hidden');
    panel?.querySelector(':scope > .drawer__footer')?.removeAttribute('hidden');
    const desktop = panel?.querySelector('.prada-cart-drawer__heading-desktop');
    const mobile = panel?.querySelector('.prada-cart-drawer__heading-mobile');
    if (desktop) desktop.textContent = `Your selection (${state.optimisticCount})`;
    if (mobile) mobile.textContent = `Added to shopping bag (${state.optimisticCount})`;
    const subtotal = panel?.querySelector('.totals__total-value');
    if (subtotal) subtotal.textContent = this.formatOptimisticMoney(state.optimisticTotal, subtotal.textContent);

    this.dataset.cartItemCount = String(state.optimisticCount);
    this.dataset.cartTotalPrice = String(state.optimisticTotal);
    this.classList.remove('is-empty', 'is-optimistic-empty');
    this.classList.toggle('prada-cart-drawer--multiple', state.optimisticLineCount > 1);
    updatePradaCartIcon(state.optimisticCount);
  }

  scheduleRefreshAfterOptimisticAdd(state, { after } = {}) {
    if (!state || this.optimisticState?.id !== state.id || state.removalPending || state.refreshScheduled) return;

    state.refreshScheduled = true;
    state.refreshDependency = after || null;
    const runRefresh = () => {
      state.refreshScheduled = false;
      state.idleRefreshId = null;
      Promise.resolve(state.refreshDependency)
        .catch(() => undefined)
        .then(() => this.refreshAfterOptimisticAdd(state));
    };
    if ('requestIdleCallback' in window) {
      state.idleRefreshType = 'idle';
      state.idleRefreshId = window.requestIdleCallback(runRefresh, { timeout: 2000 });
    } else {
      state.idleRefreshType = 'timeout';
      state.idleRefreshId = window.setTimeout(runRefresh, 500);
    }
  }

  cancelScheduledOptimisticRefresh(state) {
    if (!state?.idleRefreshId) return;
    if (state.idleRefreshType === 'idle' && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(state.idleRefreshId);
    } else {
      window.clearTimeout(state.idleRefreshId);
    }
    state.idleRefreshId = null;
    state.refreshScheduled = false;
  }

  flushScheduledOptimisticRefresh(state) {
    if (!state || this.optimisticState?.id !== state.id || state.removalPending) return;
    this.cancelScheduledOptimisticRefresh(state);
    const dependency = state.refreshDependency;
    Promise.resolve(dependency)
      .catch(() => undefined)
      .then(() => this.refreshAfterOptimisticAdd(state));
  }

  refreshAfterOptimisticAdd(state) {
    if (
      !state ||
      this.optimisticState?.id !== state.id ||
      state.removalPending ||
      state.refreshInFlight ||
      state.parsedState
    ) return;

    state.refreshInFlight = true;

    const cartUrl = new URL(window.routes?.cart_url || '/cart', window.location.origin);
    cartUrl.searchParams.set('section_id', 'cart-drawer');

    fetch(cartUrl.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Cart drawer refresh failed: ${response.status}`);
        return response.text();
      })
      .then((html) => {
        if (this.optimisticState?.id !== state.id || state.removalPending) return;
        this.renderContents({ sections: { 'cart-drawer': html } }, { shouldOpen: false });
      })
      .catch((error) => console.error(error))
      .finally(() => {
        state.refreshInFlight = false;
      });
  }

  completeOptimisticAdd() {
    const completedState = this.optimisticState;
    this.cancelScheduledOptimisticRefresh(completedState);
    const items = this.querySelector('.prada-cart-drawer__optimistic-items');
    const footer = this.querySelector('.prada-cart-drawer__optimistic > .drawer__footer');
    if (items && completedState?.optimisticItemsHandler) {
      items.removeEventListener('click', completedState.optimisticItemsHandler, true);
    }
    if (footer && completedState?.pendingActionHandler) {
      footer.removeEventListener('click', completedState.pendingActionHandler, true);
    }
    this.querySelector('.prada-cart-drawer__optimistic')?.remove();
    this.classList.remove('is-optimistic', 'is-optimistic-empty');
    this.optimisticState = null;
    return completedState;
  }

  confirmOptimisticAdd(state, parsedState) {
    if (!state || this.optimisticState?.id !== state.id) return;

    state.confirmed = true;
    state.addedLineKey = parsedState?.key || state.addedLineKey || null;
    const addedRow = [...this.querySelectorAll('.prada-cart-drawer__optimistic .cart-item')]
      .find((row) => this.getOptimisticRowVariantId(row) === String(state.item.variantId));
    if (addedRow && state.addedLineKey) addedRow.dataset.pradaOptimisticLineKey = state.addedLineKey;
    if (parsedState?.sections?.['cart-drawer']) state.parsedState = parsedState;

    if (state.removeQueued) {
      void this.performOptimisticRemove(state);
      return;
    }

    if (state.queuedDestination) {
      const destination = state.queuedDestination;
      state.queuedDestination = null;
      window.location.assign(destination);
    }
  }

  cancelOptimisticAdd(state, { keepDrawer = false } = {}) {
    if (!state || this.optimisticState?.id !== state.id) return;

    this.completeOptimisticAdd();
    this.classList.toggle('is-empty', state.wasEmpty);
    this.classList.toggle('prada-cart-drawer--multiple', state.wasMultiple);
    this.dataset.cartItemCount = String(state.previousCount);
    this.dataset.cartTotalPrice = String(state.previousTotal);
    updatePradaCartIcon(state.previousCount);
    this.optimisticState = null;

    if (!keepDrawer && !state.wasOpen) this.close();
  }

  bindOverlay() {
    const overlay = this.querySelector('#CartDrawer-Overlay');
    if (!overlay || overlay.dataset.cartDrawerBound) return;

    overlay.dataset.cartDrawerBound = 'true';
    overlay.addEventListener('click', this.close.bind(this));
  }

  setHeaderCartIconAccessibility() {
    if (this.headerCartControlBound) return;

    this.headerCartControlBound = true;

    const getCartLink = (target) => {
      if (!(target instanceof Element)) return null;
      return target.closest('#cart-icon-bubble.prada-header-btn--cart');
    };

    const openFromHeader = (event) => {
      const cartLink = getCartLink(event.target);
      if (!cartLink) return;

      if (isPradaCartPage() || cartLink.dataset.pradaCartDisabled === 'true' || cartLink.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      cartLink.setAttribute('role', 'button');
      cartLink.setAttribute('aria-haspopup', 'dialog');

      if (this.classList.contains('active') || this.classList.contains('is-opening')) return;

      this.open(cartLink);
    };

    document.addEventListener('click', openFromHeader);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      openFromHeader(event);
    });

    const cartLink = document.querySelector('#cart-icon-bubble.prada-header-btn--cart');
    if (cartLink) {
      if (isPradaCartPage()) {
        cartLink.setAttribute('aria-disabled', 'true');
        cartLink.setAttribute('data-prada-cart-disabled', 'true');
        cartLink.setAttribute('tabindex', '-1');
        return;
      }

      cartLink.setAttribute('role', 'button');
      cartLink.setAttribute('aria-haspopup', 'dialog');
    }
  }

  open(triggeredBy) {
    if (this.classList.contains('active') && !this.classList.contains('is-closing')) return;
    if (triggeredBy) {
      this.setActiveElement(triggeredBy);
      triggeredBy.setAttribute('aria-expanded', 'true');
    }
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);

    if (this.openAnimationFrame) {
      cancelAnimationFrame(this.openAnimationFrame);
      this.openAnimationFrame = null;
    }
    if (this.openFocusTimer) {
      clearTimeout(this.openFocusTimer);
      this.openFocusTimer = null;
    }
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    const focusOnOpen = () => {
      const containerToTrapFocusOn = this.classList.contains('is-empty')
        ? this.querySelector('.drawer__inner-empty')
        : document.getElementById('CartDrawer');
      const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
      trapFocus(containerToTrapFocusOn, focusElement);
    };

    this.classList.remove('is-closing');
    this.classList.add('animate', 'is-opening');
    this.classList.remove('active');
    this.openAnimationFrame = requestAnimationFrame(() => {
      this.openAnimationFrame = requestAnimationFrame(() => {
        this.openAnimationFrame = null;
        if (this.classList.contains('is-closing')) return;

        this.classList.add('active');
      });
    });

    this.openFocusTimer = setTimeout(() => {
      this.openFocusTimer = null;
      this.classList.remove('is-opening');
      if (this.classList.contains('active')) focusOnOpen();
    }, PRADA_CART_DRAWER_TRANSITION_DURATION);

    if (window.pradaDrawerScrollLock) {
      window.pradaDrawerScrollLock.lock();
    } else {
      document.body.classList.add('overflow-hidden');
    }

    // cart-drawer-items is a CartItems subclass that extends createViewEventElement.
    // Its `view-event-trigger="manual"` skips auto-dispatch on connect; we fire
    // it here when the drawer opens, with `context: 'dialog'` from the payload attribute.
    this.querySelector('cart-drawer-items')?.dispatchViewEvent();
  }

  close() {
    if (this.classList.contains('is-closing')) return;

    if (this.optimisticState) this.optimisticState.dismissed = true;

    if (this.openAnimationFrame) {
      cancelAnimationFrame(this.openAnimationFrame);
      this.openAnimationFrame = null;
    }
    if (this.openFocusTimer) {
      clearTimeout(this.openFocusTimer);
      this.openFocusTimer = null;
    }

    const finishClose = () => {
      this.closeTimer = null;
      this.classList.remove('active', 'animate', 'is-closing', 'is-opening');
      removeTrapFocus(this.activeElement);
      this.activeElement?.setAttribute?.('aria-expanded', 'false');

      if (window.pradaDrawerScrollLock) {
        window.pradaDrawerScrollLock.unlock();
      } else {
        document.body.classList.remove('overflow-hidden');
      }

      const optimisticState = this.optimisticState;
      if (optimisticState?.confirmed && !optimisticState.removalPending) {
        if (optimisticState.parsedState) {
          this.completeOptimisticAdd();
          this.renderContents(optimisticState.parsedState, { shouldOpen: false });
        } else {
          this.flushScheduledOptimisticRefresh(optimisticState);
        }
      }
    };

    if (!this.classList.contains('active') && !this.classList.contains('animate')) {
      finishClose();
      return;
    }

    this.classList.remove('is-opening');
    this.classList.add('is-closing');
    this.classList.remove('active');
    this.closeTimer = setTimeout(finishClose, PRADA_CART_DRAWER_TRANSITION_DURATION);
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState, { shouldOpen = true } = {}) {
    const optimisticImage = this.querySelector('.prada-cart-drawer__optimistic .cart-item__image');
    const optimisticImageSrc = optimisticImage?.currentSrc || optimisticImage?.src || '';
    const optimisticState = this.optimisticState;
    const sourceDrawer = parsedState.sections?.['cart-drawer']
      ? this.getSectionDOM(parsedState.sections['cart-drawer'], 'cart-drawer')
      : null;
    const sectionItemCount = Number.parseInt(sourceDrawer?.dataset.cartItemCount || '', 10);
    const sectionTotalPrice = Number.parseInt(sourceDrawer?.dataset.cartTotalPrice || '', 10);
    const itemCount =
      typeof parsedState.item_count === 'number'
        ? parsedState.item_count
        : Number.isFinite(sectionItemCount)
          ? sectionItemCount
          : null;

    if (optimisticState) {
      this.confirmOptimisticAdd(optimisticState, parsedState);
      if (optimisticState.removalPending) return;

      const drawerIsVisible =
        this.classList.contains('active') ||
        this.classList.contains('animate') ||
        this.classList.contains('is-opening') ||
        this.classList.contains('is-closing');
      if (!optimisticState.dismissed || drawerIsVisible) return;

      this.completeOptimisticAdd();
    }

    if (itemCount !== null) {
      this.dataset.cartItemCount = String(itemCount);
      this.classList.toggle('is-empty', itemCount === 0);
      updatePradaCartIcon(itemCount);
    }
    if (Number.isFinite(sectionTotalPrice)) this.dataset.cartTotalPrice = String(sectionTotalPrice);
    if (sourceDrawer) {
      this.classList.toggle(
        'prada-cart-drawer--multiple',
        sourceDrawer.classList.contains('prada-cart-drawer--multiple'),
      );
    }
    this.productId = parsedState.id;

    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      const sourceSection = sourceDrawer?.querySelector(section.selector);
      if (sourceSection && optimisticImageSrc) {
        const variantInput = [...sourceSection.querySelectorAll('[data-quantity-variant-id]')].find(
          (input) => String(input.dataset.quantityVariantId) === String(parsedState.id),
        );
        const serverImage = variantInput?.closest('.cart-item')?.querySelector('.cart-item__image');
        if (serverImage) {
          serverImage.src = optimisticImageSrc;
          serverImage.removeAttribute('srcset');
        }
      }
      sectionElement.innerHTML = sourceSection
        ? sourceSection.innerHTML
        : this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    });

    this.bindOverlay();
    if (itemCount === null) void refreshPradaCartIcon();

    if (shouldOpen && !optimisticState?.dismissed) {
      setTimeout(() => this.open());
    }
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
