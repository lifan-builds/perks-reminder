# Perks Reminder — English walkthrough with Jessica

Latest deliverable: `output/perks-reminder-walkthrough-en-v3.mp4`

60 seconds · 1920×1080 · 30 fps · English female narration.

The tour covers adding cards, benefit overview/search, partial use and completion, card deadlines, benefit guides, the Amex reader and sync preview, and annual-fee ROI. All account examples are synthetic. Old Chinese renders and the initial English render remain preserved.

## Editable files

- `src/Walkthrough.tsx` — framing, camera moves, cursor, titles and scene composition
- `src/ProductSurface.tsx` — renders current product markup at final resolution
- `src/walkthrough-en.json` — scene timing, captions and speech pause edits
- `src/product-ui/` — ten static UI states and actual application styles
- `src/reader-panel.json` — actual Amex reader DOM from a synthetic fixture
- `narration-en.txt` — original spoken script
- `audio-source/narration-en-jessica-take-01.mp3` — untouched original female voice
- `output/captions-en.srt` and `output/captions-en.vtt` — English caption sidecars
- `brief-en.md` — reference videos, production choices, feature evidence and audio rights
- `qa/review-en.md` — validation and review limitations

## Render

From this directory:

```sh
npm ci --ignore-scripts
npm run check
node scripts/render-english.mjs prototype
node scripts/render-english.mjs stills
node scripts/render-english.mjs checks
node scripts/render-english.mjs
```

The render uses retained static UI states and media; it does not start the application or connect to its database. Actual component snapshots can optionally be regenerated with `node scripts/prepare-product-ui.mjs` when the owning project's dependencies are installed. That preparation reads current presentation sources, replaces server actions with throwing stubs and renders synthetic props. It never executes auth/database/provider loading. Both extracted presentation snippets and import paths are kept in `scripts/fixture/`.

## Audio

Jessica — Playful, Bright, Warm; ElevenLabs Eleven v4; stability 50%, similarity 75%, clone strength 0. Original 49.240813-second take retained. Speech is not sped up. Measured-silence pause edits add 5.8 seconds, with a 0.8-second start offset, and leave a short closing hold.

ElevenLabs — user's separate permission for free use on their open-source projects.

The instrumental bed is original synthesis without third-party samples (`scripts/music-english.py`). Mix is retained separately in `public/audio/mix-en-jessica.wav`. Machine transcription checked the full script, with brand names and ASR homophones corrected in captions. Naturalness has not been verified by human listening; the original female take was supplied inline to the user.

The demo includes the implemented Amex preview screen. It does not represent a production sync receipt or a claim that the store release is approved. The film and forum draft have not been published.
