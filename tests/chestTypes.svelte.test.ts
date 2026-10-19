import { describe, expect, it } from "vitest";
import type { Item, Save } from "../codegen/save";
import {
	ChestProxy,
	discoverChests,
	type RawChest,
	SwappableChests,
} from "../src/lib/proxies/Chest.svelte";
import { XMLManager } from "../src/lib/workers/xml";

const item = (name: string, itemId: string): Item =>
	({
		"@_xsi:type": "Object",
		name,
		itemId,
		stack: 1,
		quality: 0,
		isRecipe: false,
		hasBeenInInventory: true,
	}) as Item;

const rawChest = (
	fields: Partial<Record<string, unknown>>,
	items = [item("Wood", "388"), item("Stone", "390")],
): RawChest =>
	({
		"@_xsi:type": "Chest",
		name: "Chest",
		itemId: 130,
		parentSheetIndex: 130,
		currentLidFrame: 131,
		stack: 1,
		quality: 0,
		isRecipe: false,
		hasBeenInInventory: true,
		playerChest: true,
		fridge: false,
		specialChestType: "None",
		playerChoiceColor: { R: 0, G: 170, B: 0, A: 255 },
		separateWalletItems: { SerializableDictionaryOfInt64Inventory: "" },
		items: { Item: items },
		...fields,
	}) as unknown as RawChest;

const load = (raw: RawChest) => {
	const save = {
		locations: {
			GameLocation: [
				{
					name: "Farm",
					objects: {
						item: [
							{ key: { Vector2: { X: 3, Y: 4 } }, value: { Object: raw } },
						],
					},
					buildings: "",
				},
			],
		},
	} as unknown as Save;
	let chests = [] as ReturnType<typeof discoverChests>;
	const cleanup = $effect.root(() => {
		chests = discoverChests(save);
	});
	const chest = chests[0];
	if (!chest) throw new Error("Expected a chest");
	return { chest, cleanup };
};

const type = (name: string) => {
	const found = SwappableChests.find((t) => t.name === name);
	if (!found) throw new Error(name);
	return found;
};

const itemNames = (raw: RawChest) =>
	raw.items && typeof raw.items !== "string"
		? raw.items.Item.map((i) => (i as Item).name)
		: [];

