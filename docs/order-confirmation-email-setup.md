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
