const PRADA_CART_DRAWER_TRANSITION_DURATION = 260;
const PRADA_CART_ROW_TRANSITION_DURATION = 180;

const updatePradaCartIcon = (itemCount) => {
  const safeCount = Math.max(0, Number.parseInt(itemCount || '0', 10) || 0);
  const cartLink = document.querySelector('.prada-header-btn--cart#cart-icon-bubble');

  if (cartLink) {
    let badge = cartLink.querySelector(':scope > .prada-cart-badge');

    if (safeCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'prada-cart-badge';
        badge.setAttribute('aria-hidden', 'true');
        cartLink.append(badge);
      }
      badge.textContent = String(safeCount);
    } else {
      badge?.remove();
    }

    cartLink.querySelector(':scope > .cart-count-bubble')?.remove();
    cartLink.setAttribute('aria-label', safeCount > 0 ? `Cart (${safeCount})` : 'Cart');
  }

  document.querySelectorAll('[data-prada-drawer-cart-count]').forEach((count) => {
    count.classList.toggle('is-hidden', safeCount === 0);
    if (count.lastChild) count.lastChild.textContent = String(safeCount);
    count.setAttribute('aria-label', `${safeCount} items in shopping bag`);
  });
};

const refreshPradaCartIcon = async () => {
  try {
    const cartUrl = window.routes?.cart_url || '/cart';
    const response = await fetch(`${cartUrl}.js`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const cart = await response.json();
    if (typeof cart?.item_count === 'number') updatePradaCartIcon(cart.item_count);
  } catch (_error) {
    // Header synchronization must never interrupt a cart interaction.
  }
};

window.PradaCartHeader = window.PradaCartHeader || {};
window.PradaCartHeader.update = updatePradaCartIcon;
window.PradaCartHeader.refresh = refreshPradaCartIcon;

const isPradaCartPage = () => {
  const cartPath = new URL(window.routes?.cart_url || '/cart', window.location.origin).pathname.replace(/\/+$/, '') || '/';
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  return currentPath === cartPath;
};

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.revision = 0;
    this.pendingAdds = new Set();
    this.deferredCanonicalState = null;
    this.refreshTimer = null;
    this.refreshPromise = null;

    this.addEventListener('keyup', (event) => event.code === 'Escape' && this.close());
    this.addEventListener('click', (event) => this.handleDrawerClick(event), true);
    this.setHeaderCartIconAccessibility();
  }

  ownsCartState() {
    return true;
  }

  handleDrawerClick(event) {
    if (event.target.closest('#CartDrawer-Overlay')) {
      event.preventDefault();
      this.close();
      return;
    }

    const destination = event.target.closest('.prada-cart-drawer__view-cart, [data-prada-fast-checkout]');
    if (!destination || !this.contains(destination)) return;

    const url = destination.matches('.prada-cart-drawer__view-cart')
      ? destination.href
      : destination.dataset.pradaFastCheckout;
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();
    if (destination.getAttribute('aria-busy') === 'true') return;

    destination.setAttribute('aria-busy', 'true');
    destination.setAttribute('aria-disabled', 'true');
    if ('disabled' in destination) destination.disabled = true;

    const navigate = () => window.location.assign(url);
    if (window.PradaCartMutations?.pending) {
      window.PradaCartMutations.whenIdle().then(navigate);
    } else {
      navigate();
    }
  }

  setHeaderCartIconAccessibility() {
    const getCartLink = (target) => {
      if (!(target instanceof Element)) return null;
      return target.closest('#cart-icon-bubble.prada-header-btn--cart');
    };

    const openFromHeader = (event) => {
      const cartLink = getCartLink(event.target);
      if (!cartLink) return;
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;

      if (isPradaCartPage() || cartLink.dataset.pradaCartDisabled === 'true') {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      this.open(cartLink);
    };

    document.addEventListener('click', openFromHeader);
    document.addEventListener('keydown', openFromHeader);

    const cartLink = document.querySelector('#cart-icon-bubble.prada-header-btn--cart');
    if (!cartLink) return;

    if (isPradaCartPage()) {
      cartLink.setAttribute('aria-disabled', 'true');
      cartLink.dataset.pradaCartDisabled = 'true';
      cartLink.setAttribute('tabindex', '-1');
      return;
    }

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
  }

  open(triggeredBy) {
    if (this.classList.contains('active') && !this.classList.contains('is-closing')) return;
    if (!window.PradaCartMutations?.pending) this.flushDeferredCanonicalSection();

    if (triggeredBy) {
      this.setActiveElement(triggeredBy);
      triggeredBy.setAttribute('aria-expanded', 'true');
    }

    window.clearTimeout(this.closeTimer);
    window.clearTimeout(this.openFocusTimer);
    if (this.openAnimationFrame) window.cancelAnimationFrame(this.openAnimationFrame);

    this.classList.remove('is-closing');
    this.classList.add('animate', 'is-opening');
    this.classList.remove('active');

    this.openAnimationFrame = window.requestAnimationFrame(() => {
      this.openAnimationFrame = window.requestAnimationFrame(() => {
        this.openAnimationFrame = null;
        if (!this.classList.contains('is-closing')) this.classList.add('active');
      });
    });

    this.openFocusTimer = window.setTimeout(() => {
      this.openFocusTimer = null;
      this.classList.remove('is-opening');
      if (!this.classList.contains('active')) return;

      const focusContainer = this.classList.contains('is-empty')
        ? this.querySelector('.drawer__inner-empty')
        : this.querySelector('#CartDrawer');
      const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
      if (focusContainer && focusElement) trapFocus(focusContainer, focusElement);
    }, PRADA_CART_DRAWER_TRANSITION_DURATION);

    if (window.pradaDrawerScrollLock) {
      window.pradaDrawerScrollLock.lock();
    } else {
      document.body.classList.add('overflow-hidden');
    }

    this.querySelector('cart-drawer-items')?.dispatchViewEvent?.();
  }

  close() {
    if (this.classList.contains('is-closing')) return;

    if (this.openAnimationFrame) {
      window.cancelAnimationFrame(this.openAnimationFrame);
      this.openAnimationFrame = null;
    }
    window.clearTimeout(this.openFocusTimer);
    window.clearTimeout(this.closeTimer);

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

      if (!window.PradaCartMutations?.pending) this.flushDeferredCanonicalSection();
    };

    if (!this.classList.contains('active') && !this.classList.contains('animate')) {
      finishClose();
      return;
    }

    this.classList.remove('is-opening', 'active');
    this.classList.add('is-closing');
    this.closeTimer = window.setTimeout(finishClose, PRADA_CART_DRAWER_TRANSITION_DURATION);
  }

  beginOptimisticAdd(item, triggeredBy) {
    if (!item) return null;

    const quantity = Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1);
    const previousCount = this.getDisplayedItemCount();
    const previousTotal = this.getDisplayedTotal();
    const row = this.findRowByVariant(item.variantId);
    const created = !row;
    const targetRow = row || this.createCartRow(item, quantity);
    const previousQuantity = created ? 0 : this.getRowQuantity(targetRow);
    const lineReference = targetRow._pradaLineReference || this.createLineReference(targetRow, item.variantId);
    targetRow._pradaLineReference = lineReference;
    targetRow.dataset.cartVariantId = String(item.variantId);
    targetRow.dataset.cartQuantity = String(previousQuantity + quantity);
    if (item.priceCents) targetRow.dataset.cartUnitPrice = String(item.priceCents);

    if (created) {
      this.ensureCartRowsContainer().prepend(targetRow);
    } else {
      this.updateRowQuantity(targetRow, previousQuantity + quantity);
      const body = targetRow.parentElement;
      if (body?.firstElementChild !== targetRow) body?.prepend(targetRow);
      const image = targetRow.querySelector('.cart-item__image');
      if (image && item.image) {
        image.src = item.image;
        image.removeAttribute('srcset');
      }
    }

    const state = {
      id: `${Date.now()}-${Math.random()}`,
      revision: ++this.revision,
      item,
      row: targetRow,
      created,
      quantity,
      previousQuantity,
      previousCount,
      previousTotal,
      lineReference,
      settled: false,
    };

    this.pendingAdds.add(state);
    this.showPopulatedState(previousCount + quantity, previousTotal + (item.priceCents || 0) * quantity);
    this.updateMultipleLayout();
    this.setActiveElement(triggeredBy);
    this.open(triggeredBy);
    return state;
  }

  confirmOptimisticAdd(state, response) {
    if (!state || state.settled) return;
    state.settled = true;
    this.pendingAdds.delete(state);

    const lineKey = response?.key || response?.id;
    if (lineKey) {
      state.lineReference.key = String(lineKey);
      state.lineReference.resolveKey?.(String(lineKey));
      if (state.row?.isConnected) {
        state.row.dataset.cartLineKey = String(lineKey);
        state.row.querySelectorAll('cart-remove-button').forEach((button) => {
          button.dataset.lineKey = String(lineKey);
        });
      }
    }

    if (Number.isFinite(response?.quantity) && state.row?.isConnected) {
      this.updateRowQuantity(state.row, response.quantity);
    }

    this.scheduleRefreshAfterOptimisticAdd(state);
  }

  cancelOptimisticAdd(state) {
    if (!state || state.settled) return;
    state.settled = true;
    state.lineReference.failed = true;
    state.lineReference.rejectKey?.(new Error('Add to cart failed'));
    this.pendingAdds.delete(state);

    if (state.row?.isConnected && state.row.dataset.cartRemovePending !== 'true') {
      if (state.created) {
        state.row.remove();
      } else {
        this.updateRowQuantity(state.row, state.previousQuantity);
      }
      this.setDisplayedTotals(state.previousCount, state.previousTotal);
      if (state.previousCount === 0) this.showEmptyState({ animate: false });
      this.updateMultipleLayout();
    }
  }

  scheduleRefreshAfterOptimisticAdd(_state, { after } = {}) {
    Promise.resolve(after).catch(() => undefined).finally(() => this.requestCanonicalRefresh());
  }

  removeItem(removeButton, event) {
    const row = removeButton?.closest('.cart-item');
    if (!row || row.dataset.cartRemovePending === 'true') return;

    event?.preventDefault?.();
    event?.stopPropagation?.();

    const lineReference = row._pradaLineReference || this.createLineReference(row);
    row._pradaLineReference = lineReference;
    const quantity = this.getRowQuantity(row);
    const unitPrice = Number.parseInt(row.dataset.cartUnitPrice || '0', 10) || 0;
    const previousCount = this.getDisplayedItemCount();
    const previousTotal = this.getDisplayedTotal();
    const actionRevision = ++this.revision;
    const parent = row.parentElement;
    const nextSibling = row.nextElementSibling;

    row.dataset.cartRemovePending = 'true';
    row.querySelectorAll('button, a').forEach((control) => {
      control.setAttribute('aria-disabled', 'true');
      if ('disabled' in control) control.disabled = true;
    });

    const nextCount = Math.max(0, previousCount - quantity);
    const nextTotal = Math.max(0, previousTotal - unitPrice * quantity);
    this.setDisplayedTotals(nextCount, nextTotal);
    this.animateRowRemoval(row, nextCount === 0);
    if (event) CartPerformance.measureFromEvent('remove:optimistic-ui', event);

    const removeRequest = async () => {
      let lineKey = lineReference.key;
      if (!lineKey && lineReference.keyPromise) lineKey = await lineReference.keyPromise;
      if (!lineKey) throw new Error('Cart line is not ready');

      const response = await fetch(`${routes.cart_change_url}`, {
        ...fetchConfig(),
        body: JSON.stringify({ id: lineKey, quantity: 0 }),
      });
      const cart = await response.json();
      if (!response.ok || cart?.errors) throw new Error(cart?.errors || window.cartStrings?.error || 'Cart update failed');
      return cart;
    };

    const promise = window.PradaCartMutations?.enqueue
      ? window.PradaCartMutations.enqueue(removeRequest)
      : removeRequest();

    promise
      .then((cart) => {
        if (actionRevision === this.revision) {
          this.setDisplayedTotals(cart.item_count, cart.total_price);
          if (cart.item_count === 0 && !this.classList.contains('is-empty')) {
            this.showEmptyState({ animate: false });
          }
        }
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-drawer', cartData: cart });
        this.requestCanonicalRefresh();
      })
      .catch((error) => {
        if (!lineReference.failed) {
          this.restoreRemovedRow({ row, parent, nextSibling, previousCount, previousTotal });
        }
        this.showCartError(error?.message || window.cartStrings?.error || 'Cart update failed');
        this.requestCanonicalRefresh();
      });
  }

  animateRowRemoval(row, isLastItem) {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 0 : PRADA_CART_ROW_TRANSITION_DURATION;
    const isHorizontal = Boolean(
      window.matchMedia('(max-width: 989px)').matches && row.closest('.prada-cart-drawer__items--multiple'),
    );

    if (isHorizontal) {
      row.classList.add('is-horizontal-removal');
      row.style.width = `${row.offsetWidth}px`;
      row.style.maxWidth = `${row.offsetWidth}px`;
      row.style.flexBasis = `${row.offsetWidth}px`;
    } else {
      row.style.maxHeight = `${row.offsetHeight}px`;
    }
    row.style.overflow = 'hidden';
    row.getBoundingClientRect();

    window.requestAnimationFrame(() => row.classList.add('is-removing', 'is-collapsing'));
    if (isLastItem) this.showEmptyState({ animate: true });

    window.setTimeout(() => {
      row.remove();
      this.updateMultipleLayout();
    }, duration);
  }

  restoreRemovedRow({ row, parent, nextSibling, previousCount, previousTotal }) {
    if (!row.isConnected && parent?.isConnected) parent.insertBefore(row, nextSibling?.isConnected ? nextSibling : null);
    delete row.dataset.cartRemovePending;
    row.classList.remove('is-removing', 'is-collapsing', 'is-horizontal-removal');
    row.style.maxHeight = '';
    row.style.maxWidth = '';
    row.style.width = '';
    row.style.flexBasis = '';
    row.style.overflow = '';
    row.querySelectorAll('button, a').forEach((control) => {
      control.removeAttribute('aria-disabled');
      if ('disabled' in control) control.disabled = false;
    });
    this.showPopulatedState(previousCount, previousTotal);
    this.updateMultipleLayout();
  }

  createLineReference(row, fallbackVariantId) {
    const existingKey = row?.dataset.cartLineKey || row?.querySelector('[data-quantity-line-key]')?.dataset.quantityLineKey;
    let resolveKey;
    let rejectKey;
    const keyPromise = existingKey
      ? Promise.resolve(existingKey)
      : new Promise((resolve, reject) => {
          resolveKey = resolve;
          rejectKey = reject;
        });
    keyPromise.catch(() => undefined);

    return {
      key: existingKey || null,
      variantId: row?.dataset.cartVariantId || fallbackVariantId || null,
      keyPromise,
      resolveKey,
      rejectKey,
      failed: false,
    };
  }

  findRowByVariant(variantId) {
    return [...this.querySelectorAll('#CartDrawer-CartItems .cart-item:not([data-cart-remove-pending="true"])')].find(
      (row) => String(row.dataset.cartVariantId || row.querySelector('[data-quantity-variant-id]')?.dataset.quantityVariantId || '') === String(variantId),
    );
  }

  getRowQuantity(row) {
    const explicit = Number.parseInt(row?.dataset.cartQuantity || '', 10);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const input = Number.parseInt(row?.querySelector('[data-quantity-variant-id]')?.value || '', 10);
    if (Number.isFinite(input) && input > 0) return input;
    const label = row?.querySelector('.prada-cart-drawer__quantity')?.textContent || '';
    return Number.parseInt(label.match(/\d+/)?.[0] || '1', 10) || 1;
  }

  updateRowQuantity(row, quantity) {
    row.dataset.cartQuantity = String(quantity);
    const label = row.querySelector('.prada-cart-drawer__quantity');
    if (label) label.textContent = `Qty: ${quantity}`;
    row.querySelectorAll('.quantity__input').forEach((input) => {
      input.value = String(quantity);
      input.setAttribute('value', String(quantity));
    });
  }

  ensureCartRowsContainer() {
    const contents = this.querySelector('#CartDrawer-CartItems');
    let body = contents?.querySelector('.prada-cart-drawer__items tbody');
    if (body) return body;

    const wrapper = document.createElement('div');
    wrapper.className = 'drawer__cart-items-wrapper';
    const table = document.createElement('table');
    table.className = 'cart-items prada-cart-drawer__items';
    table.setAttribute('role', 'table');
    body = document.createElement('tbody');
    body.setAttribute('role', 'rowgroup');
    table.append(body);
    wrapper.append(table);
    contents?.prepend(wrapper);
    return body;
  }

  createCartRow(item, quantity) {
    const row = document.createElement('tr');
    row.className = 'cart-item prada-cart-drawer__optimistic-new-item';
    row.dataset.cartVariantId = String(item.variantId);
    row.dataset.cartQuantity = String(quantity);
    row.dataset.cartUnitPrice = String(item.priceCents || 0);
    row.setAttribute('role', 'row');

    const media = document.createElement('td');
    media.className = 'cart-item__media';
    media.setAttribute('role', 'cell');
    if (item.image) {
      const link = document.createElement('a');
      link.className = 'cart-item__link';
      link.href = item.url || '#';
      link.tabIndex = -1;
      link.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.className = 'cart-item__image';
      image.src = item.image;
      image.alt = item.imageAlt || item.title;
      image.width = 150;
      image.height = 188;
      image.decoding = 'async';
      link.append(image);
      media.append(link);
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

    const info = document.createElement('div');
    info.className = 'prada-cart-drawer__item-info';
    item.options?.forEach((option) => {
      const optionRow = document.createElement('p');
      optionRow.className = 'prada-cart-drawer__option';
      optionRow.textContent = `${option.name}: ${option.value}`;
      info.append(optionRow);
    });
    const quantityRow = document.createElement('p');
    quantityRow.className = 'prada-cart-drawer__quantity';
    quantityRow.textContent = `Qty: ${quantity}`;
    info.append(quantityRow);
    if (item.price) {
      const price = document.createElement('p');
      price.className = 'prada-cart-drawer__price money';
      price.textContent = item.price;
      info.append(price);
    }
    const removeWrap = document.createElement('cart-remove-button');
    removeWrap.className = 'prada-cart-drawer__remove-wrap';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'prada-cart-drawer__remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${item.title}`);
    removeWrap.append(remove);
    info.append(removeWrap);
    details.append(info);
    row.append(media, details);
    return row;
  }

  getDisplayedItemCount() {
    return Math.max(0, Number.parseInt(this.dataset.cartItemCount || '0', 10) || 0);
  }

  getDisplayedTotal() {
    return Math.max(0, Number.parseInt(this.dataset.cartTotalPrice || '0', 10) || 0);
  }

  setDisplayedTotals(itemCount, totalPrice) {
    const count = Math.max(0, Number.parseInt(itemCount || '0', 10) || 0);
    const total = Math.max(0, Number.parseInt(totalPrice || '0', 10) || 0);
    this.dataset.cartItemCount = String(count);
    this.dataset.cartTotalPrice = String(total);
    updatePradaCartIcon(count);

    const desktopHeading = this.querySelector('.drawer__inner > .drawer__header .prada-cart-drawer__heading-desktop');
    const mobileHeading = this.querySelector('.drawer__inner > .drawer__header .prada-cart-drawer__heading-mobile');
    if (desktopHeading) desktopHeading.textContent = `Your selection (${count})`;
    if (mobileHeading) mobileHeading.textContent = `Added to shopping bag (${count})`;

    const subtotal = this.querySelector('.drawer__inner > .drawer__footer .totals__total-value');
    if (subtotal) subtotal.textContent = this.formatMoney(total, subtotal.textContent);
  }

  showPopulatedState(itemCount, totalPrice) {
    window.clearTimeout(this.emptyTimer);
    this.classList.remove(
      'is-empty',
      'is-empty-stable',
      'is-empty-transitioning',
      'is-empty-revealed',
      'is-empty-entering',
      'is-empty-visible',
      'is-empty-leaving',
    );
    this.querySelector('.drawer__inner-empty')?.setAttribute('hidden', '');
    this.querySelector('cart-drawer-items')?.classList.remove('is-empty');
    const checkout = this.querySelector('#CartDrawer-Checkout');
    if (checkout) checkout.disabled = false;
    this.setDisplayedTotals(itemCount, totalPrice);
  }

  showEmptyState({ animate = true } = {}) {
    window.clearTimeout(this.emptyTimer);
    const empty = this.querySelector('.drawer__inner-empty');
    empty?.removeAttribute('hidden');
    this.querySelector('cart-drawer-items')?.classList.add('is-empty');
    const checkout = this.querySelector('#CartDrawer-Checkout');
    if (checkout) checkout.disabled = true;
    this.classList.remove('prada-cart-drawer--multiple', 'is-empty-stable', 'is-empty-revealed');
    this.classList.add('is-empty');

    if (!animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.classList.remove('is-empty-transitioning', 'is-empty-revealed');
      this.classList.add('is-empty-stable');
      return;
    }

    this.classList.add('is-empty-transitioning');
    window.requestAnimationFrame(() => {
      if (this.classList.contains('is-empty')) this.classList.add('is-empty-revealed');
    });
    this.emptyTimer = window.setTimeout(() => {
      this.classList.remove('is-empty-transitioning', 'is-empty-revealed');
      this.classList.add('is-empty-stable');
    }, 320);
  }

  updateMultipleLayout() {
    const visibleRows = [...this.querySelectorAll('#CartDrawer-CartItems .cart-item')].filter(
      (row) => row.dataset.cartRemovePending !== 'true',
    );
    const multiple = visibleRows.length > 1;
    this.classList.toggle('prada-cart-drawer--multiple', multiple);
    this.querySelector('.prada-cart-drawer__items')?.classList.toggle('prada-cart-drawer__items--multiple', multiple);
  }

  formatMoney(cents, referenceText = '') {
    const locale = document.documentElement.lang || 'en-IN';
    const currency = window.Shopify?.currency?.active || 'INR';
    const number = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
    const prefix = referenceText.trim().match(/^[^\d-]+/)?.[0]?.trim();
    return prefix ? `${prefix} ${number}` : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
  }

  showCartError(message) {
    const errors = this.querySelector('#CartDrawer-CartErrors');
    if (!errors) return;
    errors.textContent = message;
    window.setTimeout(() => {
      if (errors.textContent === message) errors.textContent = '';
    }, 5000);
  }

  requestCanonicalRefresh() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refreshCanonicalWhenIdle(), 60);
  }

  refreshCanonicalWhenIdle() {
    if (window.PradaCartMutations?.pending) {
      window.PradaCartMutations.whenIdle().then(() => this.requestCanonicalRefresh());
      return;
    }
    if (this.refreshPromise) return;

    const requestedRevision = this.revision;
    const cartUrl = new URL(window.routes?.cart_url || '/cart', window.location.origin);
    cartUrl.searchParams.set('section_id', 'cart-drawer');
    const refreshPromise = fetch(cartUrl.toString(), {
      cache: 'no-store',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Cart drawer refresh failed: ${response.status}`);
        return response.text();
      })
      .then((html) => {
        if (requestedRevision !== this.revision || window.PradaCartMutations?.pending) {
          this.requestCanonicalRefresh();
          return;
        }
        this.deferredCanonicalState = { sections: { 'cart-drawer': html } };
        if (!this.isVisible()) this.flushDeferredCanonicalSection();
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (this.refreshPromise === refreshPromise) this.refreshPromise = null;
      });
    this.refreshPromise = refreshPromise;
  }

  isVisible() {
    return this.classList.contains('active') || this.classList.contains('animate') || this.classList.contains('is-closing');
  }

  flushDeferredCanonicalSection() {
    if (!this.deferredCanonicalState || window.PradaCartMutations?.pending) return false;
    const state = this.deferredCanonicalState;
    this.deferredCanonicalState = null;
    this.applyCanonicalSection(state.sections['cart-drawer']);
    return true;
  }

  applyCanonicalSection(html) {
    const sourceDrawer = this.getSectionDOM(html, 'cart-drawer');
    const sourceContents = sourceDrawer?.querySelector('#CartDrawer');
    const targetContents = this.querySelector('#CartDrawer');
    if (!sourceDrawer || !sourceContents || !targetContents) return false;

    targetContents.innerHTML = sourceContents.innerHTML;
    this.dataset.cartItemCount = sourceDrawer.dataset.cartItemCount || '0';
    this.dataset.cartTotalPrice = sourceDrawer.dataset.cartTotalPrice || '0';
    this.classList.remove(
      'is-empty-transitioning',
      'is-empty-revealed',
      'is-empty-entering',
      'is-empty-visible',
      'is-empty-leaving',
    );
    this.classList.toggle('is-empty', sourceDrawer.classList.contains('is-empty'));
    this.classList.toggle('is-empty-stable', sourceDrawer.classList.contains('is-empty'));
    this.classList.toggle('prada-cart-drawer--multiple', sourceDrawer.classList.contains('prada-cart-drawer--multiple'));
    updatePradaCartIcon(this.dataset.cartItemCount);
    return true;
  }

  renderContents(parsedState, { shouldOpen = true } = {}) {
    const sectionHtml = parsedState?.sections?.['cart-drawer'];
    if (sectionHtml) {
      if (this.isVisible() || window.PradaCartMutations?.pending) {
        this.deferredCanonicalState = { sections: { 'cart-drawer': sectionHtml } };
      } else {
        this.applyCanonicalSection(sectionHtml);
      }
    } else {
      this.requestCanonicalRefresh();
    }

    if (typeof parsedState?.item_count === 'number') updatePradaCartIcon(parsedState.item_count);
    if (shouldOpen) this.open();
  }

  getSectionDOM(html, selector = '.shopify-section') {
    if (!html) return null;
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return this.getSectionDOM(html, selector)?.innerHTML || '';
  }

  getSectionsToRender() {
    return [{ id: 'cart-drawer', selector: '#CartDrawer' }];
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [{ id: 'CartDrawer', section: 'cart-drawer', selector: '.drawer__inner' }];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    if (quantity === 0 && event?.currentTarget instanceof CartRemoveButton) {
      this.closest('cart-drawer')?.removeItem(event.currentTarget, event);
      return;
    }
    super.updateQuantity(line, quantity, event, name, variantId);
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
