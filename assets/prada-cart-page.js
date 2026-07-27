(() => {
  if (window.pradaShoppingBagBound) return;
  window.pradaShoppingBagBound = true;

  const desktopMediaQuery = window.matchMedia('(min-width: 990px)');
  const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const getDisclosureContent = (disclosure) =>
    disclosure.querySelector('.prada-shopping-bag-footer__desktop-disclosure-content');

  const finishDisclosureState = (disclosure, isOpen) => {
    const content = getDisclosureContent(disclosure);
    disclosure.open = isOpen;
    disclosure.dataset.animating = 'false';
    disclosure.style.height = '';
    disclosure.style.overflow = '';
    disclosure.style.transition = '';

    if (!content) return;

    content.style.opacity = '';
    content.style.transition = '';
  };

  const animateDisclosure = (disclosure, shouldOpen) => {
    const content = getDisclosureContent(disclosure);
    const summary = disclosure.querySelector('summary');
    if (!content || !summary) {
      disclosure.open = shouldOpen;
      return Promise.resolve();
    }

    if (!desktopMediaQuery.matches || motionMediaQuery.matches) {
      finishDisclosureState(disclosure, shouldOpen);
      return Promise.resolve();
    }

    disclosure.dataset.animating = 'true';

    return new Promise((resolve) => {
      let finished = false;
      const complete = () => {
        if (finished) return;
        finished = true;
        disclosure.removeEventListener('transitionend', onTransitionEnd);
        finishDisclosureState(disclosure, shouldOpen);
        resolve();
      };

      const onTransitionEnd = (event) => {
        if (event.target !== disclosure || event.propertyName !== 'height') return;
        complete();
      };

      disclosure.addEventListener('transitionend', onTransitionEnd);
      disclosure.style.transition = 'none';
      content.style.transition = 'none';
      disclosure.style.overflow = 'hidden';

      if (shouldOpen) {
        disclosure.open = true;
        content.style.opacity = '0';
        disclosure.style.height = `${summary.offsetHeight}px`;
        void disclosure.offsetHeight;

        disclosure.style.transition = 'height 280ms cubic-bezier(0.22, 1, 0.36, 1)';
        content.style.transition = 'opacity 220ms ease';
        requestAnimationFrame(() => {
          disclosure.style.height = `${summary.offsetHeight + content.offsetHeight}px`;
          content.style.opacity = '1';
        });
      } else {
        disclosure.style.height = `${disclosure.offsetHeight}px`;
        content.style.opacity = '1';
        void disclosure.offsetHeight;

        disclosure.style.transition = 'height 240ms cubic-bezier(0.4, 0, 0.2, 1)';
        content.style.transition = 'opacity 160ms ease';
        requestAnimationFrame(() => {
          disclosure.style.height = `${summary.offsetHeight}px`;
          content.style.opacity = '0';
        });
      }

      window.setTimeout(complete, 420);
    });
  };

  const bindDesktopAccordion = (root = document) => {
    const disclosureGroup = root.querySelector('.prada-shopping-bag-footer__desktop-info');
    if (!disclosureGroup || disclosureGroup.dataset.pradaAccordionBound === 'true') return;

    const disclosures = Array.from(disclosureGroup.querySelectorAll('.prada-shopping-bag-footer__desktop-disclosure'));
    if (!disclosures.length) return;

    disclosureGroup.dataset.pradaAccordionBound = 'true';

    const normalizeOpenState = async () => {
      disclosures.forEach((disclosure) => {
        const content = getDisclosureContent(disclosure);
        disclosure.dataset.animating = 'false';

        if (!content) return;
        finishDisclosureState(disclosure, disclosure.open);
      });

      if (!desktopMediaQuery.matches) return;

      const openDisclosure = disclosures.find((disclosure) => disclosure.open);

      for (const disclosure of disclosures) {
        finishDisclosureState(disclosure, disclosure === openDisclosure);
      }
    };

    normalizeOpenState();

    disclosures.forEach((disclosure) => {
      const summary = disclosure.querySelector('summary');
      if (!summary) return;

      summary.addEventListener('click', async (event) => {
        if (!desktopMediaQuery.matches) return;

        event.preventDefault();
        if (disclosureGroup.dataset.animating === 'true') return;

        disclosureGroup.dataset.animating = 'true';

        try {
          const openDisclosures = disclosures.filter((item) => item.open && item !== disclosure);

          if (disclosure.open) {
            await animateDisclosure(disclosure, false);
            return;
          }

          await Promise.all([
            ...openDisclosures.map((item) => animateDisclosure(item, false)),
            animateDisclosure(disclosure, true),
          ]);
        } finally {
          disclosureGroup.dataset.animating = 'false';
        }
      });
    });

    if (!window.pradaShoppingBagAccordionViewportBound) {
      const syncAccordionForViewport = async (event) => {
        document.querySelectorAll('.prada-shopping-bag-footer__desktop-info').forEach((group) => {
          const groupDisclosures = Array.from(group.querySelectorAll('.prada-shopping-bag-footer__desktop-disclosure'));

          if (!event.matches) {
            groupDisclosures.forEach((disclosure) => {
              disclosure.dataset.animating = 'false';
              const content = getDisclosureContent(disclosure);
              if (!content) return;

              finishDisclosureState(disclosure, disclosure.open);
            });
            return;
          }

          const openDisclosure = groupDisclosures.find((disclosure) => disclosure.open);
          groupDisclosures.forEach((disclosure) => {
            finishDisclosureState(disclosure, disclosure === openDisclosure);
          });
        });
      };

      if (desktopMediaQuery.addEventListener) {
        desktopMediaQuery.addEventListener('change', syncAccordionForViewport);
      } else {
        desktopMediaQuery.addListener(syncAccordionForViewport);
      }

      window.pradaShoppingBagAccordionViewportBound = true;
    }
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

  const createCartEditor = (data, trigger) => {
    const existingModal = document.querySelector('[data-prada-cart-editor-modal]');
    existingModal?.remove();

    const variants = data.variants || [];
    const productOptions = data.options || [];
    const currentVariant = variants.find((variant) => Number(variant.id) === Number(data.variantId)) || variants[0];
    const selectedOptions = currentVariant ? [...currentVariant.options] : [];
    let selectedQuantity = Math.max(1, Number(data.quantity) || 1);
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
          <button class="prada-cart-edit-modal__gallery-arrow prada-cart-edit-modal__gallery-arrow--next" type="button" aria-label="Next image"><span></span></button>
          <div class="prada-cart-edit-modal__dots" aria-hidden="true"></div>
        </div>
        <div class="prada-cart-edit-modal__content">
          <div class="prada-cart-edit-modal__scroll">
            <div class="prada-cart-edit-modal__product-heading">
              <h2>${escapeHtml(data.title)}</h2>
              <p class="prada-cart-edit-modal__price">${currentVariant?.price || data.price || ''}</p>
            </div>
            <div class="prada-cart-edit-modal__options"></div>
            <p class="prada-cart-edit-modal__status" role="status"></p>
            <a class="prada-cart-edit-modal__details" href="${escapeHtml(data.url || '#')}">Show details</a>
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
    const dots = modal.querySelector('.prada-cart-edit-modal__dots');
    const previousButton = modal.querySelector('.prada-cart-edit-modal__gallery-arrow--previous');
    const nextButton = modal.querySelector('.prada-cart-edit-modal__gallery-arrow--next');
    const optionsContainer = modal.querySelector('.prada-cart-edit-modal__options');
    const price = modal.querySelector('.prada-cart-edit-modal__price');
    const status = modal.querySelector('.prada-cart-edit-modal__status');
    const confirmButton = modal.querySelector('.prada-cart-edit-modal__confirm');
    let handleEscape;

    const getSelectedVariant = () =>
      variants.find((variant) =>
        productOptions.every((option, index) => variant.options[index] === selectedOptions[index])
      );

    const renderGallery = () => {
      const selectedVariant = getSelectedVariant();
      const preferredImage = selectedVariant?.image;
      const activeImage = preferredImage
        ? { src: preferredImage, alt: data.title }
        : images[activeImageIndex] || { src: '', alt: data.title };

      image.src = activeImage.src;
      image.alt = activeImage.alt || data.title;
      previousButton.hidden = nextButton.hidden = images.length < 2 || Boolean(preferredImage);
      dots.innerHTML = images.length > 1 && !preferredImage
        ? images.map((_, index) => `<span class="${index === activeImageIndex ? 'is-active' : ''}"></span>`).join('')
        : '';
    };

    const renderOptions = () => {
      const selectedVariant = getSelectedVariant();
      price.textContent = selectedVariant?.price || data.price || '';
      confirmButton.disabled = !selectedVariant || !selectedVariant.available;
      status.textContent = selectedVariant?.available === false ? 'This option is currently unavailable.' : '';
      optionsContainer.innerHTML = '';

      productOptions.forEach((option, optionIndex) => {
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
          <button type="button" data-prada-editor-quantity="decrease" aria-label="Decrease quantity">-</button>
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
        activeImageIndex = (activeImageIndex - 1 + images.length) % images.length;
        renderGallery();
        return;
      }

      if (event.target.closest('.prada-cart-edit-modal__gallery-arrow--next')) {
        activeImageIndex = (activeImageIndex + 1) % images.length;
        renderGallery();
      }
    });

    modal.addEventListener('change', (event) => {
      const select = event.target.closest('.prada-cart-edit-modal__select');
      if (!select) return;
      selectedOptions[Number(select.dataset.optionIndex)] = select.value;
      renderOptions();
    });

    confirmButton.addEventListener('click', async () => {
      const selectedVariant = getSelectedVariant();
      if (!selectedVariant || !selectedVariant.available || confirmButton.disabled) return;

      confirmButton.disabled = true;
      status.textContent = 'Updating your shopping bag...';

      try {
        const changeResponse = await fetch(`${routes.cart_change_url}`, {
          ...fetchConfig(),
          body: JSON.stringify({ id: data.key, quantity: Number(selectedVariant.id) === Number(data.variantId) ? selectedQuantity : 0 }),
        });

        if (!changeResponse.ok) throw new Error('Unable to update the shopping bag.');

        if (Number(selectedVariant.id) !== Number(data.variantId)) {
          const addResponse = await fetch(`${routes.cart_add_url}`, {
            ...fetchConfig(),
            body: JSON.stringify({
              items: [{
                id: selectedVariant.id,
                quantity: selectedQuantity,
                properties: data.properties || {},
                ...(data.sellingPlan ? { selling_plan: data.sellingPlan } : {}),
              }],
            }),
          });
          if (!addResponse.ok) throw new Error('Unable to update the selected option.');
        }

        window.location.reload();
      } catch (error) {
        console.error(error);
        status.textContent = 'We could not update this item. Please try again.';
        confirmButton.disabled = false;
      }
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
    if (!editButton || !desktopMediaQuery.matches) return;

    event.preventDefault();
    const data = parseEditorData(editButton);
    if (data) createCartEditor(data, editButton);
  });
})();
