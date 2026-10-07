# Grey Exim order confirmation email

## Install

1. In Shopify Admin, open **Settings > Notifications > Customer notifications > Order confirmation**.
2. Confirm the sender email address if Shopify asks you to do so.
3. Open **Edit code** and keep a backup of the existing Email body.
4. Replace the Email body with the complete contents of `docs/order-confirmation-email.liquid`.
5. Set the Email subject to:

   `Order {{ order_name }} confirmed`

6. Use **Preview**, then **Send test email**, before clicking **Save**.

## Recommended checks

- Test one prepaid order and one Cash on Delivery order.
- Test an order with a discount, shipping charge, and multiple products.
- Check Gmail and iPhone Mail at desktop and mobile widths.
- Confirm that each variant has its matching native Shopify variant image. Notification thumbnails use Shopify line-item media and cannot use the theme's custom variant gallery.

The template keeps Shopify's current order, delivery, payment, tax, refund, bundle, and gift-card Liquid logic. The changes are limited to customer-facing copy and email-safe presentation styles.

## Brand assets

The template uses the neutral-grey Grey Exim wordmark from `assets/grey-exim-logo-grey-wordmark.png`. The same single logo works on light and dark email backgrounds, so a second dark-mode logo is not required. Its campaign area dynamically reuses the first ordered product's Shopify line-item image, so the visual stays relevant and owned by Grey Exim.

The footer intentionally uses one row of neutral-grey social icons instead of separate black and white icon images. Gmail and some Outlook clients can ignore `display: none` in dark mode and show both icon variants; one mid-grey icon per network avoids duplicate or invisible social icons while preserving every profile link.

Shopify notification templates are managed separately from theme files. After deploying the logo asset, paste this template in **Settings > Notifications > Customer notifications > Order confirmation**. For Shopify's other default notifications, select the same grey wordmark once in **Settings > Notifications > Customize email templates** so templates that use `shop.email_logo_url` inherit it globally.
