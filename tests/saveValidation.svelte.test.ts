import { readFile } from "node:fs/promises";
import { fireEvent, render } from "@testing-library/svelte";
import { createRawSnippet, flushSync, tick } from "svelte";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { CCRoom } from "$lib/bundleSideEffects";
import { Raw } from "$lib/proxies";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import {
	describeProblems,
	describeResult,
	validateSave,
} from "$lib/saveValidation";
import { XMLManager } from "$lib/workers/xml";
import type { GameLocation, Season } from "$types/save";
import {
	SaveManager,
	SaveValidationError,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import {
	setToastManagerContext,
	ToastManager,
} from "../src/lib/ToastManager.svelte";
import editLayout from "../src/routes/(edit)/+layout.svelte";
import uploadPage from "../src/routes/(home)/(upload)/+page.svelte";
import { withAnimalBuildings } from "./helpers/animalBuildings";

// The pages navigate after uploading, which isn't possible here
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

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

const UNUSUAL_QUALITY =
	"1 item has an unusual quality (not normal, silver, gold or iridium)";

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
			"an item quality the game can't read",
			(p: SaveFile) => {
				firstItemWithQuality(p).quality = "high" as unknown as number;
			},
			"1 item has a quality the game can't read",
		],
		[
			"an item quality too big for the game's int",
			(p: SaveFile) => {
				firstItemWithQuality(p).quality = 2 ** 31;
			},
			"1 item has a quality the game can't read",
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
		[
			"an unusual item quality",
			(p: SaveFile) => {
				firstItemWithQuality(p).quality = 3;
			},
			UNUSUAL_QUALITY,
		],
		[
			"an unusual quality on an ordinary item with ID 126 (Strange Doll)",
			(p: SaveFile) => {
				Object.assign(firstItemWithQuality(p), { itemId: 126, quality: 5 });
			},
			UNUSUAL_QUALITY,
		],
		[
			"an empty stack",
			(p: SaveFile) => {
				firstItemWithQuality(p).stack = 0;
			},
			"1 item has a stack of less than 1",
		],
		[
			"a stack that isn't a number",
			(p: SaveFile) => {
				firstItemWithQuality(p).stack = "" as unknown as number;
			},
			"1 item has a stack of less than 1",
		],
	])("only warns about %s", (_, breakIt, message) => {
		const parsed = loadParsed();
		breakIt(parsed);
		const result = validateSave(parsed);
		expect(result.valid).toBe(true);
		expect(result.warnings.join("\n")).toContain(message);
	});

	it("accepts a Rarecrow wearing a hat, which keeps the hat in its quality", () => {
		const parsed = loadParsed();
		const placed = locationNamed(parsed, "Farm").objects?.item[0]?.value.Object;
		if (!placed) throw new Error("Nothing placed on the Farm");
		// (BC)126 wearing hat 4
		Object.assign(placed, {
			name: "Rarecrow",
			itemId: 126,
			bigCraftable: true,
			quality: 5,
		});
		expect(validateSave(parsed)).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
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

	it("summarises problems as the first one and a count of the rest", () => {
		expect(describeProblems([])).toBe("");
		expect(describeProblems(["a"])).toBe("a");
		expect(describeProblems(["a", "b", "c"])).toBe("a (and 2 more)");
	});
});

describe("describeResult", () => {
	const clean = { valid: true, errors: [], warnings: [] };

	it("just says what happened when nothing was found", () => {
		expect(describeResult("uploaded", clean)).toEqual({
			message: "Save file uploaded!",
			type: "success",
			duration: 5000,
		});
		expect(describeResult("downloaded", clean).message).toBe(
			"Save file downloaded!",
		);
		expect(describeResult("downloaded").type).toBe("success");
	});

	it("shows a warning", () => {
		expect(
			describeResult("downloaded", { ...clean, warnings: ["Low money"] }),
		).toEqual({
			message: "Save file downloaded, with a warning: Low money",
			type: "warning",
			duration: 10000,
		});
	});

	it("summarises several warnings", () => {
		expect(
			describeResult("uploaded", { ...clean, warnings: ["a", "b", "c"] })
				.message,
		).toBe("Save file uploaded, with warnings: a (and 2 more)");
	});

	it("puts errors first, and counts the warnings after them", () => {
		expect(
			describeResult("uploaded", {
				valid: false,
				errors: ["Broken"],
				warnings: ["Odd"],
			}),
		).toEqual({
			message: "Save file uploaded, but it has problems: Broken (and 1 more)",
			type: "failure",
			duration: 10000,
		});
	});
});

