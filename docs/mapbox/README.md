# MoveNotes Outdoors Cool

## Current version: Cool 2

Import **`movenotes-outdoors-cool-v2.json`** for the stronger separation from the
warm Journal. The previous `movenotes-outdoors-cool.json` is retained for comparison.
Cool 2 uses `#F7FAFC` land, `#EEF4F7` residential surfaces, `#CDDDC8` parks,
`#B2C9AF` forests and `#BFCFD5` street outlines. Agricultural and other land-use
overlays also shift away from beige; this is not just a background-layer change.
Vegetation colour alpha increases slightly while existing layer opacity/zoom
rules, sources, fonts, filters, geometry and all 148 layers are preserved.

Publish the imported file and set `VITE_MAPBOX_STYLE` to its new style ID. Using
the new ID makes it unambiguous that the app is requesting Cool 2 rather than
the previously published style. Restart/rebuild the frontend after changing the
environment variable. The JSON does not publish itself or change the app's style ID.

The runtime route remains `#E48A6C`, width 4, opacity 0.98. Container proportions,
rounded corners, delicate border and interactions are unchanged; the shadow
increases only from 1px/4px at 5% ink to 1px/5px at 6.5% ink. Visual separation
comes primarily from the cooler basemap. The map surface theme token now matches
`#F7FAFC`. No route processing, loading or attribution changes are included.

Cool 2 checks passed: JSON/structural validation, production build, seven focused
route/map tests and 29 browser assertions. Browser previews use fictional map
imagery to verify the frame and interactions; preview the actual basemap in
Studio after importing the JSON. No deployment or Supabase changes were made.

## Previous version

Import `movenotes-outdoors-cool.json` into Mapbox Studio and publish it. Then set
`VITE_MAPBOX_STYLE=your-username/your-published-style-id` in the intended frontend
environment and restart/rebuild the app. Saving this JSON alone does not change
the hosted basemap. The previous Downloads style file is unchanged.

This is a classic Outdoors style compatible with the current Static Images API.
It retains all 148 layers, source definitions, sprites, fonts, filters, layer
ordering, geometry-related settings, zoom rules and existing visibility choices.
Account/export bookkeeping is omitted so Studio can assign the imported style
its own identity.

Main palette:

| Element | Colour |
| --- | --- |
| Land/background | `#F2F5F3` |
| Parks | `#D7E3D5` |
| Forests | `#BED1B8` |
| Water | `#C4DBDF` |
| Road surfaces | `#FFFFFF` |
| Road outlines | `#C9D2CC` |
| Contours | `#ADB9AE` |
| Main labels | `#53665A` |
| Secondary labels | `#798A7E` |

The basemap JSON does not contain individual activity routes. MoveNotes applies
those per request: existing coral `#E48A6C`, width 4, opacity increased from 0.9
to 0.98. Preview and expanded map frames use the existing rounded corners, a
15%-opacity primary-colour border and a subtle 1px/4px shadow. Sizes, route
processing, lazy loading, caching, attribution and interactions are unchanged.

Checked: JSON parsing and structural invariants, production build, seven focused
route/map tests and 29 browser assertions across mobile/desktop and enlarged
text. Browser images are clearly labelled fictional fixtures; the actual hosted
basemap appearance still needs previewing in Studio after import. No Supabase
changes or deployment were performed for this visual refinement.
