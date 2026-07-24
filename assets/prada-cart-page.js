(() => {
  if (window.pradaShoppingBagBound) return;
  window.pradaShoppingBagBound = true;

  const openSecurePayments = (root = document) => {
    const securePayments = root.querySelector('.prada-shopping-bag-footer__desktop-disclosure');
    if (securePayments && !securePayments.open) securePayments.open = true;
  };

  openSecurePayments();
  document.addEventListener('shopify:section:load', (event) => openSecurePayments(event.target));

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
