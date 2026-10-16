import { readFile } from "node:fs/promises";
import { flushSync, tick } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { CCRoom } from "$lib/bundleSideEffects";
import { Raw } from "$lib/proxies";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import { describeProblems, validateSave } from "$lib/saveValidation";
import { XMLManager } from "$lib/workers/xml";
import { SaveManager } from "../src/lib/SaveManager.svelte";

// biome-ignore lint/suspicious/noExplicitAny: poking at raw parsed save data
type Parsed = any;

const loadParsed = async (): Promise<Parsed> =>
	new XMLManager().parse(await readFile("tests/TestSave", "utf-8"));

const locationNamed = (parsed: Parsed, name: string) =>
	parsed.SaveGame.locations.GameLocation.find(
		(l: { name: string }) => l.name === name,
	);

describe("validateSave", () => {
	it("passes a good save", async () => {
		expect(validateSave(await loadParsed())).toEqual({
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
			(p: Parsed) => {
				p.SaveGame.gameVersion = "1.5.6";
			},
			"Unsupported game version",
		],
		[
			"a missing unique ID",
			(p: Parsed) => {
				delete p.SaveGame.uniqueIDForThisGame;
			},
			"unique ID",
		],
		[
			"a player with no name",
			(p: Parsed) => {
				p.SaveGame.player.name = "";
			},
			"has no name",
		],
		[
			"negative money",
			(p: Parsed) => {
				p.SaveGame.player.money = -5;
			},
			"money (-5) is out of range",
		],
		[
			"a missing Farm",
			(p: Parsed) => {
				locationNamed(p, "Farm").name = "Elsewhere";
			},
			"Missing the Farm location",
		],
		[
			"a wrong number of Community Center rooms",
			(p: Parsed) => {
				locationNamed(p, "CommunityCenter").areasComplete.boolean.push(
					false,
					false,
				);
			},
			"8 rooms recorded",
		],
		[
			"a reward waiting for the Missing Bundle",
			(p: Parsed) => {
				const rewards = locationNamed(p, "CommunityCenter").bundleRewards.item;
				rewards.push({ key: { int: 36 }, value: { boolean: true } });
			},
			"Missing Bundle",
		],
		[
			"an invalid item quality",
			(p: Parsed) => {
				const item = p.SaveGame.player.items.Item.find(
					(i: { quality?: number }) => i?.quality !== undefined,
				);
				item.quality = 3;
			},
			"1 item has an invalid quality",
		],
	])("rejects %s", async (_, breakIt, message) => {
		const parsed = await loadParsed();
		breakIt(parsed);
		const result = validateSave(parsed);
		expect(result.valid).toBe(false);
		expect(result.errors.join("\n")).toContain(message);
	});

	it("only warns about things the game can load", async () => {
		const parsed = await loadParsed();
		parsed.SaveGame.player.farmName = "";
		const result = validateSave(parsed);
		expect(result.valid).toBe(true);
		expect(result.warnings).toContain("The farm has no name");
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
		save[Raw].SaveGame.player.money = -1;
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
