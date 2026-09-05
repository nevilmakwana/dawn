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
    if (this.optimisticState) this.cancelOptimisticAdd(this.optimisticState, { keepDrawer: true });

    const previousCount = Number.parseInt(this.dataset.cartItemCount || '0', 10) || 0;
    const quantity = Number.parseInt(item.quantity || '1', 10) || 1;
    const optimisticCount = previousCount + quantity;
    const state = {
      id: `${Date.now()}-${Math.random()}`,
      previousCount,
      wasEmpty: this.classList.contains('is-empty'),
      wasMultiple: this.classList.contains('prada-cart-drawer--multiple'),
      wasOpen: this.classList.contains('active') || this.classList.contains('is-opening'),
    };

    this.optimisticState = state;
    this.querySelector('.prada-cart-drawer__optimistic')?.remove();
    this.dataset.cartItemCount = String(optimisticCount);
    this.classList.remove('is-empty');
    this.classList.add('is-optimistic');
    updatePradaCartIcon(optimisticCount);

    const panel = document.createElement('div');
    panel.className = 'prada-cart-drawer__optimistic';
    panel.dataset.optimisticId = state.id;

    const header = document.createElement('div');
    header.className = 'prada-cart-drawer__optimistic-header';
    const heading = document.createElement('p');
    heading.className = 'prada-cart-drawer__optimistic-heading';
    heading.textContent = `Adding to shopping bag (${optimisticCount})`;
    const closeButton = document.createElement('button');
    closeButton.className = 'prada-cart-drawer__optimistic-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close shopping bag');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => this.close());
    header.append(heading, closeButton);

    const product = document.createElement('div');
    product.className = 'prada-cart-drawer__optimistic-product';
    if (item.image) {
      const imageLink = document.createElement('a');
      imageLink.className = 'prada-cart-drawer__optimistic-image-link';
      imageLink.href = item.url || '#';
      imageLink.tabIndex = -1;
      imageLink.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.className = 'prada-cart-drawer__optimistic-image';
      image.src = item.image;
      image.alt = item.imageAlt || item.title;
      image.width = 124;
      image.height = 156;
      image.decoding = 'async';
      imageLink.append(image);
      product.append(imageLink);
    }

    const details = document.createElement('div');
    details.className = 'prada-cart-drawer__optimistic-details';
    const title = document.createElement('a');
    title.className = 'prada-cart-drawer__optimistic-title';
    title.href = item.url || '#';
    title.textContent = item.title;
    details.append(title);

    item.options?.forEach((option) => {
      const row = document.createElement('p');
      row.className = 'prada-cart-drawer__optimistic-meta';
      row.textContent = `${option.name}: ${option.value}`;
      details.append(row);
    });

    const quantityRow = document.createElement('p');
    quantityRow.className = 'prada-cart-drawer__optimistic-meta prada-cart-drawer__optimistic-quantity';
    quantityRow.textContent = `Qty: ${quantity}`;
    details.append(quantityRow);
    if (item.price) {
      const price = document.createElement('p');
      price.className = 'prada-cart-drawer__optimistic-price money';
      price.textContent = item.price;
      details.append(price);
    }
    product.append(details);

    const status = document.createElement('p');
    status.className = 'prada-cart-drawer__optimistic-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const statusDot = document.createElement('span');
    statusDot.setAttribute('aria-hidden', 'true');
    const statusText = document.createElement('span');
    statusText.textContent = 'Confirming your selection…';
    status.append(statusDot, statusText);

    panel.append(header, product, status);
    this.querySelector('.drawer__inner')?.append(panel);
    this.setActiveElement(triggeredBy);
    this.open();
    return state;
  }

  completeOptimisticAdd() {
    this.querySelector('.prada-cart-drawer__optimistic')?.remove();
    this.classList.remove('is-optimistic');
    this.optimisticState = null;
  }

  cancelOptimisticAdd(state, { keepDrawer = false } = {}) {
    if (!state || this.optimisticState?.id !== state.id) return;

    this.querySelector('.prada-cart-drawer__optimistic')?.remove();
    this.classList.remove('is-optimistic');
    this.classList.toggle('is-empty', state.wasEmpty);
    this.classList.toggle('prada-cart-drawer--multiple', state.wasMultiple);
    this.dataset.cartItemCount = String(state.previousCount);
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
    this.completeOptimisticAdd();
    const sourceDrawer = parsedState.sections?.['cart-drawer']
      ? this.getSectionDOM(parsedState.sections['cart-drawer'], 'cart-drawer')
      : null;
    const sectionItemCount = Number.parseInt(sourceDrawer?.dataset.cartItemCount || '', 10);
    const itemCount =
      typeof parsedState.item_count === 'number'
        ? parsedState.item_count
        : Number.isFinite(sectionItemCount)
          ? sectionItemCount
          : null;

    if (itemCount !== null) {
      this.dataset.cartItemCount = String(itemCount);
      this.classList.toggle('is-empty', itemCount === 0);
      updatePradaCartIcon(itemCount);
    }
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
      sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    });

    this.bindOverlay();
    if (itemCount === null) void refreshPradaCartIcon();

    if (shouldOpen) {
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
