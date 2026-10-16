# Code and security review

In October 2026, after the last roadmap feature was merged, the whole fork had a code and security
review: the app in `src/`, the codegen scripts in `codegen/`, and the build and the GitHub Actions
workflows. Each finding was checked by two separate verifiers before anything was changed. This note
lists what was fixed, what was looked at and left as it is (and why), and what's still to do.

## Scope

The review looked at the code from five angles:

| Dimension | What it covered |
| --- | --- |
| Security | What a crafted save file could make the page do, what the site sends elsewhere, and secrets and tokens in the build and deploy. |
| Save integrity | Whether a save comes back out of the editor as the game expects, with nothing changed or lost that the user didn't change: export round trips, chests, backups, multiplayer saves. |
| Logic | Whether each page does what it says: state and reactivity, switching farmer, drag and drop, accessibility. |
| Codegen | The scripts that build `generated/` from the game's content and the wikis, and the licences of that data. |
| Build and CI | The SvelteKit/Vite build, the HTML of the deployed site, the dev server, and the workflows in `.github/workflows/`. |

## Fixed

All of these are in commit `2f99576` ("Fix issues from the code and security review"). Most come with
a test, and most of those tests fail on the old code.

### Security and privacy

| Finding | Fix |
| --- | --- |
| The appearance preview put the save's gender text straight into a CSS `url()`, so a crafted save could load an image from another site. | The gender is mapped to `female` or `male`. The CSP now has `img-src 'self' data: blob:`, which blocks images from other hosts. |
| A villager name from the save went unescaped into the portrait `url()`. | The name is encoded with `encodeURIComponent`. |
| The dev server's `fs.allow: [".."]` served any file in the folder that holds the clone. | Now `["."]`, the project itself. |
| `src/app.html` still had the upstream maintainer's Google Search Console verification tag. | Removed. |
| Server-side Sentry (`src/hooks.server.ts`) only ran at build time, as the site is prerendered, and froze one trace ID into every page. | Deleted; client-side Sentry is unchanged. |

### Save data

| Finding | Fix |
| --- | --- |
| Backups were never saved: the guard on the save effect was inverted. (Reported twice.) | The guard is flipped. Saving waits until stored backups have loaded, saves run one at a time in a single IndexedDB transaction (no duplicate rows), deleting a backup sticks, and a failure to open the database shows "Backups are disabled". |
| A new upload with the same file name as an older backup wasn't backed up, and a farm's save always keeps its name. | Only an identical copy is skipped. |
| Junimo Chests were editable, but the game shows the team's shared inventory in them, so items moved in were lost. | `discoverChests` leaves out Junimo Chests and any chest with a global inventory ID. |
| Text that looks like a number ("007", "0x1F", "1e3", say as a farm or animal name) was changed on export. | The parser keeps leading zeros, hex and exponents as written (`numberParseOptions`). See follow-ups for what this doesn't cover. |
| Switching farmer, or editing a bundle in another room, removed bought Joja projects and `ccIsComplete`. | Joja membership is read from the host. Side effects only run for rooms whose completion changed (and finished rooms when membership changes), and the whole-Community-Center flags only change when overall completion does. |
| Dragging an item created in the editor to another backpack slot disposed it, so later edits to it weren't saved. | `Inventory.swap()` swaps the slots without disposing either item. |
| The Character page's wallet kept editing the first farmer after switching. | The wallet reads the selected farmer's mail. |
| Changing an item's quality multiplied its saved price and edibility, and the game applies quality again on top. | Setting quality only sets quality. The price isn't reset to the base price either, which would overwrite artisan goods' prices. |
| Ticking Bottomless on a watering can left the `IsBottomless` element, which the game reads last, unchanged. | Both elements are written. |

### Interface

