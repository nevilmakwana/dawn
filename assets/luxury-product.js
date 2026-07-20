/* Luxury Product JS */

class LuxuryProduct {
  constructor() {
    this.initAccordions();
    this.initVariantSelectors();
    this.initGallerySwiper();
  }

  initGallerySwiper() {
    if (typeof Swiper === 'undefined') return;
    
    // Only init on mobile. On desktop (>=768px), CSS grid takes over
    // and we destroy the swiper to let it stack naturally.
    const swiperEl = document.getElementById('ProductGallerySwiper');
    if (!swiperEl) return;

    let gallerySwiper;

    const initSwiper = () => {
      if (window.innerWidth < 768 && !gallerySwiper) {
        gallerySwiper = new Swiper(swiperEl, {
          slidesPerView: 1,
          pagination: {
            el: '.swiper-pagination',
            clickable: true
          }
        });
      } else if (window.innerWidth >= 768 && gallerySwiper) {
        gallerySwiper.destroy(true, true);
        gallerySwiper = undefined;
      }
    };

    initSwiper();
    window.addEventListener('resize', initSwiper);
  }

  initAccordions() {
    const accordions = document.querySelectorAll('.accordion-header');
    
    accordions.forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.accordion-item');
        const isOpen = item.classList.contains('is-open');
        
        // Close all other accordions
        document.querySelectorAll('.accordion-item').forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('is-open');
          }
        });
        
        // Toggle current accordion
        if (isOpen) {
          item.classList.remove('is-open');
        } else {
          item.classList.add('is-open');
        }
      });
    });
  }

  initVariantSelectors() {
    const variantInputs = document.querySelectorAll('.variant-selector input[type="radio"]');
    if (!variantInputs.length) return;
    
    // In a real Shopify theme, this would update the hidden master select, 
    // update the URL, update the price, and handle availability.
    // For this minimalist build, we just ensure clicking updates the UI visually.
    variantInputs.forEach(input => {
      input.addEventListener('change', () => {
        const variantId = input.value;
        const masterSelect = document.querySelector('select[name="id"]');
        if (masterSelect) {
          masterSelect.value = variantId;
          // Trigger change event for any other listeners
          masterSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LuxuryProduct();
});
