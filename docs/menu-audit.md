# Menu audit

Each editor page was checked against the save data for fields it could edit but didn't. This
note lists what each page edits, what was added, and what was left out on purpose (and why), so
the next person doesn't have to audit it again.

## Sources

- **The test save** (`tests/TestSave`, a 1.6.8 save) and the save types in `codegen/save.ts`, for
  which fields are in a save and what they're called.
- **The game's code**, from the 1.5 decompile ([veywrn/StardewValley](https://github.com/veywrn/StardewValley)):
  `Farmer.cs` (`dayupdate`, `maxItems`, `updateFriendshipGifts`), `WorldDate.cs`
  (`TotalSundayWeeks`), `GameLocation.cs` (`Backpack_Purchase`, Clint's counter), `FarmHouse.cs`
  (`setMapForUpgradeLevel`), `Utility.cs` (`getTrashReclamationPrice`), `NPC.cs` (the gift limit),
  `AnimalQueryMenu.cs` (`allowReproduction`) and `Boots.cs`.
- **The [Stardew Valley Wiki](https://stardewvalleywiki.com)** for 1.6: Modding:Stats (the mastery
  stats, and that stat keys are case-insensitive), Mastery Cave (what each level costs),
  Modding:Animal data (`CanGetPregnant`, `CanEatGoldenCrackers`), Golden Animal Cracker, Friendship
  (the gift rules), Blacksmith (2 days per tool), Farmhouse (3 days per upgrade) and Trash Cans.
- **[stardew-checkup](https://github.com/MouseyPounds/stardew-checkup)**, which reads 1.6 saves,
  for how the mastery stats are spelled in a save (`MasteryExp`, `mastery_0` to `mastery_4`).

## Is a tool's weight in the save?

No. Tools in Stardew Valley have no weight, and the save has no such field. A tool's tier is its
item ID in 1.6 (`Axe`, `CopperAxe` ... `IridiumAxe`), so to change a tool's tier, replace it with
the tier you want in the Inventory page's item picker.

## What each page edits

Status is **already** (it could already be edited), **added** (added by this audit), or **left
out** (with the reason).

### Character

| Field | In the save | Status | Notes |
| --- | --- | --- | --- |
| Skill XP and levels | `experiencePoints`, `<skill>Level` | already | |
| Professions | `professions` | already | |
| Max health and stamina | `maxHealth`, `maxStamina` | already | |
| Qi Gems, Qi Coins, Golden Walnuts, hay, deepest mine level | `qiGems`, `clubCoins`, ... | already | |
| Wallet items | `mailReceived` flags | already | |
| Mastery XP | the `MasteryExp` stat | **added** | Can't go below what the masteries already claimed cost (the `mastery_0` to `mastery_4` stats, or `MasteryLevelsSpent`), so the game never has spent more levels than the player has. Not added to a save until it's edited. |
| Backpack size | `maxItems`, and a slot in `items` for each | **added** | 12, 24 or 36 slots, as Pierre sells them; it pads `items` with empty slots like buying one does. It only shrinks when the slots it drops are empty. |
| House upgrade | `daysUntilHouseUpgrade` | **added** | Sets Robin's countdown (1 = done after the next sleep) rather than the level, so the game moves the furniture itself (`Farmer.dayupdate`). Unlike Clint's, it can't be finished at 0: the game only upgrades the house the night the countdown gets there, and saves -1 for no upgrade. So while one is under way the days go down to 1, and a separate Cancel upgrade button stops it (Robin keeps what she was paid). Not offered at level 3 (the cellar), as there's no house past it. A farmhand's countdown only goes down on nights they play. |
| Trash can level | `trashCanLevel` | **added** | 0 to 4 (15% more back per level). Locked while Clint has the trash can, since collecting it upgrades it again. |
| Clint's tool upgrade | `daysLeftForToolUpgrade` | **added** | Shown only while a tool is at Clint's (`toolBeingUpgraded`); 0 means it's ready to collect. |
| House level, set directly | `houseUpgradeLevel` | left out | Skips the furniture moves the game does; use the countdown. |
| Mastery perks | the `mastery_0` to `mastery_4` stats (0 Farming, 1 Fishing, 2 Foraging, 3 Mining, 4 Combat) | left out | Claiming one in the Mastery Cave also gives its items and recipes. |
| Current health and stamina | `health`, `stamina` | left out | Only lasts until the next morning. |
| Luck level | `luckLevel` | left out | The game doesn't use it. |
| Farmhouse renovations | mail flags and map changes | left out | More than one field. |
| Pet type and breed | `whichPetType`, `whichPetBreed` | left out | The pet itself is an NPC on the farm, with its own fields. |

### Inventory

| Field | In the save | Status | Notes |
| --- | --- | --- | --- |
| Items, amounts, quality, price, edibility, colours | each item | already | |
| Weapon stats, trinket stats, bottomless watering can | each item | already | |
| Money, total earnings, name, farm name | the player | already | |
| Boots' defense and immunity | `defenseBonus`, `immunityBonus` | **added** | The game saves these, which is how tailored boots keep their stats. Boots made in the editor now get their stats from the game data too (they used to have none). |
| Tool tier | `upgradeLevel` | left out | The tier comes from the item ID in 1.6; editing the level alone breaks the name, sprite and Clint's next upgrade. Pick the tier from the item picker instead. |
| Enchantments, forge levels | typed enchantment lists | left out | Not simple fields. |
| Fishing rod bait and tackle | `attachments` | left out | Items inside the rod. |
| Watering can water | `WaterLeft` | left out | Refills at any water. (`WateringCanProxy.waterLeft` maps to a lowercase field the save doesn't have; it's unused.) |

### Relationships

| Field | In the save | Status | Notes |
| --- | --- | --- | --- |
| Friendship points and hearts | `Friendship.Points` | already | |
| Gifts given this week | `Friendship.GiftsThisWeek` | **added** | The game allows 2 a week (plus one on their birthday, and a spouse one a day). Each night it resets the count if the week (from Sunday) has changed since `LastGiftDate`, the day of the last gift, adding +10 friendship if it was 2 or more (`Farmer.updateFriendshipGifts`). So lowering it works, but a count set for someone not given a gift this week (no `LastGiftDate`, as in the test save, or an older one) resets the next night, and 2 or more then gives the +10. |
| Gifts today, talked today | `GiftsToday`, `TalkedToToday` | left out | Reset overnight, before the save is written. |
| Dating, married, divorced | `Status` | left out | Needs the spouse, spouse room, events and more. |

### Buildings

| Field | In the save | Status | Notes |
| --- | --- | --- | --- |
| Animals' name, gender, days owned, friendship, happiness, fullness | each `FarmAnimal` | already | |
| Adding animals, upgrading and downgrading buildings | | already | |
| Allow pregnancy | `allowReproduction` | **added** | The toggle on the animal's menu; shown only for animals that can get pregnant (cows, goats, sheep and pigs). |
| Golden Animal Cracker | `hasEatenAnimalCracker` | **added** | Doubles the animal's produce; not for pigs, which can't eat one. |
| Produce quality, health, petted today | `produceQuality`, `health`, `wasPet` | left out | Worked out again every day. |

### Other pages

- **Appearance, Farm (name, profit margin, monsters, mine rewards, date and weather), Community
  Center, Quest Log, Qi's quests, Events, Chests, Crafting and Cooking:** nothing safe and useful
  was missing. Recipe "times crafted" counts were left out as low value.
- **Farmhands** (reorder only): no fields to add.

## Not certain

- The mastery stats aren't in the test save. Their names come from the wiki's Modding:Stats page and
  stardew-checkup; the game matches stat keys case-insensitively, and so does the editor.
- Boots keeping their saved stats is from the 1.5 code (`Boots()` doesn't reload them) and from
  tailored boots keeping theirs in 1.6. If 1.6 did reload them, the edit would just be undone.
- `generated/farmanimals.json` gained `canEatGoldenCrackers` by hand (false for pigs, from the wiki)
  because the game's content folder wasn't available; `codegen/dump.ts` now writes it, so the next
  `npm run dump` checks it against `Data/FarmAnimals`.
