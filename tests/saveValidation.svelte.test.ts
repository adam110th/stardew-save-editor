import { readFile } from "node:fs/promises";
import { flushSync, tick } from "svelte";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { CCRoom } from "$lib/bundleSideEffects";
import { Raw } from "$lib/proxies";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import { describeProblems, validateSave } from "$lib/saveValidation";
import { XMLManager } from "$lib/workers/xml";
import type { GameLocation, Season } from "$types/save";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { withAnimalBuildings } from "./helpers/animalBuildings";

const locationNamed = (parsed: SaveFile, name: string) => {
	const location = parsed.SaveGame.locations.GameLocation.find(
		(l) => l.name === name,
	);
	if (!location) throw new Error(`No ${name} location`);
	return location;
};

const firstItemWithQuality = (parsed: SaveFile) => {
	const item = parsed.SaveGame.player.items.Item.find(
		(i) => i?.quality !== undefined,
	);
	if (!item) throw new Error("No item with a quality");
	return item;
};

const daysPlayedStat = (player: SaveFile["SaveGame"]["player"]) => {
	const stat = player.stats.Values?.item?.find(
		(s) => s.key.string === "daysPlayed",
	);
	if (!stat) throw new Error("No daysPlayed stat");
	return stat;
};

describe("validateSave", () => {
	let fixture: SaveFile;
	// Parsing is slow, so parse once and hand each test its own copy
	const loadParsed = () => structuredClone(fixture);

	beforeAll(async () => {
		fixture = new XMLManager().parse<SaveFile>(
			await readFile("tests/TestSave", "utf-8"),
		);
	});

	it("passes a good save", () => {
		expect(validateSave(loadParsed())).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("rejects something that isn't a save", () => {
		const result = validateSave({ notASave: true });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("Not a Stardew Valley save");
	});

	it.each([
		[
			"an unsupported game version",
			(p: SaveFile) => {
				p.SaveGame.gameVersion = "1.5.6";
			},
			'Unsupported game version "1.5.6"',
		],
		[
			"a missing unique ID",
			(p: SaveFile) => {
				Reflect.deleteProperty(p.SaveGame, "uniqueIDForThisGame");
			},
			"unique ID",
		],
		[
			"a unique ID the game can't read",
			(p: SaveFile) => {
				p.SaveGame.uniqueIDForThisGame = "" as unknown as number;
			},
			"unique ID",
		],
		[
			"money the game can't read",
			(p: SaveFile) => {
				p.SaveGame.player.money = 2 ** 31;
			},
			"Test's money (2147483648) is out of range",
		],
		[
			"blank money",
			(p: SaveFile) => {
				p.SaveGame.player.money = "" as unknown as number;
			},
			"Test's money () is out of range",
		],
		[
			"a missing Farm",
			(p: SaveFile) => {
				locationNamed(p, "Farm").name = "Elsewhere";
			},
			"Missing the Farm location",
		],
		[
			"a wrong number of Community Center rooms",
			(p: SaveFile) => {
				locationNamed(p, "CommunityCenter").areasComplete?.boolean.push(
					false,
					false,
				);
			},
			"8 rooms recorded",
		],
		[
			"a reward waiting for the Missing Bundle",
			(p: SaveFile) => {
				const reward = locationNamed(
					p,
					"CommunityCenter",
				).bundleRewards?.item.find((kv) => kv.key.int === 36);
				if (!reward) throw new Error("No reward entry for bundle 36");
				reward.value.boolean = true;
			},
			"Missing Bundle",
		],
		[
			"an invalid item quality",
			(p: SaveFile) => {
				firstItemWithQuality(p).quality = 3;
			},
			"1 item has an invalid quality",
		],
		[
			"a season the game can't read",
			(p: SaveFile) => {
				p.SaveGame.currentSeason = "autumn" as Season;
			},
			'"autumn" isn\'t a season',
		],
		[
			"a stat that isn't an unsigned int",
			(p: SaveFile) => {
				daysPlayedStat(p.SaveGame.player).value.unsignedInt = -102;
			},
			"Test's daysPlayed stat (-102) is out of range",
		],
	])("rejects %s", (_, breakIt, message) => {
		const parsed = loadParsed();
		breakIt(parsed);
		const result = validateSave(parsed);
		expect(result.valid).toBe(false);
		expect(result.errors.join("\n")).toContain(message);
	});

	describe("farm animals", () => {
		// Parsed once; parsing the whole save for each test is slow
		let parsedWithAnimals: Promise<SaveFile> | undefined;
		const loadWithAnimals = async () => {
			parsedWithAnimals ??= readFile("tests/TestSave", "utf-8").then((xml) =>
				new XMLManager().parse<SaveFile>(withAnimalBuildings(xml)),
			);
			return structuredClone(await parsedWithAnimals);
		};
		const coop = (p: SaveFile) => {
			const indoors = locationNamed(p, "Farm").buildings?.Building?.find(
				(b) => b.buildingType === "Coop",
			)?.indoors;
			if (!indoors) throw new Error("No coop");
			return indoors;
		};
		const firstAnimal = (location: GameLocation) => {
			const animal = location.animals?.item?.[0];
			if (!animal) throw new Error("No animal");
			return animal;
		};
		// What older versions of the editor made
		const badId = "1700000000000-abc123def" as unknown as number;

		it("passes animals in buildings and outside", async () => {
			expect(validateSave(await loadWithAnimals()).valid).toBe(true);
		});

		it("rejects an animal ID the game can't read", async () => {
			const parsed = await loadWithAnimals();
			const animal = firstAnimal(coop(parsed));
			animal.key.long = badId;
			animal.value.FarmAnimal.myID = badId;
			const result = validateSave(parsed);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("1 farm animal has an invalid ID");

			firstAnimal(locationNamed(parsed, "Farm")).value.FarmAnimal.myID =
				"1.5" as unknown as number;
			expect(validateSave(parsed).errors).toContain(
				"2 farm animals have an invalid ID",
			);
		});

		it("warns about more animals than a building has room for", async () => {
			const parsed = await loadWithAnimals();
			coop(parsed).animalLimit = 3;
			const result = validateSave(parsed);
			expect(result.valid).toBe(true);
			expect(result.warnings).toContain(
				"4 animals live in a Coop with room for 3",
			);
		});
	});

	it.each([
		[
			"a farm with no name",
			(p: SaveFile) => {
				p.SaveGame.player.farmName = "";
			},
			"The farm has no name",
		],
		[
			"a main player with no name",
			(p: SaveFile) => {
				p.SaveGame.player.name = "";
			},
			"The main player has no name",
		],
		[
			"negative money",
			(p: SaveFile) => {
				p.SaveGame.player.money = -5;
			},
			"Test's money (-5) is negative",
		],
	])("only warns about %s", (_, breakIt, message) => {
		const parsed = loadParsed();
		breakIt(parsed);
		const result = validateSave(parsed);
		expect(result.valid).toBe(true);
		expect(result.warnings.join("\n")).toContain(message);
	});

	it("only warns about snow outside winter", () => {
		const parsed = loadParsed();
		parsed.SaveGame.isSnowing = true;
		const result = validateSave(parsed);
		expect(result.valid).toBe(true);
		expect(result.warnings).toEqual([
			"It's snowing in spring, and only snows in winter",
		]);
	});

	it.each([
		["day 29", { dayOfMonth: 29 }, "The day of the month (29) isn't 1 to 28"],
		["day 0", { dayOfMonth: 0 }, "The day of the month (0) isn't 1 to 28"],
		["year 0", { year: 0 }, "The year (0) is less than 1"],
	])("warns about %s, a date the game never makes", (_, date, message) => {
		const parsed = loadParsed();
		Object.assign(parsed.SaveGame, date);
		const result = validateSave(parsed);
		expect(result.valid).toBe(true);
		expect(result.warnings).toEqual([message]);
	});

	it("reads the season as the game does, ignoring case", () => {
		const parsed = loadParsed();
		parsed.SaveGame.currentSeason = "Summer" as Season;
		expect(validateSave(parsed).valid).toBe(true);
	});

	it("accepts a restored Abandoned Joja Mart (7 rooms)", () => {
		const parsed = loadParsed();
		locationNamed(parsed, "CommunityCenter").areasComplete?.boolean.push(true);
		expect(validateSave(parsed).valid).toBe(true);
	});

	it("accepts unclaimed cabins, whose farmhands have no name", () => {
		const parsed = loadParsed();
		const unclaimed = { ...structuredClone(parsed.SaveGame.player), name: "" };
		parsed.SaveGame.farmhands = { Farmer: [unclaimed] };
		expect(validateSave(parsed)).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("summarises the first problems", () => {
		expect(
			describeProblems({ valid: false, errors: ["a", "b", "c"], warnings: [] }),
		).toBe("a; b (and 1 more)");
	});
});

describe("SaveManager validation", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		const file = await readFile("tests/TestSave");
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([file], "TestSave"));
		});
		await promise;
		flushSync();
		cleanup();
	});

	it("validates a save when it's uploaded", () => {
		expect(saveManager.loadValidation?.valid).toBe(true);
	});

	it("validates exactly what would be downloaded", async () => {
		const good = await saveManager.validatedExport();
		expect(good.validation.valid).toBe(true);

		const save = saveManager.save;
		if (!save) throw new Error("No save");
		// More than the game's int can hold
		save[Raw].SaveGame.player.money = 2 ** 31;
		const bad = await saveManager.validatedExport();
		expect(bad.validation.valid).toBe(false);
		await expect(saveManager.download()).rejects.toThrow(
			"Save file is not valid",
		);
	});
});

