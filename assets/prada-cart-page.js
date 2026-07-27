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
})();
