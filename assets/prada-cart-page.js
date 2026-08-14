(() => {
  if (window.pradaShoppingBagBound) return;
  window.pradaShoppingBagBound = true;

  const desktopMediaQuery = window.matchMedia('(min-width: 990px)');
  const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopAccordionAnimations = new WeakMap();

  const stopDesktopAccordionAnimation = (disclosure) => {
    const animation = desktopAccordionAnimations.get(disclosure);
    if (!animation) return;

    desktopAccordionAnimations.delete(disclosure);
    animation.cancel();
  };

  const finishDesktopAccordionClose = (disclosure, content) => {
    desktopAccordionAnimations.delete(disclosure);
    disclosure.open = false;
    disclosure.classList.remove('is-closing');
    content.style.height = '';
    content.style.opacity = '';
  };

  const closeDesktopDisclosure = (disclosure) => {
    const content = disclosure.querySelector('.prada-shopping-bag-footer__desktop-disclosure-content');
    if (!content || (!disclosure.open && !disclosure.classList.contains('is-open'))) return;

    const startHeight = content.getBoundingClientRect().height;
    const startOpacity = Number.parseFloat(window.getComputedStyle(content).opacity) || 1;
    stopDesktopAccordionAnimation(disclosure);

    disclosure.open = true;
    disclosure.classList.remove('is-open');
    disclosure.classList.add('is-closing');
    disclosure.querySelector('summary')?.setAttribute('aria-expanded', 'false');
    content.style.height = `${startHeight}px`;
    content.style.opacity = `${startOpacity}`;

    const animation = content.animate(
      [
        { height: `${startHeight}px`, opacity: startOpacity },
        { height: '0px', opacity: 0 },
      ],
      {
        duration: motionMediaQuery.matches ? 180 : 420,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      }
    );

    desktopAccordionAnimations.set(disclosure, animation);
    animation.addEventListener('finish', () => {
      if (desktopAccordionAnimations.get(disclosure) !== animation) return;
      finishDesktopAccordionClose(disclosure, content);
    });
  };

  const openDesktopDisclosure = (disclosure) => {
    const content = disclosure.querySelector('.prada-shopping-bag-footer__desktop-disclosure-content');
    if (!content) return;

    const startHeight = disclosure.open ? content.getBoundingClientRect().height : 0;
    const startOpacity = disclosure.open
      ? Number.parseFloat(window.getComputedStyle(content).opacity) || 0
      : 0;
    stopDesktopAccordionAnimation(disclosure);

    disclosure.open = true;
    disclosure.classList.remove('is-closing');
    disclosure.classList.add('is-open');
    disclosure.querySelector('summary')?.setAttribute('aria-expanded', 'true');
    content.style.height = `${startHeight}px`;
    content.style.opacity = `${startOpacity}`;

    const targetHeight = content.scrollHeight;
    const animation = content.animate(
      [
        { height: `${startHeight}px`, opacity: startOpacity },
        { height: `${targetHeight}px`, opacity: 1 },
      ],
      {
        duration: motionMediaQuery.matches ? 180 : 420,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      }
    );

    desktopAccordionAnimations.set(disclosure, animation);
    animation.addEventListener('finish', () => {
      if (desktopAccordionAnimations.get(disclosure) !== animation) return;

      desktopAccordionAnimations.delete(disclosure);
      content.style.height = 'auto';
      content.style.opacity = '1';
    });
  };

  const bindDesktopAccordion = (root = document) => {
    root.querySelectorAll('.prada-shopping-bag-footer__desktop-info').forEach((disclosureGroup) => {
      disclosureGroup.querySelectorAll('.prada-shopping-bag-footer__desktop-disclosure').forEach((disclosure) => {
        const summary = disclosure.querySelector('summary');
        const content = disclosure.querySelector('.prada-shopping-bag-footer__desktop-disclosure-content');
        if (!summary || !content) return;

        disclosure.classList.toggle('is-open', disclosure.open);
        summary.setAttribute('aria-expanded', disclosure.open ? 'true' : 'false');
        content.style.height = disclosure.open ? 'auto' : '';
        content.style.opacity = disclosure.open ? '1' : '';
      });
    });
  };

  bindDesktopAccordion();
  document.addEventListener('shopify:section:load', (event) => bindDesktopAccordion(event.target));

  document.addEventListener('click', (event) => {
    const summary = event.target.closest('.prada-shopping-bag-footer__desktop-disclosure > summary');
    if (!summary) return;

    event.preventDefault();
    const disclosure = summary.parentElement;
    const disclosureGroup = disclosure.closest('.prada-shopping-bag-footer__desktop-info');
    if (!disclosureGroup) return;

    if (disclosure.classList.contains('is-open')) {
      closeDesktopDisclosure(disclosure);
      return;
    }

    disclosureGroup.querySelectorAll('.prada-shopping-bag-footer__desktop-disclosure').forEach((otherDisclosure) => {
      if (otherDisclosure !== disclosure) closeDesktopDisclosure(otherDisclosure);
    });
    openDesktopDisclosure(disclosure);
  });

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
          <div class="prada-cart-edit-modal__gallery-track" data-prada-cart-editor-gallery></div>
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
            <div class="prada-cart-edit-modal__description" hidden>
              <div class="prada-cart-edit-modal__description-inner"></div>
            </div>
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
    const galleryTrack = modal.querySelector('[data-prada-cart-editor-gallery]');
    const dots = modal.querySelector('.prada-cart-edit-modal__dots');
    const previousButton = modal.querySelector('.prada-cart-edit-modal__gallery-arrow--previous');
    const nextButton = modal.querySelector('.prada-cart-edit-modal__gallery-arrow--next');
    const optionsContainer = modal.querySelector('.prada-cart-edit-modal__options');
    const price = modal.querySelector('.prada-cart-edit-modal__price');
    const status = modal.querySelector('.prada-cart-edit-modal__status');
    const confirmButton = modal.querySelector('.prada-cart-edit-modal__confirm');
    const detailsButton = modal.querySelector('.prada-cart-edit-modal__details');
    const description = modal.querySelector('.prada-cart-edit-modal__description');
    const descriptionInner = modal.querySelector('.prada-cart-edit-modal__description-inner');
    const actions = modal.querySelector('.prada-cart-edit-modal__actions');
    let gallerySignature = '';
    let galleryScrollFrame = null;
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

    const updateGalleryDots = (galleryImages) => {
      dots.innerHTML = galleryImages.length > 1
        ? galleryImages.map((_, index) => `<span class="${index === activeImageIndex ? 'is-active' : ''}"></span>`).join('')
        : '';
    };

    const scrollGalleryToActiveImage = (behavior = 'smooth') => {
      const slide = galleryTrack.children[activeImageIndex];
      if (!slide) return;
      galleryTrack.scrollTo({
        left: slide.offsetLeft,
        behavior: motionMediaQuery.matches ? 'auto' : behavior,
      });
    };

    const renderGallery = ({ scroll = true } = {}) => {
      const galleryImages = getGalleryImages();
      if (activeImageIndex >= galleryImages.length) activeImageIndex = 0;
      const nextSignature = galleryImages.map((galleryImage) => galleryImage.src).join('|');
      const galleryWasRebuilt = gallerySignature !== nextSignature;

      if (galleryWasRebuilt) {
        gallerySignature = nextSignature;
        galleryTrack.replaceChildren(...galleryImages.map((galleryImage) => {
          const image = document.createElement('img');
          image.className = 'prada-cart-edit-modal__image';
          image.src = galleryImage.src;
          image.alt = galleryImage.alt || data.title;
          image.loading = 'eager';
          image.draggable = false;
          return image;
        }));
      }

      previousButton.hidden = nextButton.hidden = galleryImages.length < 2;
      updateGalleryDots(galleryImages);

      if (scroll) {
        window.requestAnimationFrame(() => scrollGalleryToActiveImage(galleryWasRebuilt ? 'auto' : 'smooth'));
      }
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
      let hasColorOption = false;

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
          hasColorOption = true;
          row.classList.add('prada-cart-edit-modal__option-row--color');
          row.innerHTML = `
            <div class="prada-cart-edit-modal__color-heading">
              <span class="prada-cart-edit-modal__option-label">${escapeHtml(option.name)}:</span>
              <span>${escapeHtml(selectedOptions[optionIndex] || option.values[0] || '')}</span>
            </div>
            <div class="prada-cart-edit-modal__color-values"></div>`;
          const values = row.querySelector('.prada-cart-edit-modal__color-values');
          option.values.forEach((value) => {
            const matchingVariant = variants.find((variant) =>
              variant.options[optionIndex] === value &&
              productOptions.every((_, index) =>
                index === optionIndex || !selectedOptions[index] || variant.options[index] === selectedOptions[index]
              )
            ) || variants.find((variant) => variant.options[optionIndex] === value);
            const thumbnailSrc = matchingVariant?.image || images[0]?.src || data.image || '';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'prada-cart-edit-modal__color-value';
            button.dataset.optionIndex = optionIndex;
            button.dataset.optionValue = value;
            button.setAttribute('aria-label', `${option.name}: ${value}`);
            button.setAttribute('aria-pressed', String(selectedOptions[optionIndex] === value));
            button.innerHTML = thumbnailSrc
              ? `<img class="prada-cart-edit-modal__color-thumbnail" src="${escapeHtml(thumbnailSrc)}" alt="">`
              : `<span class="prada-cart-edit-modal__swatch" style="background:${colorSwatch(value)}"></span>`;
            values.append(button);
          });
        } else {
          row.innerHTML = `<label class="prada-cart-edit-modal__select-label">${escapeHtml(option.name)}:<select class="prada-cart-edit-modal__select" data-option-index="${optionIndex}">${option.values.map((value) => `<option value="${escapeHtml(value)}" ${selectedOptions[optionIndex] === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>`;
        }
        optionsContainer.append(row);
      });

      if (!hasColorOption) {
        const colorRow = document.createElement('div');
        colorRow.className = 'prada-cart-edit-modal__option-row prada-cart-edit-modal__option-row--color';
        colorRow.innerHTML = `
          <div class="prada-cart-edit-modal__color-heading">
            <span class="prada-cart-edit-modal__option-label">Color:</span>
            <span>As shown</span>
          </div>
          <div class="prada-cart-edit-modal__color-values">
            <span class="prada-cart-edit-modal__color-value" aria-label="Color as shown">
              ${images[0]?.src || data.image ? `<img class="prada-cart-edit-modal__color-thumbnail" src="${escapeHtml(images[0]?.src || data.image)}" alt="${escapeHtml(data.title)}">` : '<span class="prada-cart-edit-modal__swatch"></span>'}
            </span>
          </div>`;
        optionsContainer.append(colorRow);
      }

      const quantityRow = document.createElement('div');
      quantityRow.className = 'prada-cart-edit-modal__quantity-row';
      quantityRow.innerHTML = `
        <span>Quantity:</span>
        <div class="prada-cart-edit-modal__stepper">
          <button type="button" data-prada-editor-quantity="decrease" aria-label="Decrease quantity" ${selectedQuantity <= 1 ? 'disabled' : ''}><span class="prada-cart-edit-modal__stepper-icon prada-cart-edit-modal__stepper-icon--minus" aria-hidden="true"></span></button>
          <output>${selectedQuantity}</output>
          <button type="button" data-prada-editor-quantity="increase" aria-label="Increase quantity"><span class="prada-cart-edit-modal__stepper-icon prada-cart-edit-modal__stepper-icon--plus" aria-hidden="true"></span></button>
        </div>`;
      optionsContainer.append(quantityRow);
      renderGallery();
    };

    const close = () => {
      stopDetailsRevealScroll();
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
        updateGalleryDots(galleryImages);
        scrollGalleryToActiveImage();
        return;
      }

      if (event.target.closest('.prada-cart-edit-modal__gallery-arrow--next')) {
        const galleryImages = getGalleryImages();
        activeImageIndex = (activeImageIndex + 1) % galleryImages.length;
        updateGalleryDots(galleryImages);
        scrollGalleryToActiveImage();
      }
    });

    modal.addEventListener('change', (event) => {
      const select = event.target.closest('.prada-cart-edit-modal__select');
      if (!select) return;
      selectedOptions[Number(select.dataset.optionIndex)] = select.value;
      activeImageIndex = 0;
      renderOptions();
    });

    galleryTrack.addEventListener('scroll', () => {
      if (galleryScrollFrame) window.cancelAnimationFrame(galleryScrollFrame);
      galleryScrollFrame = window.requestAnimationFrame(() => {
        galleryScrollFrame = null;
        const slides = [...galleryTrack.children];
        if (!slides.length) return;

        const nearestIndex = slides.reduce((nearest, slide, index) =>
          Math.abs(slide.offsetLeft - galleryTrack.scrollLeft) <
          Math.abs(slides[nearest].offsetLeft - galleryTrack.scrollLeft)
            ? index
            : nearest, 0);
        if (nearestIndex === activeImageIndex) return;
        activeImageIndex = nearestIndex;
        updateGalleryDots(getGalleryImages());
      });
    }, { passive: true });

    galleryTrack.addEventListener('scrollend', () => {
      const galleryImages = getGalleryImages();
      updateGalleryDots(galleryImages);
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

    let detailsAnimationToken = 0;
    let detailsCloseTimer = null;
    let detailsScrollFrame = null;
    let detailsPanelAnimation = null;

    const stopDetailsRevealScroll = () => {
      if (!detailsScrollFrame) return;
      window.cancelAnimationFrame(detailsScrollFrame);
      detailsScrollFrame = null;
    };

    const startDetailsRevealScroll = () => {
      stopDetailsRevealScroll();
      if (desktopMediaQuery.matches) return;

      const startedAt = performance.now();
      const revealDuration = motionMediaQuery.matches ? 0 : 460;

      const keepRevealVisible = (now) => {
        if (detailsButton.getAttribute('aria-expanded') !== 'true') {
          detailsScrollFrame = null;
          return;
        }

        const actionsTop = actions.getBoundingClientRect().top;
        const detailsBottom = detailsButton.getBoundingClientRect().bottom;
        const overflow = detailsBottom - (actionsTop - 18);

        if (overflow > 0.5) {
          modal.scrollTop += motionMediaQuery.matches ? overflow : Math.max(1, overflow * 0.28);
        }

        if (now - startedAt < revealDuration) {
          detailsScrollFrame = window.requestAnimationFrame(keepRevealVisible);
          return;
        }

        const remainingOverflow = detailsButton.getBoundingClientRect().bottom - (actions.getBoundingClientRect().top - 18);
        if (remainingOverflow > 0) modal.scrollTop += remainingOverflow;
        detailsScrollFrame = null;
      };

      detailsScrollFrame = window.requestAnimationFrame(keepRevealVisible);
    };

    const setDetailsOpen = (shouldOpen) => {
      detailsAnimationToken += 1;
      const animationToken = detailsAnimationToken;

      window.clearTimeout(detailsCloseTimer);

      detailsButton.setAttribute('aria-expanded', String(shouldOpen));
      detailsButton.textContent = shouldOpen ? 'Hide details' : 'Show details';

      detailsPanelAnimation?.cancel();
      detailsPanelAnimation = null;

      if (motionMediaQuery.matches) {
        description.hidden = !shouldOpen;
        description.classList.toggle('is-open', shouldOpen);
        if (shouldOpen) startDetailsRevealScroll();
        return;
      }

      if (shouldOpen) {
        description.hidden = false;
        description.style.height = '0px';
        description.style.opacity = '0';
        description.style.transform = 'translateY(-8px)';
        description.getBoundingClientRect();
        description.classList.add('is-open');
        const targetHeight = description.scrollHeight;
        detailsPanelAnimation = description.animate(
          [
            { height: '0px', opacity: 0, transform: 'translateY(-8px)' },
            { height: `${targetHeight}px`, opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
        detailsPanelAnimation.addEventListener('finish', () => {
          if (detailsAnimationToken !== animationToken) return;
          description.style.height = 'auto';
          description.style.opacity = '1';
          description.style.transform = 'none';
          detailsPanelAnimation = null;
        });
        startDetailsRevealScroll();
        return;
      }

      stopDetailsRevealScroll();
      const startHeight = description.scrollHeight;
      description.style.height = `${startHeight}px`;
      description.style.opacity = '1';
      description.style.transform = 'none';
      detailsPanelAnimation = description.animate(
        [
          { height: `${startHeight}px`, opacity: 1, transform: 'translateY(0)' },
          { height: '0px', opacity: 0, transform: 'translateY(-8px)' },
        ],
        { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );

      const finishClose = () => {
        if (detailsAnimationToken !== animationToken || detailsButton.getAttribute('aria-expanded') !== 'false') return;
        detailsPanelAnimation = null;
        description.classList.remove('is-open');
        description.hidden = true;
        description.style.height = '';
        description.style.opacity = '';
        description.style.transform = '';
      };

      detailsPanelAnimation.addEventListener('finish', finishClose);
      detailsCloseTimer = window.setTimeout(() => {
        detailsPanelAnimation?.finish();
      }, 460);
    };

    detailsButton.addEventListener('click', () => {
      const isOpen = detailsButton.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        setDetailsOpen(false);
        return;
      }

      descriptionInner.innerHTML = data.description || '<p>Product details are not available for this item.</p>';
      setDetailsOpen(true);
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
