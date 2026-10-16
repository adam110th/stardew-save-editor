# Contributing

This project is built in NodeJS, with [Svelte 5](https://svelte.dev/) and [SvelteKit](https://svelte.dev/docs/kit/introduction).

## Development

### Quick Start

Make sure to have [Node.js 20.19+, 22.12+ or 24+](https://nodejs.org/en/download/) installed (`.npmrc` sets `engine-strict`, so older versions fail `npm install`).

```bash
# Clone repository
git clone https://github.com/adam110th/stardew-save-editor.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### Updating Game Assets and Data

The editor's game data lives in `generated/` (JSON) and `static/assets/` (textures and portraits).
Both are committed, so the site builds without the game's files. Three scripts in `codegen/` rebuild
them; run `npm run format` after any of them.

#### From the game's files: `npm run dump`

Follow [these instructions from the SDV Wiki](https://stardewvalleywiki.com/Modding:Editing_XNB_files#Unpack_game_files) to unpack the game files. Put them in a `content` folder at the root of the project (eg. `content/Characters/Abigail.png`, `content/Data/Objects.json`). `content` is git-ignored: never commit it.

Then run `npm run dump`, then `npm run format`.

`npm run dump` (`codegen/dump.ts`) reads only the `content` folder; it doesn't go online. It empties
`static/assets`, then copies in the sprite sheets listed in `filesToCopy`, a portrait for each villager
in `src/lib/NPCs.ts`, and the building textures (into `static/assets/buildings`). If you need a
texture it doesn't copy, add it to `filesToCopy`. It writes everything in `generated/` except
`villagers.json` and `events.json`:

- `iteminfo.json`: every item, from `Data/Objects`, `Data/BigCraftables`, `Data/Boots`, `Data/hats`,
  `Data/Furniture`, `Data/Weapons`, `Data/Tools`, `Data/Shirts`, `Data/Pants`, `Data/Trinkets` and
  `Data/Mannequins`, plus the flavored artisan goods. Descriptions written as `[LocalizedText ...]`
  are looked up in `content/Strings` (`codegen/localizedText.ts`).
- `dimensions.json`: the size of each copied sprite sheet.
- `cookingrecipes.json` and `craftingrecipes.json`: from `Data/CookingRecipes` and
  `Data/CraftingRecipes`.
- `gifttastes.json`: each villager's loved gifts, worked out from `Data/NPCGiftTastes` with the game's
  own rules (`codegen/giftTastes.ts`). It prints any loved gift it can't match to an item.
- `qiquests.json`: Mr. Qi's special orders, from `Data/SpecialOrders` and
  `Strings/SpecialOrderStrings` (`codegen/specialOrderTokens.ts` fills in their text).
- `quests.json`: `Data/Quests`, parsed by `codegen/quests.ts` the way the game reads it
  (`Quest.getQuestFromId`), so completing a story quest in the editor can start the next one.
- `farmanimals.json`: each animal's house, and whether it can get pregnant (`CanGetPregnant`) or eat a
  Golden Animal Cracker (`CanEatGoldenCrackers`), from `Data/FarmAnimals`.
- `buildings.json`: each building's description, build cost (`codegen/buildingCost.ts`) and what the
  editor needs to upgrade it (its `buildingToUpgrade`, `validOccupantTypes`, doors, and the items the
  game adds or moves inside, from `codegen/buildingUpgrade.ts`), from `Data/Buildings`.

#### From the wikis: `npm run dump:villagers` and `npm run dump:events`

Some text isn't in the game's files, so it comes from the wikis. These two scripts need `curl` (it
ships with Windows 10+, macOS and Linux; the Stardew Valley Wiki turns away Node's own `fetch`) and an
internet connection, but not the `content` folder:

- `npm run dump:villagers` (`codegen/villagers.ts`) writes `generated/villagers.json`: a description of
  each villager in `src/lib/NPCs.ts`, from the [Stardew Valley Wiki](https://stardewvalleywiki.com).
  Loved gifts come from the game's data instead (`npm run dump`).
- `npm run dump:events` (`codegen/events.ts`) writes `generated/events.json`: each event's name,
  description, location and villagers, from the Stardew Modding Wiki's
  [List of Vanilla Event IDs](https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs).

That text keeps the wikis' licences, not this project's: `villagers.json` is
[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) and `events.json` is
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). LICENSE.md and the credits on the
Relationships and Events pages say so; keep them up to date if the sources change.

#### Written by hand

The festival dates and weather rules in `src/lib/calendar.ts` aren't generated: they're written from
`Data/Festivals/FestivalDates`, `Data/PassiveFestivals` and the game's weather code
(`Game1.getWeatherModificationsForDate`, `LocationWeather`, `Utility.isGreenRainDay`), so check them
when a game update changes festivals or weather.

### Reading the Save File

The save format is somewhat inconsistent (in structure and consistency). My recommendation is to use a website/tool to format the save file into something more readable, then use a text editor to search for the data you need. [Here is a tool for that](https://jsonformatter.org/xml-parser).

The types for the save's contents are in `codegen/save.ts` (imported as `$types/save`). No script
writes them, so update them by hand when you find a field they're missing.
`tests/TestSave` is a 1.6 save the tests load.

## Making Changes

If you want to make a contribution, just make a pull request.

### Code Style

This project uses BiomeJS for linting, and for formatting JS/TS files. Prettier is used for formatting markup files. You can run `npm run check` to check for linting errors, and `npm run format` to format the files.

### Checks

Before opening a pull request, run:

```bash
npm run format   # format the code
npm run check    # Biome lint and svelte-check
npm test         # the Vitest suite (the same as npx vitest run)
```

GitHub Actions checks every push and pull request: "Code quality"
(`.github/workflows/lint.yml`: `npm run format:check`, `npm run build` and `npm run check`) and "Run
Tests" (`.github/workflows/tests.yml`: `npm run test`). A push to `main` also builds the site and
deploys it to GitHub Pages (`.github/workflows/pages.yml`).

### Error Reporting

Sentry is off unless a DSN is set at build time (`VITE_SENTRY_DSN`; see `src/hooks.client.ts`). The
Pages workflow takes it from the repository variable `SENTRY_DSN`, and uploads source maps when
`SENTRY_ORG`, `SENTRY_PROJECT` and the secret `SENTRY_AUTH_TOKEN` are set too. When it's on, error
replays record the page's text unmasked (typed input stays masked), so they include names from the
uploaded save.

## General Conventions

The code is broken up into a few sections.

- `src/lib`: Contains the core code.
  - `src/lib/proxies`: Contains reactive proxy classes for interacting with save data.
  - `src/lib/ui`: Contains reusable Svelte components used throughout the app.
  - `src/lib/workers`: Contains web worker scripts for offloading heavy computations.
- `src/routes`: Contains routes & page components for the SvelteKit app.
- `codegen`: Contains code/asset generation scripts and utilities.
- `docs`: Notes on what each page edits ([menu-audit.md](docs/menu-audit.md)) and on the code and security review ([code-review.md](docs/code-review.md)).
- `generated`: Output from code generation scripts.
- `tests`: Contains unit and integration tests for the application.
- `static`: Contains static assets such as images, fonts, and other files served directly by the app.

### Proxies

The current model uses Svelte's reactivity system to create "wrappers" around existing save data. They serve 2 purposes:

1. Abstract away gross-or-weird requirements for interacting with the save data.
1. Provide reactivity, so that the Svelte app automatically updates when the underlying save data changes.

Proxies can contain getters and setters to sanitize/validate data before it is written to the save file. However, this should be limited to simple checks (e.g. limiting string lengths, ensuring numbers are within a certain range, etc.). **Precedence should be given to implementing these limitations in UI components rather than in the proxies themselves.**

> Our goal isn't to create a 100%-safe, standalone API; it's to provide fallbacks in cases where we might forget/overlook validations in UI.

### Game Assets

As it stands, all game-derived content exists inside either `generated` or `static/assets` directories.

While ConcernedApe isn't known to DMCA fan content, we should keep what's committed to a minimum: only the textures the editor uses are copied into `static/assets`, and the unpacked `content` folder is never committed. If things get dire in the future, we should be able to remove these assets without too much hassle. Of course, that will impede ease of development.
