/**
 * Prada Luxury Cart Drawer
 * High-performance, robust cart drawer with native Shopify Section Rendering API
 */

const PRADA_DRAWER_DURATION = 260;

// Synchronize header cart icon and badge
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
    } else if (badge) {
      badge.remove();
    }

    cartLink.querySelector(':scope > .cart-count-bubble')?.remove();
    cartLink.setAttribute('aria-label', safeCount > 0 ? `Cart (${safeCount})` : 'Cart');
  }

  document.querySelectorAll('[data-prada-drawer-cart-count]').forEach((elem) => {
    elem.classList.toggle('is-hidden', safeCount === 0);
    if (elem.lastChild) elem.lastChild.textContent = String(safeCount);
    elem.setAttribute('aria-label', `${safeCount} items in shopping bag`);
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
    if (typeof cart?.item_count === 'number') {
      updatePradaCartIcon(cart.item_count);
    }
  } catch (_e) {
    // Non-blocking header sync
  }
};

window.PradaCartHeader = window.PradaCartHeader || {};
window.PradaCartHeader.update = updatePradaCartIcon;
window.PradaCartHeader.refresh = refreshPradaCartIcon;

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.activeElement = null;
    this.closeTimer = null;
    this.isTransitioning = false;

    this.initEventListeners();
  }

  initEventListeners() {
    // Escape key
    this.addEventListener('keyup', (event) => {
      if (event.key === 'Escape' || event.code === 'Escape') this.close();
    });

    // Overlay click
    this.addEventListener('click', (event) => {
      if (event.target.matches('#CartDrawer-Overlay') || event.target.closest('#CartDrawer-Overlay')) {
        event.preventDefault();
        this.close();
      }
    });

    // Wire up header cart button
    this.setupHeaderTrigger();
  }

  setupHeaderTrigger() {
    const trigger = document.querySelector('#cart-icon-bubble.prada-header-btn--cart');
    if (!trigger) return;

    const isCartPage = window.location.pathname.replace(/\/+$/, '') === (window.routes?.cart_url || '/cart').replace(/\/+$/, '');
    if (isCartPage) return;

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(trigger);
    });
  }

  open(triggeredBy = null) {
    if (this.classList.contains('active') && !this.classList.contains('is-closing')) return;

    if (triggeredBy) {
      this.activeElement = triggeredBy;
      triggeredBy.setAttribute('aria-expanded', 'true');
    }

    window.clearTimeout(this.closeTimer);
    this.classList.remove('is-closing');
    this.classList.add('animate');

    // Lock scrollbar with compensation
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.classList.add('overflow-hidden');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.classList.add('active');
        this.classList.remove('animate');

        // Focus trap
        const inner = this.querySelector('.drawer__inner');
        if (inner) inner.focus();
      });
    });
  }

  close() {
    if (!this.classList.contains('active') || this.classList.contains('is-closing')) return;

    window.clearTimeout(this.closeTimer);
    this.classList.add('is-closing');

    this.closeTimer = setTimeout(() => {
      this.classList.remove('active', 'animate', 'is-closing');
      document.body.classList.remove('overflow-hidden');
      document.body.style.paddingRight = '';

      if (this.activeElement) {
        this.activeElement.setAttribute('aria-expanded', 'false');
        this.activeElement.focus();
        this.activeElement = null;
      }
    }, PRADA_DRAWER_DURATION);
  }

  renderContents(parsedState, { shouldOpen = true } = {}) {
    let sectionHtml = null;

    if (parsedState?.sections) {
      sectionHtml = parsedState.sections['cart-drawer'];
    }

    if (sectionHtml) {
      this.applySectionMarkup(sectionHtml);
    } else {
      this.refreshFromServer(shouldOpen);
      return;
    }

    if (typeof parsedState?.item_count === 'number') {
      updatePradaCartIcon(parsedState.item_count);
    }

    if (shouldOpen) {
      this.open();
    }
  }

  applySectionMarkup(sectionHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sectionHtml, 'text/html');

    const newInner = doc.querySelector('.drawer__inner');
    const currentInner = this.querySelector('.drawer__inner');

    if (newInner && currentInner) {
      currentInner.innerHTML = newInner.innerHTML;
    }

    const newRoot = doc.querySelector('cart-drawer');
    if (newRoot) {
      const isEmpty = newRoot.classList.contains('is-empty');
      this.classList.toggle('is-empty', isEmpty);

      const newCount = newRoot.dataset.cartItemCount || '0';
      this.dataset.cartItemCount = newCount;
      updatePradaCartIcon(newCount);
    }
  }

  async refreshFromServer(shouldOpen = false) {
    try {
      const cartUrl = window.routes?.cart_url || '/cart';
      const response = await fetch(`${cartUrl}?section_id=cart-drawer`, {
        cache: 'no-store',
        headers: { Accept: 'text/html' },
      });
      if (!response.ok) return;

      const html = await response.text();
      this.applySectionMarkup(html);

      if (shouldOpen) {
        this.open();
      }
    } catch (err) {
      console.error('[PradaCartDrawer] Error refreshing cart markup:', err);
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        section: 'cart-drawer',
        selector: '#CartDrawer',
      },
    ];
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}

