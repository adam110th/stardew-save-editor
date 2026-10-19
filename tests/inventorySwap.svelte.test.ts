import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Player } from "../codegen/save";
import { Inventory } from "../src/lib/proxies/Inventory.svelte";
import { Item } from "../src/lib/proxies/Item.svelte";
import { Raw } from "../src/lib/proxies/index";

const nil = { "@_xsi:nil": "true" };

const secretNote = () => ({
	"@_xsi:type": "Object",
	name: "Secret Note #7",
	itemId: "79",
	stack: 1,
});

describe("Inventory.swap", () => {
	let player: Player;
	let inventory!: Inventory;
	let cleanup: () => void;

	const load = (items: unknown[]) => {
		cleanup?.();
		player = { items: { Item: items } } as unknown as Player;
		cleanup = $effect.root(() => {
			inventory = new Inventory(player);
		});
		flushSync();
	};

	beforeEach(() => load([nil, nil, nil]));
	afterEach(() => cleanup());

	it("swaps two slots, keeping both items' edits saved", () => {
		const parsnip = Item.fromName("Parsnip");
		const stone = Item.fromName("Stone");
		inventory.set(0, parsnip);
		inventory.set(1, stone);

		inventory.swap(0, 1);
		expect(inventory.get(0)).toBe(stone);
		expect(inventory.get(1)).toBe(parsnip);
		expect(player.items.Item[0]).toBe(stone[Raw]);
		expect(player.items.Item[1]).toBe(parsnip[Raw]);

		// Neither item was disposed, so edits still reach the save
		parsnip.quality = 2;
		stone.quality = 1;
		flushSync();
		expect(player.items.Item[1]?.quality).toBe(2);
		expect(player.items.Item[0]?.quality).toBe(1);
	});

	it("moves an item into an empty slot", () => {
		const parsnip = Item.fromName("Parsnip");
		inventory.set(0, parsnip);

		inventory.swap(0, 2);
		expect(inventory.get(0)).toBeUndefined();
		expect(player.items.Item[0]).toEqual(nil);
		expect(inventory.get(2)).toBe(parsnip);

		parsnip.quality = 4;
		flushSync();
		expect(player.items.Item[2]?.quality).toBe(4);
	});

	it("keeps saving edits to created items after they're dragged", () => {
		const wood = Item.fromName("Wood");
		const stone = Item.fromName("Stone");
		inventory.set(0, wood);
		inventory.set(1, stone);

		inventory.swap(0, 1); // Swap two items
		inventory.swap(1, 2); // Move the Wood to an empty slot
		wood.amount = 50;
		stone.amount = 7;
		flushSync();

		expect(inventory.get(0)).toBe(stone);
		expect(inventory.get(1)).toBeUndefined();
		expect(inventory.get(2)).toBe(wood);
		expect(player.items.Item[0]).toBe(stone[Raw]);
		expect(player.items.Item[1]).toEqual(nil);
		expect(player.items.Item[2]).toBe(wood[Raw]);
		// Both items' edits still reach the save
		expect(wood[Raw].stack).toBe(50);
		expect(stone[Raw].stack).toBe(7);
	});

	it("moves a Secret Note loaded with the save", () => {
		const note = secretNote();
		load([note, nil, nil]);
		const loaded = inventory.get(0);
		expect(loaded?.name).toBe("Secret Note #7");

		inventory.swap(0, 1);
		expect(inventory.get(1)).toBe(loaded);
		expect(inventory.get(0)).toBeUndefined();
		expect(player.items.Item[1]).toBe(note);
		expect(player.items.Item[0]).toEqual(nil);
	});

	it("moves a Secret Note the inventory has no item for", () => {
		const note = secretNote();
		// Only in the save's own slot, not loaded into the inventory
		// biome-ignore lint/suspicious/noExplicitAny: poking at raw parsed save data
		(player.items.Item as any[])[0] = note;
		const parsnip = Item.fromName("Parsnip");
		inventory.set(1, parsnip);

		inventory.swap(0, 1);
		expect(player.items.Item[1]).toBe(note);
		expect(player.items.Item[0]).toBe(parsnip[Raw]);
		expect(inventory.get(0)).toBe(parsnip);
		expect(inventory.get(1)).toBeUndefined();
	});
});
