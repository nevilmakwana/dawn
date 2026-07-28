const updatePradaCartBadge = (itemCount) => {
  const cartLink = document.querySelector('.prada-header-btn--cart#cart-icon-bubble');
  if (!cartLink) return;

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
};

const refreshPradaCartBadge = async () => {
  try {
    const cartUrl = window.routes?.cart_url || '/cart';
    const response = await fetch(`${cartUrl}.js`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return;

    const cart = await response.json();
    if (typeof cart?.item_count === 'number') updatePradaCartBadge(cart.item_count);
  } catch (_error) {
    // A badge refresh must never interrupt a successful add-to-cart action.
  }
};

window.PradaCartHeader = window.PradaCartHeader || {};
window.PradaCartHeader.update = updatePradaCartBadge;
window.PradaCartHeader.refresh = refreshPradaCartBadge;

class CartNotification extends HTMLElement {
  constructor() {
    super();

    this.notification = document.getElementById('cart-notification');
    this.header = document.querySelector('sticky-header');
    this.onBodyClick = this.handleBodyClick.bind(this);

    this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
      closeButton.addEventListener('click', this.close.bind(this))
    );
  }

  open() {
    this.notification.classList.add('animate', 'active');

    this.notification.addEventListener(
      'transitionend',
      () => {
        this.notification.focus();
        trapFocus(this.notification);
      },
      { once: true }
    );

    document.body.addEventListener('click', this.onBodyClick);

    this.dispatchCartViewEvent();
  }

  // The notification's outer element is server-rendered once at page load, so
  // its `cart` Liquid object reflects the pre-add state. The morphed children
  // (inserted from the /cart/add.js sections response in renderContents) are
  // post-add, but they don't expose the full cart shape we need for the event
  // payload. So we keep an explicit /cart.json fetch on open. Migrating to the
  // factory + filter would require re-rendering the notification element
  // itself in sections, which is out of scope for this PR.
  async dispatchCartViewEvent() {
    const { CartViewEvent } = window.StandardEvents || {};
    if (!CartViewEvent) return;

    try {
      const response = await fetch(`${routes.cart_url}.json`);
      const cart = await response.json();
      if (!cart?.currency) return;

      this.dispatchEvent(
        new CartViewEvent({
          context: 'dialog',
          cart: CartViewEvent.createCartFromAjaxResponse(cart),
        })
      );
    } catch (e) {
      // cart:view is informational; swallow fetch errors
    }
  }

  close() {
    this.notification.classList.remove('active');
    document.body.removeEventListener('click', this.onBodyClick);

    removeTrapFocus(this.activeElement);
  }

  renderContents(parsedState, { shouldOpen = true } = {}) {
    this.cartItemKey = parsedState.key;
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = document.getElementById(section.id);
      if (!sectionElement) return;

      // Keep the custom Prada cart icon intact; its badge is updated below.
      if (section.id === 'cart-icon-bubble' && sectionElement.classList.contains('prada-header-btn--cart')) return;

      sectionElement.innerHTML = this.getSectionInnerHTML(
        parsedState.sections[section.id],
        section.selector
      );
    });

    if (typeof parsedState.item_count === 'number') this.updateHeaderCartBadge(parsedState.item_count);

    // /cart/add.js returns a line item in some Dawn flows. Always reconcile
    // against the cart state so the persistent header badge has the real total.
    void this.refreshHeaderCartBadge();

    if (shouldOpen) {
      if (this.header) this.header.reveal();
      this.open();
    }
  }

  updateHeaderCartBadge(itemCount) {
    const update = window.PradaCartHeader?.update || updatePradaCartBadge;
    update(itemCount);
  }

  async refreshHeaderCartBadge() {
    await window.PradaCartHeader?.refresh?.();
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-notification-product',
        selector: `[id="cart-notification-product-${this.cartItemKey}"]`,
      },
      {
        id: 'cart-notification-button',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  handleBodyClick(evt) {
    const target = evt.target;
    if (target !== this.notification && !target.closest('cart-notification')) {
      const disclosure = target.closest('details-disclosure, header-menu');
      this.activeElement = disclosure ? disclosure.querySelector('summary') : null;
      this.close();
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-notification', CartNotification);
