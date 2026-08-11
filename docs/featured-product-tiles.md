# Featured product tiles

Create these product metafield definitions in Shopify Admin under **Settings > Custom data > Products**:

| Name | Namespace and key | Type |
| --- | --- | --- |
| Show as featured tile | `custom.featured_tile` | True or false |
| Featured tile image | `custom.featured_tile_image` | File (image) |
| Featured tile mobile image | `custom.featured_tile_mobile_image` | File (image) |
| Featured tile position | `custom.featured_tile_position` | Integer |
| Featured tile size | `custom.featured_tile_size` | Single-line text |

Allowed size values are `normal`, `wide`, `large`, and `full`. The default is `wide`.

Enter the friendly label in **Name**, then explicitly set **Namespace and key** to the value shown above. If Shopify generated keys such as `custom.custom_featured_tile`, the theme also supports that format for backward compatibility.

When editing or creating a product, enable **Show as featured tile**, upload the editorial images, choose its page position, and enter a size. The product must belong to the collection being viewed. A featured tile replaces that product's standard card. On mobile, every featured tile spans both product columns; the optional mobile image is used when supplied.
