import { readFile } from "node:fs/promises";
import { openDB } from "idb";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { BackupManager } from "../src/lib/BackupManager.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";

mockIDB();

const openBackups = () =>
	openDB("backups", 1, {
		upgrade: (db) => db.createObjectStore("files", { autoIncrement: true }),
	});

/** Names of the stored backups, oldest first (the order they're written) */
const storedNames = async () => {
	const db = await openBackups();
	const rows = (await db.getAll("files")) as { name: string }[];
	db.close();
	return rows.map((row) => row.name);
};

const store = async (...names: string[]) => {
	const db = await openBackups();
	for (const name of names)
		await db.add("files", {
			name,
			data: `<SaveGame>${name}</SaveGame>`,
			lastModified: 0,
			size: 0,
			type: "text/text",
		});
	db.close();
};

/** A BackupManager as the page would make it; dispose() stands in for leaving it */
const createManager = (limit?: number) => {
	let manager!: BackupManager;
	const dispose = $effect.root(() => {
		manager = new BackupManager(limit);
	});
	return { manager, dispose };
};

const loadedNames = async (manager: BackupManager, expected: string[]) =>
	vi.waitFor(() => expect(manager.files.map((f) => f.name)).toEqual(expected));

describe("Backups", () => {
	beforeEach(async () => {
		const db = await openBackups();
		await db.clear("files");
		db.close();
	});

	it("stores an uploaded save, and still has it after a reload", async () => {
		const first = createManager();
		first.manager.files.unshift(new File(["<SaveGame />"], "Farm_1"));
		flushSync();
		await vi.waitFor(async () =>
			expect(await storedNames()).toEqual(["Farm_1"]),
		);
		first.dispose();

		const reloaded = createManager();
		await loadedNames(reloaded.manager, ["Farm_1"]);
		reloaded.dispose();
	});

	it("keeps a deleted backup deleted", async () => {
		await store("Farm_old", "Farm_new");
		const { manager, dispose } = createManager();
		// Loading doesn't clear what's stored; the newest comes first
		await loadedNames(manager, ["Farm_new", "Farm_old"]);

		manager.files.splice(1, 1);
		flushSync();
		await vi.waitFor(async () =>
			expect(await storedNames()).toEqual(["Farm_new"]),
		);
		dispose();
	});

	it("keeps only the newest backups, without duplicates", async () => {
		const { manager, dispose } = createManager(2);
		await loadedNames(manager, []);
		for (const name of ["Farm_1", "Farm_2", "Farm_3"]) {
			manager.files.unshift(new File([name], name));
			flushSync();
		}
		await vi.waitFor(async () =>
			expect(await storedNames()).toEqual(["Farm_2", "Farm_3"]),
		);
		expect(manager.files.map((f) => f.name)).toEqual(["Farm_3", "Farm_2"]);
		dispose();
	});

	it("backs up each new version of a farm's save, but not the same file twice", async () => {
		const save = (await readFile("tests/TestSave")).toString("utf-8");
		const later = save.replace(/<money>\d+<\/money>/, "<money>123456</money>");
		expect(later).not.toBe(save);

		let saveManager!: SaveManager;
		const dispose = $effect.root(() => {
			saveManager = new SaveManager();
		});
		await loadedNames(saveManager.backups, []);
		// A farm's save keeps its name (Farm_<id>) for the life of the farm
		await saveManager.import(new File([save], "Farm_1"));
		await saveManager.import(new File([later], "Farm_1"));
		await saveManager.import(new File([later], "Farm_1"));

		const backups = saveManager.backups.files;
		expect(backups).toHaveLength(2);
		expect(await backups[0]?.text()).toBe(later);
		expect(await backups[1]?.text()).toBe(save);
		dispose();
	});
});
