(() => {
  if (window.pradaShoppingBagBound) return;
  window.pradaShoppingBagBound = true;

  const desktopMediaQuery = window.matchMedia('(min-width: 990px)');
  const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const bindDesktopAccordion = (root = document) => {
    const disclosureGroup = root.querySelector('.prada-shopping-bag-footer__desktop-info');
    if (!disclosureGroup || disclosureGroup.dataset.pradaAccordionBound === 'true') return;

    disclosureGroup.dataset.pradaAccordionBound = 'true';
  };

  bindDesktopAccordion();
  document.addEventListener('shopify:section:load', (event) => bindDesktopAccordion(event.target));

  document.addEventListener('click', (event) => {
    const moveButton = event.target.closest('[data-prada-cart-move-to-wishlist]');
    if (!moveButton || moveButton.disabled || !window.PradaWishlist?.add) return;

    event.preventDefault();

    window.PradaWishlist.add({
      id: moveButton.dataset.productId,
      title: moveButton.dataset.productTitle,
      url: moveButton.dataset.productUrl,
      image: moveButton.dataset.productImage,
      imageAlt: moveButton.dataset.productImageAlt,
      price: moveButton.dataset.productPrice,
      variantId: moveButton.dataset.productVariantId,
      available: moveButton.dataset.productAvailable,
    });

    moveButton.disabled = true;
    moveButton
      .closest('.cart-item')
      ?.querySelector('.prada-shopping-bag-page__remove')
      ?.querySelector('button')
      ?.click();
  });

  const colorSwatch = (value) => {
    const swatches = {
      black: '#111111',
      blue: '#93c6e7',
      brown: '#7c563d',
      green: '#5f7259',
      grey: '#a8a8a8',
      gray: '#a8a8a8',
      navy: '#1f3657',
      pink: '#e9a0ad',
      red: '#bd2f2f',
      white: '#f6f6f6',
      yellow: '#d5b53b',
    };
    const normalized = String(value || '').toLowerCase();
    return Object.keys(swatches).find((name) => normalized.includes(name))
      ? swatches[Object.keys(swatches).find((name) => normalized.includes(name))]
      : '#d4d4d4';
  };

  const parseEditorData = (button) => {
    const dataElement = document.getElementById(button.dataset.pradaCartEditData);
    if (!dataElement) return null;

    try {
      return JSON.parse(dataElement.textContent);
    } catch (error) {
      console.error('Unable to read cart editor data.', error);
      return null;
    }
  };

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    })[character]);

  const normalisePrice = (value) => {
    const parser = document.createElement('textarea');
    parser.innerHTML = String(value || '');
    return parser.value.replace(/<[^>]*>/g, '').replace(/^\s*(?:Rs\.?|INR)\s*/i, '₹ ').trim();
  };

  const createCartEditor = (data, trigger) => {
    const existingModal = document.querySelector('[data-prada-cart-editor-modal]');
    existingModal?.remove();

    const variants = data.variants || [];
    const productOptions = data.options || [];
    const currentVariant = variants.find((variant) => Number(variant.id) === Number(data.variantId)) || variants[0];
    const selectedOptions = currentVariant ? [...currentVariant.options] : [];
    const initialQuantity = Math.max(1, Number(data.quantity) || 1);
    const initialVariantId = Number(currentVariant?.id || data.variantId);
    let selectedQuantity = initialQuantity;
    let activeImageIndex = 0;
    const images = (data.images || []).filter((image) => image?.src);

    if (!images.length && data.image) images.push({ src: data.image, alt: data.title });
    if (!images.length && currentVariant?.image) images.push({ src: currentVariant.image, alt: data.title });

    const modal = document.createElement('div');
    modal.className = 'prada-cart-edit-modal';
    modal.dataset.pradaCartEditorModal = '';
    modal.innerHTML = `
      <button class="prada-cart-edit-modal__backdrop" type="button" aria-label="Close product editor"></button>
      <section class="prada-cart-edit-modal__dialog" role="dialog" aria-modal="true" aria-label="Edit ${data.title}">
        <button class="prada-cart-edit-modal__close" type="button" aria-label="Close product editor"><span></span></button>
        <div class="prada-cart-edit-modal__gallery">
          <button class="prada-cart-edit-modal__gallery-arrow prada-cart-edit-modal__gallery-arrow--previous" type="button" aria-label="Previous image"><span></span></button>
          <img class="prada-cart-edit-modal__image" alt="">
          <img class="prada-cart-edit-modal__image-preview" alt="" aria-hidden="true">
          <button class="prada-cart-edit-modal__gallery-arrow prada-cart-edit-modal__gallery-arrow--next" type="button" aria-label="Next image"><span></span></button>
          <div class="prada-cart-edit-modal__dots" aria-hidden="true"></div>
        </div>
        <div class="prada-cart-edit-modal__content">
          <div class="prada-cart-edit-modal__scroll">
            <div class="prada-cart-edit-modal__product-heading">
              <h2>${escapeHtml(data.title)}</h2>
              <p class="prada-cart-edit-modal__price">${escapeHtml(normalisePrice(currentVariant?.price || data.price))}</p>
            </div>
            <div class="prada-cart-edit-modal__options"></div>
            <p class="prada-cart-edit-modal__status" role="status"></p>
            <button class="prada-cart-edit-modal__details" type="button" aria-expanded="false">Show details</button>
            <div class="prada-cart-edit-modal__description" hidden></div>
          </div>
          <div class="prada-cart-edit-modal__actions">
            <button class="prada-cart-edit-modal__cancel" type="button">Cancel</button>
            <button class="prada-cart-edit-modal__confirm" type="button">Confirm</button>
          </div>
        </div>
      </section>`;

    document.body.append(modal);
    document.documentElement.classList.add('prada-cart-edit-modal-open');

    const dialog = modal.querySelector('.prada-cart-edit-modal__dialog');
    const image = modal.querySelector('.prada-cart-edit-modal__image');
    const previewImage = modal.querySelector('.prada-cart-edit-modal__image-preview');
    const dots = modal.querySelector('.prada-cart-edit-modal__dots');
    const previousButton = modal.querySelector('.prada-cart-edit-modal__gallery-arrow--previous');
    const nextButton = modal.querySelector('.prada-cart-edit-modal__gallery-arrow--next');
    const optionsContainer = modal.querySelector('.prada-cart-edit-modal__options');
    const price = modal.querySelector('.prada-cart-edit-modal__price');
    const status = modal.querySelector('.prada-cart-edit-modal__status');
    const confirmButton = modal.querySelector('.prada-cart-edit-modal__confirm');
    const detailsButton = modal.querySelector('.prada-cart-edit-modal__details');
    const description = modal.querySelector('.prada-cart-edit-modal__description');
    let handleEscape;

    const getSelectedVariant = () =>
      variants.find((variant) =>
        productOptions.every((option, index) => variant.options[index] === selectedOptions[index])
      );

    const getGalleryImages = () => {
      const selectedVariant = getSelectedVariant();
      const preferredImage = selectedVariant?.image;
      if (!preferredImage) return images;

      return [
        { src: preferredImage, alt: data.title },
        ...images.filter((galleryImage) => galleryImage.src !== preferredImage),
      ];
    };

    const renderGallery = () => {
      const galleryImages = getGalleryImages();
      if (activeImageIndex >= galleryImages.length) activeImageIndex = 0;
      const activeImage = galleryImages[activeImageIndex] || { src: '', alt: data.title };

      image.src = activeImage.src;
      image.alt = activeImage.alt || data.title;
      const nextImage = galleryImages[(activeImageIndex + 1) % galleryImages.length];
      previewImage.hidden = galleryImages.length < 2;
      if (nextImage) previewImage.src = nextImage.src;
      previousButton.hidden = nextButton.hidden = galleryImages.length < 2;
      dots.innerHTML = galleryImages.length > 1
        ? galleryImages.map((_, index) => `<span class="${index === activeImageIndex ? 'is-active' : ''}"></span>`).join('')
        : '';
    };

    const renderOptions = () => {
      const selectedVariant = getSelectedVariant();
      price.textContent = normalisePrice(selectedVariant?.price || data.price);
      const hasChanges = Boolean(
        selectedVariant &&
        (Number(selectedVariant.id) !== initialVariantId || selectedQuantity !== initialQuantity)
      );
      confirmButton.disabled = !selectedVariant || !selectedVariant.available || !hasChanges;
      status.textContent = selectedVariant?.available === false ? 'This option is currently unavailable.' : '';
      optionsContainer.innerHTML = '';

      productOptions.forEach((option, optionIndex) => {
        const isDefaultTitle =
          String(option.name || '').trim().toLowerCase() === 'title' &&
          option.values.length === 1 &&
          String(option.values[0] || '').trim().toLowerCase() === 'default title';
        if (isDefaultTitle) return;

        const normalizedName = String(option.name || '').toLowerCase();
        const row = document.createElement('div');
        row.className = 'prada-cart-edit-modal__option-row';

        if (normalizedName.includes('color') || normalizedName.includes('colour')) {
          row.innerHTML = `<span class="prada-cart-edit-modal__option-label">${escapeHtml(option.name)}:</span><div class="prada-cart-edit-modal__color-values"></div>`;
          const values = row.querySelector('.prada-cart-edit-modal__color-values');
          option.values.forEach((value) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'prada-cart-edit-modal__color-value';
            button.dataset.optionIndex = optionIndex;
            button.dataset.optionValue = value;
            button.setAttribute('aria-pressed', String(selectedOptions[optionIndex] === value));
            button.innerHTML = `<span class="prada-cart-edit-modal__swatch" style="background:${colorSwatch(value)}"></span>${escapeHtml(value)}`;
            values.append(button);
          });
        } else {
          row.innerHTML = `<label class="prada-cart-edit-modal__select-label">${escapeHtml(option.name)}:<select class="prada-cart-edit-modal__select" data-option-index="${optionIndex}">${option.values.map((value) => `<option value="${escapeHtml(value)}" ${selectedOptions[optionIndex] === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>`;
        }
        optionsContainer.append(row);
      });

      const quantityRow = document.createElement('div');
      quantityRow.className = 'prada-cart-edit-modal__quantity-row';
      quantityRow.innerHTML = `
        <span>Quantity:</span>
        <div class="prada-cart-edit-modal__stepper">
          <button type="button" data-prada-editor-quantity="decrease" aria-label="Decrease quantity" ${selectedQuantity <= 1 ? 'disabled' : ''}>-</button>
          <output>${selectedQuantity}</output>
          <button type="button" data-prada-editor-quantity="increase" aria-label="Increase quantity">+</button>
        </div>`;
      optionsContainer.append(quantityRow);
      renderGallery();
    };

    const close = () => {
      modal.classList.add('is-closing');
      window.setTimeout(() => {
        modal.remove();
        document.documentElement.classList.remove('prada-cart-edit-modal-open');
        document.removeEventListener('keydown', handleEscape);
        trigger.focus();
      }, motionMediaQuery.matches ? 0 : 180);
    };

    modal.addEventListener('click', (event) => {
      if (event.target.closest('.prada-cart-edit-modal__backdrop, .prada-cart-edit-modal__close, .prada-cart-edit-modal__cancel')) {
        close();
        return;
      }

      const colorButton = event.target.closest('.prada-cart-edit-modal__color-value');
      if (colorButton) {
        selectedOptions[Number(colorButton.dataset.optionIndex)] = colorButton.dataset.optionValue;
        activeImageIndex = 0;
        renderOptions();
        return;
      }

      const quantityButton = event.target.closest('[data-prada-editor-quantity]');
      if (quantityButton) {
        selectedQuantity = Math.max(1, selectedQuantity + (quantityButton.dataset.pradaEditorQuantity === 'increase' ? 1 : -1));
        renderOptions();
        return;
      }

      if (event.target.closest('.prada-cart-edit-modal__gallery-arrow--previous')) {
        const galleryImages = getGalleryImages();
        activeImageIndex = (activeImageIndex - 1 + galleryImages.length) % galleryImages.length;
        renderGallery();
        return;
      }

      if (event.target.closest('.prada-cart-edit-modal__gallery-arrow--next')) {
        const galleryImages = getGalleryImages();
        activeImageIndex = (activeImageIndex + 1) % galleryImages.length;
        renderGallery();
      }
    });

    modal.addEventListener('change', (event) => {
      const select = event.target.closest('.prada-cart-edit-modal__select');
      if (!select) return;
      selectedOptions[Number(select.dataset.optionIndex)] = select.value;
      activeImageIndex = 0;
      renderOptions();
    });

    let touchStartX = null;
    const gallery = modal.querySelector('.prada-cart-edit-modal__gallery');
    gallery.addEventListener('touchstart', (event) => {
      touchStartX = event.touches[0]?.clientX ?? null;
    }, { passive: true });
    gallery.addEventListener('touchend', (event) => {
      if (touchStartX === null) return;
      const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      touchStartX = null;
      if (Math.abs(delta) < 40) return;
      const galleryImages = getGalleryImages();
      activeImageIndex = delta < 0
        ? (activeImageIndex + 1) % galleryImages.length
        : (activeImageIndex - 1 + galleryImages.length) % galleryImages.length;
      renderGallery();
    }, { passive: true });

    confirmButton.addEventListener('click', async () => {
      const selectedVariant = getSelectedVariant();
      if (!selectedVariant || !selectedVariant.available || confirmButton.disabled) return;

      confirmButton.disabled = true;
      status.textContent = 'Updating your shopping bag...';

      try {
        const isVariantChange = Number(selectedVariant.id) !== Number(data.variantId);

        if (isVariantChange) {
          const itemToAdd = {
            id: selectedVariant.id,
            quantity: selectedQuantity,
          };

          if (data.properties && !Array.isArray(data.properties) && typeof data.properties === 'object') {
            itemToAdd.properties = data.properties;
          }

          if (data.sellingPlan) itemToAdd.selling_plan = data.sellingPlan;

          const addResponse = await fetch(`${routes.cart_add_url}`, {
            ...fetchConfig(),
            body: JSON.stringify({ items: [itemToAdd] }),
          });
          const addData = await addResponse.json();

          if (!addResponse.ok || addData.status) {
            throw new Error(addData.description || 'Unable to update the selected option.');
          }
        }

        const changeResponse = await fetch(`${routes.cart_change_url}`, {
          ...fetchConfig(),
          body: JSON.stringify({ id: data.key, quantity: isVariantChange ? 0 : selectedQuantity }),
        });
        const changeData = await changeResponse.json();

        if (!changeResponse.ok || changeData.status) {
          throw new Error(changeData.description || 'Unable to update the shopping bag.');
        }

        window.location.reload();
      } catch (error) {
        console.error(error);
        status.textContent = error.message || 'We could not update this item. Please try again.';
        confirmButton.disabled = false;
      }
    });

    detailsButton.addEventListener('click', () => {
      const isOpen = detailsButton.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        description.hidden = true;
        detailsButton.setAttribute('aria-expanded', 'false');
        detailsButton.textContent = 'Show details';
        return;
      }

      description.innerHTML = data.description || '<p>Product details are not available for this item.</p>';
      description.hidden = false;
      detailsButton.setAttribute('aria-expanded', 'true');
      detailsButton.textContent = 'Hide details';
      window.requestAnimationFrame(() => description.scrollIntoView({ block: 'nearest', behavior: motionMediaQuery.matches ? 'auto' : 'smooth' }));
    });

    handleEscape = (event) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    renderOptions();
    dialog.focus();
  };

  document.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-prada-cart-edit]');
    if (!editButton) return;

    event.preventDefault();
    const data = parseEditorData(editButton);
    if (data) createCartEditor(data, editButton);
  });
})();
