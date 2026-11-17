# Reader artwork

`benefits-orbit.png` is the original artwork generated with the built-in image_gen tool for this project. `benefits-orbit.webp` is the 720px, quality-80 delivery copy (about 8 KB). Both editions embed the same image; the extension popup loads its packaged copy. No remote image request is needed.

Generate the delivery copy with:

```sh
node --input-type=module -e 'import sharp from "sharp"; await sharp("extension/assets/benefits-orbit.png").resize({width:720}).webp({quality:80}).toFile("extension/assets/benefits-orbit.webp")'
```

Generation prompt:

> Use case: stylized-concept. Asset type: original decorative artwork for the Perks Reminder credit-card benefits browser extension, used as a small wide header illustration. Create a refined tactile 3D still life: two softly rounded blank payment cards in deep midnight navy and pale mint, a small warm gold coin-like disc with a simple four-point sparkle engraved, and a translucent mint orbit ribbon suggesting refresh. Clean sophisticated editorial product illustration, matte ceramic and frosted glass, soft studio shadows, quiet warm ivory background. Wide landscape composition, objects grouped at center, generous breathing room. Palette consistent with existing UI: #172033 navy, #8fe3c1 mint, #ffcf70 gold, ivory. No typography, no letters, no numbers, no bank logo, no American Express mark, no watermarks. Artwork only, not a screenshot or UI mockup.