async function importSave(xml: string): Promise<SaveManager> {
	let saveManager!: SaveManager;
	let promise: Promise<void> = Promise.resolve();
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
		promise = saveManager.import(new File([xml], "TestSave"));
	});
	await promise;
	flushSync();
	cleanup();
	return saveManager;
}

describe("SaveManager validation", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		saveManager = await importSave(await readFile("tests/TestSave", "utf-8"));
	});

	it("validates a save when it's uploaded", () => {
		expect(saveManager.loadValidation).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("validates exactly what would be downloaded", async () => {
		const good = await saveManager.validatedExport();
		expect(good.blob.size).toBeGreaterThan(0);
		expect(good.validation.valid).toBe(true);

		const save = saveManager.save;
		if (!save) throw new Error("No save");
		// More than the game's int can hold
		save[Raw].SaveGame.player.money = 2 ** 31;
		const bad = await saveManager.validatedExport();
		expect(bad.validation.valid).toBe(false);
	});

	it("refuses to download a save that fails validation", async () => {
		const save = saveManager.save;
		if (!save) throw new Error("No save");
		save[Raw].SaveGame.player.money = 2 ** 31;

		const error = await saveManager.download().catch((e) => e);
		expect(error).toBeInstanceOf(SaveValidationError);
		expect(error.message).toBe(
			"Save file not downloaded: Test's money (2147483648) is out of range",
		);
	});

	it("still downloads a save with warnings, and returns them", async () => {
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		const save = saveManager.save;
		if (!save) throw new Error("No save");
		save[Raw].SaveGame.player.money = -5;

		const validation = await saveManager.download();
		expect(click).toHaveBeenCalledOnce();
		expect(validation.warnings).toEqual(["Test's money (-5) is negative"]);
		click.mockRestore();
	});
});

describe("Validation toasts", () => {
	mockIDB();
	const negativeMoneySave = async () =>
		(await readFile("tests/TestSave", "utf-8")).replace(
			"<money>1285</money>",
			"<money>-5</money>",
		);

	// Contexts for the pages, with a spy on the toasts they add
	const contexts = (saveManager: SaveManager) => {
		const toastManager = new ToastManager();
		const add = vi.spyOn(toastManager, "add");
		const context = new Map<unknown, unknown>([
			...setSaveManagerContext(saveManager),
			...setToastManagerContext(toastManager),
		]);
		return { context, add };
	};

	it("shows warnings when a save is uploaded", async () => {
		let saveManager!: SaveManager;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
		});
		const { context, add } = contexts(saveManager);
		const page = render(uploadPage, { context });

		const input = page.getByLabelText("Save file") as HTMLInputElement;
		const transfer = new DataTransfer();
		transfer.items.add(new File([await negativeMoneySave()], "TestSave"));
		input.files = transfer.files;
		await fireEvent.change(input);

		await vi.waitFor(() => expect(add).toHaveBeenCalled(), { timeout: 30000 });
		const [toast, duration] = add.mock.calls[0] ?? [];
		expect(toast?.message).toBe(
			"Save file uploaded, with a warning: Test's money (-5) is negative",
		);
		expect(toast?.icon).toBe("⚠️");
		expect(duration).toBe(10000);
		cleanup();
	});

	it("shows warnings when a save is downloaded, and still downloads it", async () => {
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		const saveManager = await importSave(await negativeMoneySave());
		const { context, add } = contexts(saveManager);
		const children = createRawSnippet(() => ({ render: () => "<div></div>" }));
		const page = render(editLayout, { props: { children }, context });

		await fireEvent.click(page.getByTestId("save-button"));
		// Past the reminder to back up the game's copy first
		await fireEvent.click(page.getByTestId("backup-confirm"));

		await vi.waitFor(() => expect(add).toHaveBeenCalled(), { timeout: 30000 });
		expect(click).toHaveBeenCalledOnce();
		const [toast, duration] = add.mock.calls[0] ?? [];
		expect(toast?.message).toBe(
			"Save file downloaded, with a warning: Test's money (-5) is negative",
		);
		expect(toast?.icon).toBe("⚠️");
		expect(duration).toBe(10000);
		click.mockRestore();
	});
});

describe("SaveManager validation of an invalid upload", () => {
	mockIDB();

	it("still opens the save, so it can be fixed", async () => {
		const xml = (await readFile("tests/TestSave", "utf-8")).replace(
			"<money>1285</money>",
			"<money>99999999999</money>",
		);
		const saveManager = await importSave(xml);
		expect(saveManager.save).toBeDefined();
		expect(saveManager.loadValidation?.valid).toBe(false);
		expect(saveManager.loadValidation?.errors).toContain(
			"Test's money (99999999999) is out of range",
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
