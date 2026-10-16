import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import type { Player } from "../codegen/save";
import { Inventory } from "../src/lib/proxies/Inventory.svelte";
import { Item } from "../src/lib/proxies/Item.svelte";
import { Raw } from "../src/lib/proxies/index";

const nil = { "@_xsi:nil": "true" };

describe("Inventory.swap", () => {
	it("keeps saving edits to created items after they're dragged", () => {
		const player = { items: { Item: [nil, nil, nil] } } as unknown as Player;
		let inventory!: Inventory;
		const cleanup = $effect.root(() => {
			inventory = new Inventory(player);
		});
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
		cleanup();
	});
});
