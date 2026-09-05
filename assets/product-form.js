if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        const preferredCart = this.dataset.cartTarget === 'drawer' ? 'cart-drawer' : 'cart-notification';
        const fallbackCart = preferredCart === 'cart-drawer' ? 'cart-notification' : 'cart-drawer';
        this.cart = document.querySelector(preferredCart) || document.querySelector(fallbackCart);
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        const variantId = formData.get('id');
        const quantity = parseInt(formData.get('quantity')) || 1;
        const linesUpdateDeferred = this.createCartLinesUpdateEvent(variantId, quantity);
        const shouldOpenCart =
          this.dataset.openCart === 'true' || !window.matchMedia('(max-width: 749px)').matches;
        const quickAddModal = this.closest('quick-add-modal');
        const optimisticItem = this.getOptimisticCartItem(variantId, quantity);
        const optimisticState =
          this.cart && shouldOpenCart && !quickAddModal && optimisticItem
            ? this.cart.beginOptimisticAdd?.(optimisticItem, this.submitButton)
            : null;

        // The optimistic drawer already has everything needed for the first
        // paint. Let Shopify confirm the cart mutation without also rendering
        // the full drawer in the critical request; refresh that markup after.
        if (optimisticState) {
          formData.delete('sections');
          formData.delete('sections_url');
        }

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              this.cart?.cancelOptimisticAdd?.(optimisticState);
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: variantId,
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);
              this.dispatchCartErrorEvent(response.description || response.message, 'INVALID');
              linesUpdateDeferred?.reject(new Error(response.description || response.message));

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              this.resolveCartLinesUpdate(linesUpdateDeferred);
              window.location = window.routes.cart_url;
              return;
            }

            if (optimisticState) this.cart.confirmOptimisticAdd?.(optimisticState, response);
            this.resolveCartLinesUpdate(linesUpdateDeferred);

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: variantId,
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.cart.renderContents(response, { shouldOpen: shouldOpenCart });
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              if (optimisticState) {
                this.cart.refreshAfterOptimisticAdd?.(optimisticState);
              } else {
                CartPerformance.measure("add:paint-updated-sections", () => {
                  this.cart.renderContents(response, { shouldOpen: shouldOpenCart });
                });
              }
            }
          })
          .catch((e) => {
            console.error(e);
            this.cart?.cancelOptimisticAdd?.(optimisticState);
            this.dispatchCartErrorEvent(e.message || 'Network error', 'SERVICE_UNAVAILABLE');
            linesUpdateDeferred?.reject(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      getOptimisticCartItem(variantId, quantity) {
        const product = this.closest('.prada-product');
        if (!product) return null;

        const title = product.querySelector('.prada-product__heading-row h1')?.textContent?.trim();
        if (!title) return null;

        const image = product.querySelector('.prada-product__media-list .prada-product__gallery-image');
        const selectedSwatchImage = product.querySelector('.prada-product__swatch.is-selected img');
        const priceContainer = product.querySelector('[data-prada-price]');
        const price = priceContainer?.querySelector(':scope > span.money:last-of-type')?.textContent?.trim() || '';
        const options = [...product.querySelectorAll('select[data-prada-option]')]
          .map((select) => ({
            name: select.dataset.pradaOptionName || '',
            value: select.value,
          }))
          .filter((option) => option.name && option.value && option.value.toLowerCase() !== 'default title');

        return {
          variantId,
          title,
          url: `${product.dataset.productUrl}?variant=${variantId}`,
          image:
            image?.currentSrc ||
            image?.src ||
            selectedSwatchImage?.currentSrc ||
            selectedSwatchImage?.src ||
            product.dataset.wishlistFallbackImage ||
            '',
          imageAlt: image?.alt || title,
          price,
          priceCents: Number.parseInt(priceContainer?.dataset.pradaPriceCents || '0', 10) || 0,
          quantity,
          options,
        };
      }

      createCartLinesUpdateEvent(variantId, quantity) {
        const { CartLinesUpdateEvent } = window.StandardEvents || {};
        if (!CartLinesUpdateEvent) return null;

        const deferred = CartLinesUpdateEvent.createPromise();
        this.dispatchEvent(
          new CartLinesUpdateEvent({
            action: 'add',
            context: 'product',
            lines: [{ merchandiseId: variantId, quantity }],
            promise: deferred.promise,
          })
        );
        return deferred;
      }

      resolveCartLinesUpdate(deferred) {
        if (!deferred) return;
        const { CartLinesUpdateEvent } = window.StandardEvents || {};
        if (!CartLinesUpdateEvent) return;

        const pendingCartDataPromise = typeof CartItems !== 'undefined'
          ? CartItems.fetchCartData()
          : fetch(`${routes.cart_url}.json`).then((response) => response.json());

        pendingCartDataPromise
          .then((cart) => {
            if (!cart?.currency) return deferred.reject(new Error('Missing currency in cart response'));
            deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart) });
          })
          .catch((e) => deferred.reject(e));
      }

      dispatchCartErrorEvent(message, code) {
        const { CartErrorEvent } = window.StandardEvents || {};
        if (!CartErrorEvent) return;
        this.dispatchEvent(new CartErrorEvent({ error: message, code }));
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
