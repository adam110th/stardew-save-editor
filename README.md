# Stardew Valley Save Editor

> [!IMPORTANT]
> [Link to editor here](https://adam110th.github.io/stardew-save-editor/)

A web-based save editor for Stardew Valley. Safely edit your save files directly in your browser.

## Features

### Current Features

- ✅ Character Customization
  - Edit appearance, name, and farm name
  - Modify skills and money, and Mastery XP (it can't go below what claimed masteries cost)
  - Upgrade the backpack (12, 24 or 36 slots), the trash can, and the house: Robin's countdown is
    set, so the game does the upgrade overnight and moves the furniture itself (or cancel one she's
    started)
  - Finish the tool Clint is upgrading
  - Change relationships with NPCs, with each villager's description and loved gifts, and reset the
    gifts given this week
- ✅ Inventory Management  
  - Add/remove items
  - Modify existing items, including boots' defense and immunity
- ✅ Recipe Management
  - Unlock cooking recipes
  - Unlock crafting recipes
  - See each recipe's item description
- ✅ Farm Settings
  - Edit farm name, profit margin (any percentage), monster spawning and mine rewards
  - Change the date (year, season and day, on a calendar showing each day's weekday and festivals);
    every farmer's copy of the date and the host's days played change with it
  - Set today's weather and tomorrow's forecast, within the game's rules: only the weather each
    season can have (no snow outside winter, no wind in summer), and the days the game always gives
    the same weather (festivals, the 1st of each season, summer storms, the year's green rain day).
    Moving the date off one of those days brings back the weather you picked. Rain waters the farm,
    as a rainy morning does, and taking it away dries only what that watered
  - View settings fixed at farm creation (farm type, random seed, and more)
- ✅ Community Center
  - Tick donated items, or complete a whole bundle or room at once
  - Finished bundles leave their rewards to collect in-game
  - Joja route: buy Community Development projects instead
- ✅ Buildings
  - Edit farm animals in barns and coops, including whether they can get pregnant and whether they've
    eaten a Golden Animal Cracker
  - Add animals to barns and coops: only ones that building can house, and only while there's room.
    Villagers get to mention them, as when you buy one from Marnie
  - Upgrade or downgrade barns, coops and sheds (e.g. Coop → Big Coop → Deluxe Coop, Shed → Big Shed),
    with the incubator and the things the game moves inside handled as Robin's upgrade does. A downgrade
    needs the animals to fit, moves those things back, and says if anything couldn't go back
  - See each building's description and build cost (gold and materials)
- ✅ Quest Log
  - See each quest in the journal with its description, objective, reward and days left
  - Mark quests complete as the game does (gold waits in the journal to collect in-game, the next
    story quest starts, and Help Wanted quests count toward Prize Tickets), or remove them
  - Change a quest's gold reward, and how many days a Help Wanted quest has left
- ✅ Event management
  - See which events (cutscenes) each farmer has seen, named from the
    [List of Vanilla Event IDs](https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs)
  - Untick a heart event to watch it again, or tick a cutscene to skip it
  - Search, group by villager or location, and add or remove any event ID (e.g. from mods)
- ✅ Save Management
  - Switch between farmhands
  - Automatic save backups
  - Cross-platform support

See [docs/menu-audit.md](docs/menu-audit.md) for what each menu can edit, and what's left out on
purpose (and why).

### Planned Features

- 🔄 Full code and security review of this fork

## Usage

1. Visit the [live editor](https://adam110th.github.io/stardew-save-editor/)
2. Backup your original save file
3. Upload your save file
4. Make your desired changes
5. Download the modified save
6. Replace your original save with the modified version

> [!WARNING]
> Always backup your save files before editing. Save editing can potentially corrupt files or cause unexpected game behavior.

## Compatibility

### Game Versions

- ✅ Stardew Valley 1.6.x (fully supported)
- ❌ Stardew Valley 1.5.x (no longer supported)

### Platforms

- ✅ Windows/macOS/Linux
- ✅ Android/iOS
- 🟡 Switch/PlayStation (see [SUPPORT.md](./SUPPORT.md))

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup and contribution guidelines.

## Legal

This project uses assets from Stardew Valley under Fair Use. These assets are owned by ConcernedApe and are not covered by this project's license. See [LICENSE.md](./LICENSE.md) for details.
