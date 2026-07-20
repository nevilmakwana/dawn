/* Luxury Cart JS */

class LuxuryCart {
  constructor() {
    this.drawer = document.getElementById('CartDrawer');
    this.overlay = document.getElementById('CartOverlay');
    if (!this.drawer || !this.overlay) return;

    this.triggers = document.querySelectorAll('.js-cart-trigger');
    this.closeBtns = document.querySelectorAll('.js-cart-close');
    
    this.init();
  }

  init() {
    this.triggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    });

    this.closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.close();
      });
    });

    this.overlay.addEventListener('click', () => {
      this.close();
    });

    // Handle AJAX Add To Cart globally (simplistic version for the demo)
    document.addEventListener('submit', (e) => {
      if (e.target.matches('.product-form')) {
        e.preventDefault();
        // In a real build, we'd fetch('/cart/add.js') here.
        // For the demo, we simulate success and open the cart.
        const btn = e.target.querySelector('button[type="submit"]');
        if(btn) {
          const originalText = btn.innerHTML;
          btn.innerHTML = 'Adding...';
          setTimeout(() => {
            btn.innerHTML = originalText;
            this.open();
          }, 500);
        }
      }
    });
  }

  open() {
    this.drawer.classList.add('is-active');
    this.overlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.drawer.classList.remove('is-active');
    this.overlay.classList.remove('is-active');
    document.body.style.overflow = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.LuxuryCart = new LuxuryCart();
});