// Cart Drawer Line Items & Quantity Handling
class CartDrawerItems extends HTMLElement {
  constructor() {
    super();
    this.debounceTimer = null;
    this.initHandlers();
  }

  connectedCallback() {
    this.initHandlers();
  }

  initHandlers() {
    // Listen for quantity stepper buttons
    this.addEventListener('click', (event) => {
      const button = event.target.closest('.prada-quantity__button');
      if (button) {
        event.preventDefault();
        const isPlus = button.matches('.prada-quantity__button--plus');
        const container = button.closest('.prada-quantity-stepper');
        const input = container?.querySelector('.prada-quantity__input');
        if (!input) return;

        const currentVal = parseInt(input.value, 10) || 0;
        const newVal = isPlus ? currentVal + 1 : Math.max(0, currentVal - 1);
        input.value = newVal;

        const line = input.dataset.index;
        const lineKey = input.dataset.lineKey;
        this.updateQuantity(line, newVal, lineKey);
        return;
      }

      // Listen for Remove button
      const removeBtn = event.target.closest('.prada-cart-drawer__remove');
      if (removeBtn) {
        event.preventDefault();
        const removeWrap = removeBtn.closest('cart-remove-button');
        const line = removeWrap?.dataset.index;
        const lineKey = removeWrap?.dataset.lineKey;
        const itemRow = removeBtn.closest('.prada-cart-item');

        if (itemRow) {
          itemRow.classList.add('is-removing');
        }

        this.updateQuantity(line, 0, lineKey);
      }
    });

    // Listen for manual number input change
    this.addEventListener('change', (event) => {
      if (event.target.matches('.prada-quantity__input')) {
        const input = event.target;
        const line = input.dataset.index;
        const lineKey = input.dataset.lineKey;
        const newVal = Math.max(0, parseInt(input.value, 10) || 0);
        this.updateQuantity(line, newVal, lineKey);
      }
    });
  }

  updateQuantity(line, quantity, lineKey) {
    clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(async () => {
      const drawer = this.closest('cart-drawer');
      const itemRow = this.querySelector(`[data-cart-line-index="${line}"]`);

      if (itemRow) {
        itemRow.style.opacity = '0.5';
        itemRow.style.pointerEvents = 'none';
      }

      try {
        const changeUrl = window.routes?.cart_change_url || '/cart/change.js';
        const body = JSON.stringify({
          line: parseInt(line, 10),
          quantity: parseInt(quantity, 10),
          sections: 'cart-drawer,cart-icon-bubble',
          sections_url: window.location.pathname,
        });

        const response = await fetch(changeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body,
        });

        const data = await response.json();

        if (response.ok && data.sections) {
          drawer?.renderContents(data, { shouldOpen: true });
        } else if (data.errors || data.description) {
          // Display error message
          const errorContainer = this.querySelector(`#CartDrawer-LineItemError-${line}`);
          if (errorContainer) {
            errorContainer.removeAttribute('hidden');
            const errorText = errorContainer.querySelector('.cart-item__error-text');
            if (errorText) errorText.textContent = data.description || data.errors;
          }
          if (itemRow) {
            itemRow.style.opacity = '1';
            itemRow.style.pointerEvents = 'auto';
          }
        }
      } catch (err) {
        console.error('[PradaCartDrawer] Failed to update cart item quantity:', err);
        if (itemRow) {
          itemRow.style.opacity = '1';
          itemRow.style.pointerEvents = 'auto';
        }
      }
    }, 150);
  }
}

if (!customElements.get('cart-drawer-items')) {
  customElements.define('cart-drawer-items', CartDrawerItems);
}
