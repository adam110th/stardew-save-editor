import { readFile } from "node:fs/promises";
import { fireEvent, render } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Gender } from "../codegen/save";
import {
	SaveManager,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import buildingsPage from "../src/routes/(edit)/(list)/buildings/+page.svelte";
import List from "../src/routes/(edit)/(list)/List.svelte";
import Character from "../src/routes/(edit)/appearance/Character.svelte";
import BundleItem from "../src/routes/(edit)/bundles/BundleItem.svelte";
import ItemSelect from "../src/routes/(edit)/inventory/ItemSelect.svelte";
import NamedItemSprite from "../src/routes/(edit)/inventory/NamedItemSprite.svelte";
import HeartBar from "../src/routes/(edit)/relationships/HeartBar.svelte";
import { trackItems } from "./helpers/trackItems";

const live = (created: ReturnType<typeof trackItems>) =>
	created.filter((item) => item.disposed === 0).length;

describe("Item sprites drawn by name", () => {
	mockIDB();
	let saveManager!: SaveManager;
	let cleanup: () => void;

	beforeEach(async () => {
		const xml = await readFile("tests/TestSave", "utf-8");
		let promise!: Promise<void>;
		cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([xml], "TestSave"));
		});
		await promise;
		flushSync();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		cleanup();
	});

	const player = () => {
		if (!saveManager.save) throw new Error("No save");
		return saveManager.save.player;
	};

	it("disposes its item when the name changes and when it's removed", async () => {
		const created = trackItems();
		const page = render(NamedItemSprite, { name: "Diamond" });
		expect(page.container.querySelector("svg image")).toBeTruthy();
		expect(created).toEqual([{ name: "Diamond", disposed: 0 }]);

		await page.rerender({ name: "Emerald" });
		expect(created).toEqual([
			{ name: "Diamond", disposed: 1 },
			{ name: "Emerald", disposed: 0 },
		]);

		page.unmount();
		expect(created).toEqual([
			{ name: "Diamond", disposed: 1 },
			{ name: "Emerald", disposed: 1 },
		]);
	});

	it("disposes the recipe list's icons when it closes", () => {
		const created = trackItems();
		const page = render(List, { recipes: player().craftingRecipes });
		const icons = page.container.querySelectorAll(".img").length;
		expect(icons).toBeGreaterThan(0);
		expect(live(created)).toBe(icons);

		page.unmount();
		expect(live(created)).toBe(0);
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});

	it("disposes the add-item list's icons as the search changes", async () => {
		const created = trackItems();
		const page = render(ItemSelect, { onsubmit: () => {} });
		const input = page.getByTestId("item-name") as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "Leek" } });
		await tick();
		await fireEvent.input(input, { target: { value: "Parsnip" } });
		await tick();
		const icons = page.container.querySelectorAll(".icon").length;
		expect(icons).toBeGreaterThan(0);
		expect(live(created)).toBe(icons);

		page.unmount();
		expect(live(created)).toBe(0);
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});

	it("disposes the appearance preview's stand-in clothes", async () => {
		const created = trackItems();
		const farmer = player();
		const page = render(Character, { player: farmer });
		expect(created.map((item) => item.name)).toContain("Polka Dot Shorts");

		farmer.gender = farmer.gender === Gender.Male ? Gender.Female : Gender.Male;
		flushSync();
		const shirts = created.filter((item) =>
			item.name.startsWith("Basic Pullover"),
		);
		expect(shirts.length).toBeGreaterThan(0);
		expect(shirts.filter((item) => item.disposed === 0)).toHaveLength(1);

		page.unmount();
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});

	it("disposes a villager's loved-gift icons when the row goes away", () => {
		const created = trackItems();
		const npc = player().friendships.get("Lewis");
		if (!npc) throw new Error("No Lewis");
		const page = render(HeartBar, { name: "Lewis", npc });
		const icons = page.container.querySelectorAll(
			"[data-testid=friendship-loved-gift], [data-testid=friendship-universal-love]",
		).length;
		expect(icons).toBeGreaterThan(0);
		expect(live(created)).toBe(icons);

		page.unmount();
		expect(live(created)).toBe(0);
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});

	it("disposes the buildings' material icons when the page closes", () => {
		const created = trackItems();
		const page = render(buildingsPage, {
			context: setSaveManagerContext(saveManager),
		});
		const icons = page.container.querySelectorAll(".material-icon").length;
		expect(icons).toBeGreaterThan(0);
		expect(live(created)).toBe(icons);

		page.unmount();
		expect(live(created)).toBe(0);
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});

	it("disposes a bundle item's icon when it changes and when it's removed", async () => {
		const created = trackItems();
		const page = render(BundleItem, { itemId: "24", type: "O" });
		expect(page.container.textContent).toContain("Parsnip");
		expect(created).toEqual([{ name: "Parsnip", disposed: 0 }]);

		await page.rerender({ itemId: "188", type: "O" });
		expect(page.container.textContent).toContain("Green Bean");
		expect(created).toEqual([
			{ name: "Parsnip", disposed: 1 },
			{ name: "Green Bean", disposed: 0 },
		]);

		page.unmount();
		expect(created.every((item) => item.disposed === 1)).toBe(true);
	});
});