describe("changing a chest's type", () => {
	it("converts a Chest to a Stone Chest, keeping its items and colour", () => {
		const raw = rawChest({});
		const { chest, cleanup } = load(raw);
		expect(chest.type?.name).toBe("Chest");

		chest.setType(type("Stone Chest"));
		expect(raw).toMatchObject({
			name: "Stone Chest",
			itemId: "232",
			parentSheetIndex: 232,
			currentLidFrame: 233,
			specialChestType: "None",
			playerChoiceColor: { R: 0, G: 170, B: 0 },
		});
		expect(chest.inventory.slotCount).toBe(36);
		expect(itemNames(raw)).toEqual(["Wood", "Stone"]);
		expect(chest.label).toBe("Farm - Stone Chest (3, 4)");
		cleanup();
	});

	it("expands a Chest to a 70-slot Big Chest, leaving items where they are", () => {
		const raw = rawChest({});
		const { chest, cleanup } = load(raw);
		const stone = chest.inventory.take(1);
		if (stone) chest.inventory.place(20, stone);

		chest.setType(type("Big Chest"));
		expect(raw).toMatchObject({
			name: "Big Chest",
			itemId: "BigChest",
			parentSheetIndex: 304,
			currentLidFrame: 305,
			specialChestType: "BigChest",
		});
		expect(chest.inventory.slotCount).toBe(70);
		expect(chest.inventory.usedSlots).toBe(2);
		expect(chest.inventory.get(20)).toBe(stone);
		expect(itemNames(raw)).toEqual(["Wood", "Stone"]);

		// Big Chest <-> Big Stone Chest is the same size, so it's allowed
		chest.setType(type("Big Stone Chest"));
		expect(raw).toMatchObject({
			itemId: "BigStoneChest",
			parentSheetIndex: 328,
		});
		expect(chest.inventory.slotCount).toBe(70);
		cleanup();
	});

	it("only converts down to a smaller chest when every item fits", () => {
		const many = Array.from({ length: 40 }, (_, i) =>
			item(`Thing ${i}`, "388"),
		);
		const raw = rawChest(
			{
				name: "Big Chest",
				itemId: "BigChest",
				parentSheetIndex: 304,
				specialChestType: "BigChest",
			},
			many,
		);
		const { chest, cleanup } = load(raw);
		expect(chest.inventory.slotCount).toBe(70);

		// 40 items won't fit in 36 slots: refused, nothing changes
		expect(() => chest.setType(type("Chest"))).toThrow("won't fit");
		expect(raw).toMatchObject({ itemId: "BigChest", name: "Big Chest" });
		expect(chest.inventory.slotCount).toBe(70);
		expect(itemNames(raw)).toHaveLength(40);

		// Once enough are removed (even from the far end), it shrinks, closing gaps
		for (let i = 0; i < 4; i++) chest.inventory.delete(i);
		chest.inventory.delete(69);
		chest.setType(type("Chest"));
		expect(chest.inventory.slotCount).toBe(36);
		expect(chest.inventory.usedSlots).toBe(36);
		expect(itemNames(raw)).toEqual(many.slice(4).map((i) => i.name));
		cleanup();
	});

	it("expands a Mini-Shipping Bin to a 36-slot Chest", () => {
		const raw = rawChest({
			name: "Mini-Shipping Bin",
			itemId: 248,
			parentSheetIndex: 248,
			specialChestType: "MiniShippingBin",
		});
		const { chest, cleanup } = load(raw);
		expect(chest.type).toBeUndefined();
		expect(chest.isMiniShippingBin).toBe(true);
		expect(chest.inventory.slotCount).toBe(9);

		chest.expandMiniShippingBin();
		expect(raw).toMatchObject({
			name: "Chest",
			itemId: "130",
			specialChestType: "None",
		});
		expect(chest.inventory.slotCount).toBe(36);
		expect(chest.isMiniShippingBin).toBe(false);
		expect(itemNames(raw)).toEqual(["Wood", "Stone"]);
		cleanup();
	});

	it("won't expand a Mini-Shipping Bin holding items for separate wallets", () => {
		const raw = rawChest({
			name: "Mini-Shipping Bin",
			itemId: 248,
			parentSheetIndex: 248,
			specialChestType: "MiniShippingBin",
			separateWalletItems: {
				SerializableDictionaryOfInt64Inventory: {
					item: {
						key: { long: 123 },
						value: { Inventory: { Item: [item("Parsnip", "24")] } },
					},
				},
			},
		});
		const { chest, cleanup } = load(raw);
		expect(chest.isMiniShippingBin).toBe(true);
		expect(chest.hasSeparateWalletItems).toBe(true);
		expect(() => chest.expandMiniShippingBin()).toThrow("separate wallets");
		expect(raw).toMatchObject({ itemId: 248, name: "Mini-Shipping Bin" });
		expect(chest.inventory.slotCount).toBe(9);
		cleanup();
	});

	it("leaves the kitchen fridge and machines' storage alone", () => {
		// The kitchen fridge is saved as a placed Chest (130), like an auto-grabber's storage
		const save = {
			locations: {
				GameLocation: [
					{
						name: "FarmHouse",
						fridge: rawChest({}),
						objects: {
							item: [
								{
									key: { Vector2: { X: 2, Y: 1 } },
									value: {
										Object: {
											"@_xsi:type": "Object",
											name: "Auto-Grabber",
											heldObject: rawChest({}),
										},
									},
								},
							],
						},
						buildings: "",
					},
				],
			},
		} as unknown as Save;
		let kinds: string[] = [];
		const cleanup = $effect.root(() => {
			const chests = discoverChests(save);
			kinds = chests.map((chest) => chest.metadata.kind);
			for (const chest of chests) {
				expect(chest.type).toBeUndefined();
				expect(chest.isMiniShippingBin).toBe(false);
				expect(() => chest.setType(type("Big Chest"))).toThrow(
					"can't be changed",
				);
				expect(chest.inventory.slotCount).toBe(36);
			}
		});
		expect(kinds).toEqual(["fridge", "machine"]);
		cleanup();
	});

	it("leaves other containers (fridges, Junimo Chests) without a type to change", () => {
		const junimo = rawChest({
			name: "Junimo Chest",
			itemId: 256,
			specialChestType: "JunimoChest",
		});
		// Junimo Chests aren't listed at all (the game shows a shared inventory)
		expect(() => load(junimo)).toThrow("Expected a chest");

		let chest!: ChestProxy;
		const cleanup = $effect.root(() => {
			chest = new ChestProxy(junimo, {
				id: "junimo",
				label: "Junimo Chest",
				kind: "chest",
				location: "Farm",
			});
		});
		expect(chest.type).toBeUndefined();
		expect(chest.isMiniShippingBin).toBe(false);
		cleanup();
	});

	it("writes the new type to the save file", () => {
		const raw = rawChest({});
		const { chest, cleanup } = load(raw);
		chest.setType(type("Big Stone Chest"));
		const xml = new TextDecoder().decode(
			new XMLManager().stringify({ SaveGame: { chest: raw } } as never),
		);
		expect(xml).toContain("<itemId>BigStoneChest</itemId>");
		expect(xml).toContain("<specialChestType>BigChest</specialChestType>");
		expect(xml).toContain("<currentLidFrame>329</currentLidFrame>");
		cleanup();
	});
});
