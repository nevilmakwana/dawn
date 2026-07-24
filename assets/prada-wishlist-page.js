(() => {
  const rootSelector = '[data-prada-wishlist-page]';
  const heartIcon = `
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 20.15 5.3 13.8A5.05 5.05 0 0 1 12 6.25a5.05 5.05 0 0 1 6.7 7.55L12 20.15Z"></path>
    </svg>`;

  const createRemoveButton = (item) => {
    const button = document.createElement('button');
    button.className = 'prada-wishlist-page__remove';
    button.type = 'button';
    button.dataset.pradaWishlistRemove = '';
    button.setAttribute('aria-label', `Remove ${item.title} from wishlist`);
    button.innerHTML = `<span class="svg-wrapper">${heartIcon}</span>`;
    return button;
  };

  const createProductCard = (item) => {
    const article = document.createElement('article');
    article.className = 'prada-wishlist-page__card';
    article.dataset.pradaWishlistCard = '';
    article.dataset.productId = item.id;

    const media = document.createElement('div');
    media.className = 'prada-wishlist-page__media';

    const imageLink = document.createElement('a');
    imageLink.className = 'prada-wishlist-page__image-link';
    imageLink.href = item.url;

    if (item.image) {
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = item.imageAlt || item.title;
      image.loading = 'lazy';
      imageLink.append(image);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'prada-wishlist-page__placeholder';
      imageLink.append(placeholder);
    }

    media.append(imageLink, createRemoveButton(item));

    const details = document.createElement('div');
    details.className = 'prada-wishlist-page__details';

    const title = document.createElement('a');
    title.className = 'prada-wishlist-page__title';
    title.href = item.url;
    title.textContent = item.title;

    const price = document.createElement('p');
    price.className = 'prada-wishlist-page__price';
    price.textContent = item.price;
    details.append(title, price);

    const form = document.createElement('form');
    form.className = 'prada-wishlist-page__form';
    form.action = window.routes?.cart_add_url || '/cart/add';
    form.method = 'post';
    form.dataset.pradaWishlistAddForm = '';

    const variantId = document.createElement('input');
    variantId.type = 'hidden';
    variantId.name = 'id';
    variantId.value = item.variantId;

    const addButton = document.createElement('button');
    addButton.className = 'prada-wishlist-page__add';
    addButton.type = 'submit';
    addButton.textContent = item.available && item.variantId ? 'ADD TO BAG' : 'SOLD OUT';
    addButton.disabled = !item.available || !item.variantId;

    form.append(variantId, addButton);
    article.append(media, details, form);
    return article;
  };

  const initialize = (root) => {
    if (!root || root.dataset.pradaWishlistBound === 'true') return;
    root.dataset.pradaWishlistBound = 'true';

    const grid = root.querySelector('[data-prada-wishlist-grid]');
    const count = root.querySelector('[data-prada-wishlist-count]');
    const emptyState = root.querySelector('[data-prada-wishlist-empty]');

    const render = () => {
      const items = window.PradaWishlist?.get?.() || [];

      if (count) count.textContent = String(items.length);
      if (grid) {
        grid.replaceChildren(...items.map(createProductCard));
        grid.hidden = items.length === 0;
      }
      if (emptyState) emptyState.hidden = items.length !== 0;
    };

    root.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-prada-wishlist-remove]');
      if (!removeButton) return;

      event.preventDefault();

      const card = removeButton.closest('[data-prada-wishlist-card]');
      const productId = card?.dataset.productId;
      if (!productId || card.classList.contains('is-removing')) return;

      card.classList.add('is-removing');
      window.setTimeout(() => window.PradaWishlist?.remove?.(productId), 180);
    });

    root.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-prada-wishlist-add-form]');
      if (!form) return;

      event.preventDefault();

      const addButton = form.querySelector('[type="submit"]');
      if (!addButton || addButton.disabled || addButton.dataset.loading === 'true') return;

      addButton.dataset.loading = 'true';
      addButton.setAttribute('aria-busy', 'true');
      addButton.disabled = true;

      try {
        const cartDrawer = document.querySelector('cart-drawer');
        const formData = new FormData(form);

        if (cartDrawer) {
          formData.append(
            'sections',
            cartDrawer
              .getSectionsToRender()
              .map((section) => section.id)
              .join(','),
          );
          formData.append('sections_url', window.location.pathname);
        }

        const response = await fetch(form.action, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: formData,
        });
        const cartState = await response.json();

        if (!response.ok || cartState.status) throw new Error(cartState.description || 'Unable to add this item to your bag.');

        if (cartDrawer && cartState.sections) {
          cartDrawer.renderContents(cartState, { shouldOpen: false });
          return;
        }

        window.location.assign(window.routes?.cart_url || '/cart');
      } catch (error) {
        form.submit();
      } finally {
        delete addButton.dataset.loading;
        addButton.removeAttribute('aria-busy');
        if (addButton.textContent === 'ADD TO BAG') addButton.disabled = false;
      }
    });

    document.addEventListener('prada:wishlist-ready', render);
    document.addEventListener('prada:wishlist-updated', render);
    render();
  };

  const initializeAll = (scope = document) => {
    if (scope.matches?.(rootSelector)) initialize(scope);
    scope.querySelectorAll?.(rootSelector).forEach(initialize);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeAll());
  } else {
    initializeAll();
  }

  document.addEventListener('shopify:section:load', (event) => initializeAll(event.target));
})();
