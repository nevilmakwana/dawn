class CartRemoveButton extends HTMLElement {
  restoreRemovingState() {
    const cartItem = this.closest('.cart-item');
    if (!cartItem) return;

    const optimisticEmptyState = this.optimisticEmptyState;
    if (optimisticEmptyState) {
      if (optimisticEmptyState.cartDrawer?.emptyMorphFrame) {
        window.cancelAnimationFrame(optimisticEmptyState.cartDrawer.emptyMorphFrame);
        optimisticEmptyState.cartDrawer.emptyMorphFrame = null;
      }
      if (optimisticEmptyState.cartDrawer?.emptyMorphTimer) {
        window.clearTimeout(optimisticEmptyState.cartDrawer.emptyMorphTimer);
        optimisticEmptyState.cartDrawer.emptyMorphTimer = null;
      }
      if (optimisticEmptyState.cartDrawer?.emptyMorphRevealTimer) {
        window.clearTimeout(optimisticEmptyState.cartDrawer.emptyMorphRevealTimer);
        optimisticEmptyState.cartDrawer.emptyMorphRevealTimer = null;
      }
      if (optimisticEmptyState.cartDrawer) optimisticEmptyState.cartDrawer.emptyMorphCleanup = null;
      optimisticEmptyState.cartItems?.classList.remove('is-empty');
      optimisticEmptyState.cartFooter?.classList.remove('is-empty');
      optimisticEmptyState.cartDrawer?.classList.remove(
        'is-empty',
        'is-empty-stable',
        'is-empty-transitioning',
        'is-empty-revealed'
      );
      if (optimisticEmptyState.cartDrawer) {
        optimisticEmptyState.cartDrawer.dataset.cartItemCount = String(optimisticEmptyState.previousCount);
      }
      optimisticEmptyState.cartItems?.removeAttribute('data-prada-projected-empty');
      if (optimisticEmptyState.emptyState?.element?.isConnected) {
        if (optimisticEmptyState.emptyState.created) {
          optimisticEmptyState.emptyState.element.remove();
        } else if (optimisticEmptyState.emptyState.wasHidden) {
          optimisticEmptyState.emptyState.element.setAttribute('hidden', '');
        }
      }
      document.querySelectorAll('[data-prada-shopping-bag-count]').forEach((count) => {
        count.textContent = String(optimisticEmptyState.previousCount);
      });
      window.PradaCartHeader?.update?.(optimisticEmptyState.previousCount);
      this.optimisticEmptyState = null;
    }

    cartItem.closest('cart-drawer')?.classList.remove('is-empty-leaving');
    cartItem.classList.remove('is-removing', 'is-collapsing', 'is-horizontal-removal');
    cartItem.style.maxHeight = '';
    cartItem.style.maxWidth = '';
    cartItem.style.width = '';
    cartItem.style.flexBasis = '';
    cartItem.style.overflow = '';
    delete cartItem.dataset.pradaRemoveStartedAt;
    delete cartItem.dataset.pradaRemovePending;
    this.removeAttribute('aria-disabled');
    this.querySelectorAll('a, button').forEach((control) => {
      control.removeAttribute('aria-disabled');
      if (control.tagName === 'BUTTON') {
        control.disabled = false;
      } else {
        control.removeAttribute('tabindex');
      }
    });
  }

  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      const cartItem = this.closest('.cart-item');
      const isShoppingBagItem = cartItems?.matches('cart-items') && cartItem?.closest('.prada-shopping-bag-page');
      const isCartDrawerItem = cartItems?.matches('cart-drawer-items') && cartItem?.closest('cart-drawer');

      if (!cartItems) return;

      if (!isShoppingBagItem && !isCartDrawerItem) {
        cartItems.updateQuantity(this.dataset.index, 0, event);
        return;
      }

      if (cartItem.classList.contains('is-removing') || cartItem.dataset.pradaRemovePending === 'true') return;
      const isLastLine = cartItems.querySelectorAll(
        '.cart-item:not(.is-removing):not([data-prada-remove-pending="true"])'
      ).length === 1;
      cartItem.dataset.pradaRemovePending = 'true';

      const isHorizontalDrawerItem = Boolean(
        isCartDrawerItem &&
        window.matchMedia('(max-width: 989px)').matches &&
        cartItem.closest('.prada-cart-drawer__items--multiple')
      );

      if (isHorizontalDrawerItem) {
        cartItem.classList.add('is-horizontal-removal');
        cartItem.style.width = `${cartItem.offsetWidth}px`;
        cartItem.style.maxWidth = `${cartItem.offsetWidth}px`;
        cartItem.style.flexBasis = `${cartItem.offsetWidth}px`;
      } else {
        cartItem.style.maxHeight = `${cartItem.offsetHeight}px`;
      }
      cartItem.style.overflow = 'hidden';
      cartItem.dataset.pradaRemoveStartedAt = String(window.performance?.now?.() || 0);
      cartItem.getBoundingClientRect();
      this.setAttribute('aria-disabled', 'true');
      this.querySelectorAll('a, button').forEach((control) => {
        control.setAttribute('aria-disabled', 'true');
        if (control.tagName === 'BUTTON') {
          control.disabled = true;
        } else {
          control.setAttribute('tabindex', '-1');
        }
      });

      const removeEvent = { currentTarget: this };
      // Start the AJAX removal on the very next frame. The CSS transition can
      // continue visually without holding the network request for 180ms.
      const removeDelay = 0;
      const removeFromCart = () => {
        cartItem.classList.add('is-collapsing');
        cartItems.updateQuantity(this.dataset.index, 0, removeEvent);
      };

      window.requestAnimationFrame(() => {
        cartItem.classList.add('is-removing');
        if (isLastLine) this.showOptimisticEmptyState(cartItems);
        CartPerformance.measureFromEvent('remove:optimistic-ui', event);

        if (removeDelay === 0) {
          removeFromCart();
          return;
        }

        window.setTimeout(removeFromCart, removeDelay);
      });
    });
  }

  showOptimisticEmptyState(cartItems) {
    if (this.optimisticEmptyState) return;

    const cartDrawer = cartItems.closest('cart-drawer');
    const cartFooter = document.getElementById('main-cart-footer');
    const displayedCount = cartDrawer?.dataset.cartItemCount ||
      document.querySelector('[data-prada-shopping-bag-count]')?.textContent ||
      '1';
    const previousCount = Number.parseInt(displayedCount, 10) || 1;
    const emptyState = cartDrawer?.ensureImmediateEmptyState?.() || null;

    this.optimisticEmptyState = { cartItems, cartDrawer, cartFooter, previousCount, emptyState };
    cartItems.dataset.pradaProjectedEmpty = 'true';
    cartItems.classList.add('is-empty');
    cartFooter?.classList.add('is-empty');
    if (cartDrawer) {
      if (cartDrawer.emptyMorphFrame) window.cancelAnimationFrame(cartDrawer.emptyMorphFrame);
      if (cartDrawer.emptyMorphTimer) window.clearTimeout(cartDrawer.emptyMorphTimer);
      if (cartDrawer.emptyMorphRevealTimer) window.clearTimeout(cartDrawer.emptyMorphRevealTimer);
      cartDrawer.emptyMorphCleanup = null;
      cartDrawer.dataset.cartItemCount = '0';
      cartDrawer.classList.add('is-empty', 'is-empty-transitioning');
      cartDrawer.classList.remove('prada-cart-drawer--multiple', 'is-empty-stable', 'is-empty-revealed');
      cartDrawer.emptyMorphFrame = window.requestAnimationFrame(() => {
        cartDrawer.emptyMorphFrame = null;
        if (!cartDrawer.classList.contains('is-empty')) return;

        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        cartDrawer.emptyMorphRevealTimer = window.setTimeout(() => {
          cartDrawer.emptyMorphRevealTimer = null;
          if (!cartDrawer.classList.contains('is-empty')) return;
          cartDrawer.classList.add('is-empty-revealed');
        }, reduceMotion ? 0 : 300);
        cartDrawer.emptyMorphTimer = window.setTimeout(() => {
          cartDrawer.emptyMorphTimer = null;
          if (!cartDrawer.classList.contains('is-empty')) return;
          cartDrawer.emptyMorphCleanup?.();
          cartDrawer.emptyMorphCleanup = null;
          cartDrawer.classList.remove('is-empty-transitioning', 'is-empty-revealed');
          cartDrawer.classList.add('is-empty-stable');
        }, reduceMotion ? 0 : 500);
      });
    }
    document.querySelectorAll('[data-prada-shopping-bag-count]').forEach((count) => {
      count.textContent = '0';
    });
    window.PradaCartHeader?.update?.(0);
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends window.StandardEvents.createViewEventElement(HTMLElement) {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  static pendingCartDataPromise = null;

  connectedCallback() {
    // The factory base class auto-dispatches cart:view from the
    // `view-event-payload` attribute (Liquid filter output). The drawer
    // sets `view-event-trigger="manual"` to skip auto-dispatch.
    super.connectedCallback();

    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') return;
      return this.onCartUpdate();
    });
  }

  // Fetches the full cart shape (used to resolve the cart:lines-update event
  // promise after /cart/add.js, which only returns the added line — not the
  // post-mutation cart aggregates). De-duplicated across concurrent callers.
  static fetchCartData() {
    if (!CartItems.pendingCartDataPromise) {
      const pendingCartDataPromise = fetch(`${routes.cart_url}.json`)
        .then((response) => response.json())
        .catch(() => null)
        .finally(() => {
          if (CartItems.pendingCartDataPromise === pendingCartDataPromise) CartItems.pendingCartDataPromise = null;
        });

      CartItems.pendingCartDataPromise = pendingCartDataPromise;
    }
    return CartItems.pendingCartDataPromise;
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      // The optimistic drawer owns the visible state until add/remove settles.
      // Avoid a competing section fetch repainting it with stale cart HTML.
      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer?.optimisticState || cartDrawer?.deferredCanonicalState) return Promise.resolve();

      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';
    const cartPerformanceUpdateMarker = CartPerformance.createStartingMarker(`${eventTarget}:user-action`);

    // Removal already has immediate row-level feedback. Disabling the entire
    // cart until Shopify responds makes the interaction look like a refresh
    // and drops taps on other rows; the mutation queue provides ordering.
    if (quantity !== 0) this.enableLoading(line);

    const action = quantity === 0 ? 'remove' : 'update';
    const quantityInput = this.querySelector(`#Quantity-${line}`) || this.querySelector(`#Drawer-quantity-${line}`);
    const lineVariantId = variantId || quantityInput?.dataset.quantityVariantId;
    const lineKey = quantityInput?.dataset.quantityLineKey;
    const linesUpdateDeferred = this.createCartLinesUpdateEvent(action, lineVariantId, quantity, lineKey);

    // Cache sections before the fetch so we read dataset.id while elements still exist in the DOM
    const sectionsToRender = this.getSectionsToRender();

    const body = JSON.stringify({
      ...(lineKey ? { id: lineKey } : { line }),
      quantity,
      sections: sectionsToRender.map((section) => section.section),
      sections_url: window.location.pathname,
    });

    const changeRequest = () => fetch(`${routes.cart_change_url}`, { ...fetchConfig(), body });
    const changePromise = window.PradaCartMutations?.enqueue
      ? window.PradaCartMutations.enqueue(changeRequest)
      : changeRequest();

    changePromise
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        if (parsedState.errors) {
          this.dispatchCartErrorEvent(parsedState.errors, 'INVALID');
          linesUpdateDeferred?.reject(new Error(parsedState.errors));
        } else {
          this.resolveCartLinesUpdate(linesUpdateDeferred, parsedState);
        }

        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const preserveProjectedEmpty = Boolean(
          !parsedState.errors &&
          parsedState.item_count > 0 &&
          quantity === 0 &&
          this.dataset.pradaProjectedEmpty === 'true'
        );
        const shouldRevealEmptyDrawer = Boolean(
          !parsedState.errors &&
          parsedState.item_count === 0 &&
          eventTarget === 'clear' &&
          cartDrawerWrapper?.classList.contains('active') &&
          !cartDrawerWrapper.classList.contains('is-empty')
        );
        const keepImmediateEmptyDrawer = Boolean(
          !parsedState.errors &&
          parsedState.item_count === 0 &&
          eventTarget === 'clear' &&
          this.matches('cart-drawer-items') &&
          cartDrawerWrapper?.classList.contains('active') &&
          event.currentTarget instanceof CartRemoveButton &&
          event.currentTarget.optimisticEmptyState
        );
        const keepStableOpenDrawer = Boolean(
          !parsedState.errors &&
          parsedState.item_count > 0 &&
          eventTarget === 'clear' &&
          this.matches('cart-drawer-items') &&
          cartDrawerWrapper?.classList.contains('active') &&
          event.currentTarget instanceof CartRemoveButton
        );
        if (shouldRevealEmptyDrawer) {
          window.clearTimeout(cartDrawerWrapper.emptyTransitionTimer);
          cartDrawerWrapper.classList.remove('is-empty-entering', 'is-empty-visible');
          cartDrawerWrapper.classList.add('is-empty-leaving');
        }

        CartPerformance.measure(`${eventTarget}:paint-updated-sections`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            if (quantity === 0 && event.currentTarget instanceof CartRemoveButton) {
              event.currentTarget.restoreRemovingState();
            }
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          if (parsedState.item_count === 0) this.removeAttribute('data-prada-projected-empty');

          if (!preserveProjectedEmpty) this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter && !preserveProjectedEmpty) {
            cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          }
          if (cartDrawerWrapper && !preserveProjectedEmpty) {
            window.clearTimeout(cartDrawerWrapper.emptyTransitionTimer);
            cartDrawerWrapper.classList.remove('is-empty-entering', 'is-empty-visible');
            if (shouldRevealEmptyDrawer) cartDrawerWrapper.classList.add('is-empty-entering');
            cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);
            cartDrawerWrapper.classList.toggle(
              'is-empty-stable',
              parsedState.item_count === 0 && !cartDrawerWrapper.classList.contains('is-empty-transitioning')
            );
            cartDrawerWrapper.classList.remove('is-empty-leaving');
            cartDrawerWrapper.classList.toggle('prada-cart-drawer--multiple', parsedState.items.length > 1);
            window.PradaCartHeader?.update?.(parsedState.item_count);
          }
          if (!preserveProjectedEmpty) {
            document.querySelectorAll('[data-prada-shopping-bag-count]').forEach((count) => {
              count.textContent = String(parsedState.item_count);
            });
          }

          sectionsToRender.forEach((section) => {
            const sectionElement = document.getElementById(section.id);

            // Keep the custom header cart button intact when cart page sections refresh.
            if (section.id === 'cart-icon-bubble' && sectionElement?.classList.contains('prada-header-btn--cart')) {
              if (!preserveProjectedEmpty) window.PradaCartHeader?.update?.(parsedState.item_count);
              return;
            }

            const elementToReplace =
              sectionElement?.querySelector(section.selector) ||
              sectionElement;
            if (!elementToReplace) return;

            // A later queued remove has already projected this cart to empty.
            // Ignore intermediate section HTML (for example the first of two
            // rapid removals returning one remaining item), otherwise it
            // resurrects the row and makes the empty state blink. The final
            // queued response owns canonical reconciliation.
            if (preserveProjectedEmpty) {
              if (section.id === 'CartDrawer') {
                cartDrawerWrapper.commitVisibleCanonicalRemove?.(
                  event.currentTarget,
                  parsedState,
                  parsedState.sections[section.section],
                  { preserveProjectedEmpty: true }
                );
              }
              return;
            }

            // The last row was already replaced by the local empty state at
            // click time. Replacing the whole open drawer again when Shopify's
            // response arrives causes the empty UI to paint twice and leaves a
            // short non-interactive gap. Clear the now-stale hidden rows but
            // keep the visible empty shell stable; the next add or page load
            // will reconcile the remaining server-rendered markup normally.
            if (section.id === 'CartDrawer' && keepImmediateEmptyDrawer) {
              this.removeAttribute('data-prada-projected-empty');
              const canonicalSaved = cartDrawerWrapper.deferCanonicalSection?.(parsedState.sections[section.section]);
              if (!canonicalSaved) cartDrawerWrapper.refreshDeferredCanonicalSection?.();
              const drawerItems = elementToReplace.querySelector('cart-drawer-items');
              const clearStaleDrawerRows = () => {
                drawerItems?.querySelectorAll('.cart-item').forEach((item) => item.remove());
                drawerItems?.classList.add('is-empty');
              };
              if (cartDrawerWrapper.classList.contains('is-empty-transitioning')) {
                cartDrawerWrapper.emptyMorphCleanup = clearStaleDrawerRows;
              } else {
                clearStaleDrawerRows();
              }
              return;
            }

            // The selected row is already fading/collapsing. Keep the open
            // drawer mounted and patch only confirmed text/count values; a
            // complete canonical section is saved and applied after close.
            // This prevents image reloads, layout flashes, and dead controls.
            if (section.id === 'CartDrawer' && keepStableOpenDrawer) {
              const keptStable = cartDrawerWrapper.commitVisibleCanonicalRemove?.(
                event.currentTarget,
                parsedState,
                parsedState.sections[section.section]
              );
              if (keptStable) return;
            }

            if (!parsedState.sections?.[section.section]) return;

            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          });

          if (shouldRevealEmptyDrawer) {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                if (!cartDrawerWrapper.classList.contains('is-empty')) return;

                cartDrawerWrapper.classList.add('is-empty-visible');
                cartDrawerWrapper.emptyTransitionTimer = window.setTimeout(() => {
                  cartDrawerWrapper.classList.remove('is-empty-entering', 'is-empty-visible');
                }, 680);
              });
            });
          }

          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper?.querySelector('.drawer__inner-empty')) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (cartDrawerWrapper) {
            const nextCartItem = cartDrawerWrapper.querySelector('.cart-item:not(.is-removing) .cart-item__name');
            if (nextCartItem) trapFocus(cartDrawerWrapper, nextCartItem);
          }
        });

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch((e) => {
        document.querySelector('cart-drawer')?.classList.remove('is-empty-leaving');
        if (quantity === 0 && event.currentTarget instanceof CartRemoveButton) {
          event.currentTarget.restoreRemovingState();
        }
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
        this.dispatchCartErrorEvent(window.cartStrings.error, 'SERVICE_UNAVAILABLE');
        linesUpdateDeferred?.reject(e);
      })
      .finally(() => {
        this.disableLoading(line);
        CartPerformance.measureFromMarker(`${eventTarget}:user-action`, cartPerformanceUpdateMarker);
      });
  }

  createCartLinesUpdateEvent(action, variantId, quantity, lineKey) {
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent || !variantId) return null;
    // No AJAX line key on the row — likely cached HTML rendered before this
    // attribute landed. Skip dispatch rather than emit an event with id: ''.
    if (!lineKey) return null;

    const deferred = CartLinesUpdateEvent.createPromise();
    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action,
        context: 'cart',
        lines: [{ id: lineKey, quantity }],
        promise: deferred.promise,
      })
    );
    return deferred;
  }

  resolveCartLinesUpdate(deferred, parsedState) {
    if (!deferred) return;
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent) return;

    deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(parsedState) });
  }

  dispatchCartErrorEvent(message, code) {
    const { CartErrorEvent } = window.StandardEvents || {};
    if (!CartErrorEvent) return;
    this.dispatchEvent(new CartErrorEvent({ error: message, code }));
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const newNote = event.target.value;
            const noteDeferred = this.dispatchNoteUpdateEvent(newNote);

            const body = JSON.stringify({ note: newNote });
            const noteRequest = () => fetch(`${routes.cart_update_url}`, { ...fetchConfig(), body });
            const notePromise = window.PradaCartMutations?.enqueue
              ? window.PradaCartMutations.enqueue(noteRequest)
              : noteRequest();
            notePromise
              .then((r) => r.json())
              .then((cart) => {
                if (!cart || cart.errors) {
                  throw Object.assign(new Error(cart?.errors), { code: 'INVALID' });
                }

                if (noteDeferred) {
                  const { CartNoteUpdateEvent } = window.StandardEvents || {};
                  if (CartNoteUpdateEvent) {
                    noteDeferred.resolve({ cart: CartNoteUpdateEvent.createCartFromAjaxResponse(cart) });
                  }
                }
                CartPerformance.measureFromEvent('note-update:user-action', event);
              })
              .catch((e) => {
                noteDeferred?.reject(e);
                const { CartErrorEvent } = window.StandardEvents || {};
                if (CartErrorEvent) {
                  this.dispatchEvent(
                    new CartErrorEvent({
                      error: e.message || 'Note update failed',
                      code: e.code || 'SERVICE_UNAVAILABLE',
                    })
                  );
                }
              });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }

      dispatchNoteUpdateEvent(newNote) {
        const { CartNoteUpdateEvent } = window.StandardEvents || {};
        if (!CartNoteUpdateEvent) return null;

        const context = this.closest('dialog') || this.closest('cart-drawer') ? 'dialog' : 'cart';
        const deferred = CartNoteUpdateEvent.createPromise();

        this.dispatchEvent(
          new CartNoteUpdateEvent({
            context,
            note: newNote,
            promise: deferred.promise,
          })
        );

        return deferred;
      }
    }
  );
}
