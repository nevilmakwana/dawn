# Variant media and collection management

The product page supports independent media galleries and collection references for every product variant. The data lives on the variant, so newly created variants automatically receive the same fields without theme changes.

## One-time Shopify Admin setup

In **Settings > Custom data > Variants**, create and pin these definitions:

| Name | Namespace and key | Type | Validation |
| --- | --- | --- | --- |
| Variant images | `custom.variant_images` | Files (list) | Images only |
| Linked collections | `custom.linked_collections` | Collections (list) | None |

Pin both definitions so they are visible while editing a variant. Then open a product, select a variant, and manage its images and linked collections in the variant metafields section.

The storefront also supports Shopify's auto-generated `custom.custom_variant_images` key for backward compatibility. New definitions should still use the canonical `custom.variant_images` key.

## Storefront behavior

- When `custom.variant_images` has images, the selected variant gets its own gallery in the saved order.
- When it is empty, the standard product gallery remains available and the native Shopify variant featured image is used when one exists.
- Product title and description stay product-level and are shared by all variants.
- `custom.linked_collections` is variant metadata. Shopify collection membership remains product-level; selecting a linked collection does not add or remove the parent product from that collection.

The metafield keys are the stable contract for a future Admin UI extension. An app can provide a richer picker later without migrating any existing variant data or changing the storefront theme.