describe("Bulletin Board thank-you letter", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		const file = await readFile("tests/TestSave");
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([file], "TestSave"));
		});
		await promise;
		flushSync();
		cleanup();
	});

	const bulletin = () =>
		[...(saveManager.save?.communityBundles?.values() ?? [])].filter(
			(b) => b.room === CCRoom.BulletinBoard,
		);

	it("delivers the letter to the mailbox when the room is restored, and takes it back if not", async () => {
		const player = saveManager.save?.player;
		if (!player) throw new Error("No player");
		expect(player.mailbox.has(MailFlag.ccBulletinThankYou)).toBe(false);

		for (const b of bulletin()) b.complete();
		flushSync();
		await tick();
		expect(player.mailbox.has(MailFlag.ccBulletinThankYou)).toBe(true);
		expect(player[Raw].mailbox.string).toContain("ccBulletinThankYou");
		// Not marked as read, or the game wouldn't give the hearts
		expect(player.mailReceived.has(MailFlag.ccBulletinThankYou)).toBe(false);

		bulletin()[0]?.clear();
		flushSync();
		await tick();
		expect(player.mailbox.has(MailFlag.ccBulletinThankYou)).toBe(false);
	});

	it("doesn't send the letter again once its hearts were given", async () => {
		const player = saveManager.save?.player;
		if (!player) throw new Error("No player");
		player.mailReceived.add(MailFlag.ccBulletinThankYouReceived);

		for (const b of bulletin()) b.complete();
		flushSync();
		await tick();
		expect(player.mailbox.has(MailFlag.ccBulletinThankYou)).toBe(false);
	});
});
