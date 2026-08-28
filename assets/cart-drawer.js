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

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.bindOverlay();
    this.setHeaderCartIconAccessibility();
  }

  bindOverlay() {
    const overlay = this.querySelector('#CartDrawer-Overlay');
    if (!overlay || overlay.dataset.cartDrawerBound) return;

    overlay.dataset.cartDrawerBound = 'true';
    overlay.addEventListener('click', this.close.bind(this));
  }

  async refreshForHeader() {
    const cartUrl = window.routes?.cart_url || '/cart';
    const response = await fetch(`${cartUrl}?section_id=cart-drawer`);

    if (!response.ok) throw new Error('Unable to refresh cart drawer');

    const responseDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
    const sourceDrawer = responseDocument.querySelector('cart-drawer');
    const sourceContents = sourceDrawer?.querySelector('#CartDrawer');
    const targetContents = this.querySelector('#CartDrawer');

    if (!sourceDrawer || !sourceContents || !targetContents) return;

    targetContents.innerHTML = sourceContents.innerHTML;
    this.classList.toggle('is-empty', sourceDrawer.classList.contains('is-empty'));
    this.classList.toggle(
      'prada-cart-drawer--multiple',
      sourceDrawer.classList.contains('prada-cart-drawer--multiple'),
    );
    const itemCount = Number.parseInt(sourceDrawer.dataset.cartItemCount || '', 10);
    if (Number.isFinite(itemCount)) {
      this.dataset.cartItemCount = String(itemCount);
      updatePradaCartIcon(itemCount);
    }
    this.bindOverlay();
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

      if (this.classList.contains('active') || this.headerCartOpening) return;

      this.headerCartOpening = true;
      this.refreshForHeader()
        .catch(() => {})
        .finally(() => {
          this.headerCartOpening = false;
          this.open(cartLink);
        });
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
    if (this.classList.contains('active')) return;
    if (triggeredBy) this.setActiveElement(triggeredBy);
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

    const drawerInner = this.querySelector('.drawer__inner');
    const focusOnOpen = () => {
      const containerToTrapFocusOn = this.classList.contains('is-empty')
        ? this.querySelector('.drawer__inner-empty')
        : document.getElementById('CartDrawer');
      const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
      trapFocus(containerToTrapFocusOn, focusElement);
    };

    this.classList.remove('is-closing');
    this.classList.add('animate', 'is-opening');
    // Commit the off-canvas frame before activating the drawer. This keeps
    // async header refreshes from collapsing both states into one paint.
    drawerInner?.getBoundingClientRect();
    this.openAnimationFrame = requestAnimationFrame(() => {
      this.classList.add('active');
      this.openAnimationFrame = null;
    });

    if (!drawerInner || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.openFocusTimer = setTimeout(() => {
        this.openFocusTimer = null;
        this.classList.remove('is-opening');
        if (this.classList.contains('active')) focusOnOpen();
      });
    } else {
      const finishOpen = () => {
        if (!this.classList.contains('is-opening')) return;

        clearTimeout(this.openFocusTimer);
        this.openFocusTimer = null;
        drawerInner.removeEventListener('transitionend', handleOpenTransitionEnd);
        drawerInner.removeEventListener('animationend', handleOpenAnimationEnd);
        this.classList.remove('is-opening');
        if (this.classList.contains('active')) focusOnOpen();
      };
      const handleOpenTransitionEnd = (event) => {
        if (event.target !== drawerInner || event.propertyName !== 'transform') return;
        finishOpen();
      };
      const handleOpenAnimationEnd = (event) => {
        if (event.target !== drawerInner || event.animationName !== 'prada-cart-drawer-slide-in') return;
        finishOpen();
      };

      this.openFocusTimer = setTimeout(() => {
        this.openFocusTimer = null;
        drawerInner.removeEventListener('transitionend', handleOpenTransitionEnd);
        drawerInner.removeEventListener('animationend', handleOpenAnimationEnd);
        this.classList.remove('is-opening');
        if (this.classList.contains('active')) focusOnOpen();
      }, 700);
      drawerInner.addEventListener('transitionend', handleOpenTransitionEnd);
      drawerInner.addEventListener('animationend', handleOpenAnimationEnd);
    }

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

    const drawerInner = this.querySelector('.drawer__inner');
    const finishClose = () => {
      this.classList.remove('is-closing', 'is-opening');
      if (!this.classList.contains('active')) this.classList.remove('animate');
    };

    if (!this.classList.contains('active')) {
      finishClose();
      return;
    }

    this.classList.remove('is-opening');
    this.classList.add('is-closing');
    // Commit the fully open frame before moving the panel off canvas.
    drawerInner?.getBoundingClientRect();
    if (!drawerInner || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.classList.remove('active');
      setTimeout(finishClose);
    } else {
      this.closeAnimationFrame = requestAnimationFrame(() => {
        this.classList.remove('active');
        this.closeAnimationFrame = null;
      });

      const handleCloseTransitionEnd = (event) => {
        if (event.target !== drawerInner || event.propertyName !== 'transform') return;

        clearTimeout(this.closeTimer);
        this.closeTimer = null;
        drawerInner.removeEventListener('transitionend', handleCloseTransitionEnd);
        drawerInner.removeEventListener('animationend', handleCloseAnimationEnd);
        finishClose();
      };
      const handleCloseAnimationEnd = (event) => {
        if (event.target !== drawerInner || event.animationName !== 'prada-cart-drawer-slide-out') return;

        clearTimeout(this.closeTimer);
        this.closeTimer = null;
        drawerInner.removeEventListener('transitionend', handleCloseTransitionEnd);
        drawerInner.removeEventListener('animationend', handleCloseAnimationEnd);
        finishClose();
      };

      this.closeTimer = setTimeout(() => {
        this.closeTimer = null;
        drawerInner.removeEventListener('transitionend', handleCloseTransitionEnd);
        drawerInner.removeEventListener('animationend', handleCloseAnimationEnd);
        finishClose();
      }, 560);
      drawerInner.addEventListener('transitionend', handleCloseTransitionEnd);
      drawerInner.addEventListener('animationend', handleCloseAnimationEnd);
    }

    removeTrapFocus(this.activeElement);
    if (window.pradaDrawerScrollLock) {
      window.pradaDrawerScrollLock.unlock();
    } else {
      document.body.classList.remove('overflow-hidden');
    }
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