| Finding | Fix |
| --- | --- |
| Clicking a Qi quest's name or description accepted or cancelled it: the row was a `<label>` whose first control was that button. | The row is a `<div>`, and the checkbox is named after the quest. |
| Typing friendship points re-sorted the Relationships list and dropped focus. | The list only re-sorts when villagers are added or the farmer changes. |
| A corrupt compressed save left the upload page stuck on "Uploading...". | The error shows in a toast and the upload button works again. |
| Item slots had no accessible name. | Each slot is labelled with its item (chest slots and the item editor's large icon too). |
| Community Center item checkboxes had no label. | Labelled "&lt;item&gt; donated", or with the gold amount. |
| Toasts weren't announced by screen readers. | The toast area is a polite live region (`role="status"`). |

### Build and deployed site

| Finding | Fix |
| --- | --- |
| The favicon and `og:image` were only added after the page's JavaScript ran, so link previews and the first favicon request missed them. Every page also carried seven conflicting canonical links, one for each of seven different pages. | Both are in `src/app.html`, and the canonical links are gone. |

### Docs and data

| Finding | Fix |
| --- | --- |
| Sandy's description had lost its price: the wiki parser dropped `{{Price\|N}}`. | It becomes "N,NNNg"; `npm run dump:villagers` was re-run and only Sandy's line changed. |
| Nothing said which licences cover the wiki text in `villagers.json` and `events.json`. | LICENSE.md has a third-party data note, the README's Legal section mentions it, and the in-app credits link the licences. |
| CONTRIBUTING listed loved gifts under `dump:villagers`, missed `dump:events` and the format step, had an old Node.js version and the wrong path for the workers. | Corrected: three scripts, `npm run format` after a dump, Node.js 20.19+, 22.12+ or 24+, and `src/lib/workers`. |

The comment on `toEventId` in `src/lib/proxies/EventsSeen.svelte.ts` was corrected too: its "01" and
"1e3" examples no longer matched the parser.

## Not fixed

| Finding | Why |
| --- | --- |
| The `tests` and `quality` checks aren't required before merging. | A GitHub ruleset setting, not something a commit can change. See follow-ups. |
| Completed or failed Qi orders show "In Progress" with a Cancel button that does nothing. (The verifiers split: both found the bug real, but one judged the proposed fix harmful.) | The proposed fix, counting only in-progress orders as taken, would let "Make Active" add a second order with the same key next to the unclaimed one, and let the board offer it again. As far as the verifiers recall (it wasn't checked against the game's code), the game never offers a quest that's already in the save's orders. Nothing is corrupted today, so it's low severity. See follow-ups. |

### Examined and judged not a problem

| Finding | Why it was left |
| --- | --- |
| Sentry Session Replay sends unmasked page text (farmer, farm and file names). | Sentry is off unless the site operator sets a DSN at build time, and the data goes to the operator's own project. It's in-game text (typed input stays masked), and masking replays wouldn't stop the same names reaching Sentry in breadcrumbs. |
| `SENTRY_AUTH_TOKEN` is set for the whole deploy job, so `npm ci` install scripts can read it. | Limiting it to the build step wouldn't keep it from a malicious install script, which can plant code that runs during the build. The job already holds stronger tokens, and only runs on pushes to `main`. |
| Items can be dragged into a Mill's Input chest, which the game gives no way to empty. | Nothing is lost: the item stays listed and can be dragged out again. The item editor could already put any item there, and blocking the chest would also block loading Wheat, Beets or Unmilled Rice. |
| Item previews create `$effect.root`s that are never disposed. | Svelte frees them with the component. In a production build every one was collected after unmount; they only build up while one item search is open. |
| The Price field allows up to 2,147,483,647, but the proxy caps price at 99,999. | The field shows 99999 straight away, so the cap isn't silent and the save stays valid. A `max` of 99999 would instead revert an over-long entry to the previous keystroke's value. |
| The Pages workflow pins deprecated action versions (Node.js 20, `set-output`). | Only warnings: the deploy succeeds, and nothing reads the step outputs. The proposed bump would still use Node.js 20 actions; the full bump is routine upkeep (see follow-ups). |
| Part of the licence finding: link each wiki page the data came from. | LICENSE.md credits each wiki and links its licence, which is enough. |

## Follow-ups

- **Required checks (repository owner):** add `tests` and `quality` as required status checks to the
  `01-default-branch-protection` ruleset in the repository settings.
- **Qi orders:** keep a Complete or Failed order's key blocked, but show its state ("Complete" or
  "Failed") instead of "In Progress", and only offer Cancel for one that's in progress.
- **Number-like text:** "1.50" and "+7" still change on export, and a name that's only digits, such
  as "7", still loads as a number, so the duplicate animal name check on the Buildings page misses it.
- **Action versions:** move the workflows to the Node.js 24 majors (`actions/checkout` and
  `actions/setup-node` v5 or later, `configure-pages` v6, `deploy-pages` v5 and
  `upload-pages-artifact` v5).
- **Optional:** an `engines` field in `package.json`; a hint when a typed price is capped at 99999;
  a warning before dropping something into a Mill's Input chest; scoping `SENTRY_AUTH_TOKEN` to the
  build step as tidying.
