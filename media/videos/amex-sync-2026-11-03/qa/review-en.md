# English walkthrough review

## Scope

60-second English tour with the user-requested female voice, Jessica — Playful, Bright, Warm. Reuses current product components with synthetic fixtures. No live customer data, account writes, or publication.

## Corrections made during review

- Replaced the rejected Chinese slogan-led direction and male voice with restrained English copy and female narration.
- Rendered real application HTML/CSS at final resolution, avoiding enlarged raster screenshots.
- Fixed image paths and moved Tailwind property registration outside the shadow root so input/card borders match the product.
- Centered the partial-use modal within the product viewport and removed rendering-only autofocus side effects.
- Reframed the dining-credit action so the entered amount, progress bar and claimed state are all visible.
- Matched cursor endpoints to the actual search, add-card and amount controls.
- Reframed the calendar to include the annual-fee event, and the Amex preview to expose both card matches and their amounts.
- Corrected sample cycle dates: monthly dining ends Nov 30; semiannual Resy ends Dec 31.
- Preserved the claimed dining amount into the final ROI scene (claimed total $320, remaining $80, annual fees $1,220, net -$900). Illustrative sample values, not advertised customer savings.

## Checks

- Standalone `npm run check`: passed.
- Thirteen-second representative prototype rendered before the finished film.
- Full narration independently transcribed by local whisper.cpp; script present from opening to final free/open-source line. ASR homophones corrected in captions.
- Speech retained at original speed, silence edits inserted only within measured silence intervals. Source audio preserved.
- Representative frames and important action boundaries inspected, including final frame 1799.
- Export validator results are in `export-check-en-v3.json`: codec, dimensions, fps, frame count, complete decode, audio end and measured loudness.

## Review limit

The agent inspected rendered frames and automated audio/transcription measurements. No human listening or uninterrupted real-time playback is claimed. The user received the original Jessica take inline for listening. The automated export validator's perceptual-review field remains “not assessed”; this is separate from the frame review described above.
