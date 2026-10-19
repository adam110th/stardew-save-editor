import { describe, expect, it } from "vitest";
import { getBuildMaterials } from "../codegen/buildingCost";

const names = new Map([
	["388", "Wood"],
	["390", "Stone"],
]);

describe("building costs", () => {
	it("maps qualified and unqualified object IDs to item names", () => {
		expect(
			getBuildMaterials(
				[
					{ ItemId: "(O)388", Amount: 300 },
					{ ItemId: "390", Amount: 100 },
				],
				names,
			),
		).toEqual([
			{ item: "Wood", amount: 300 },
			{ item: "Stone", amount: 100 },
		]);
	});

	it("drops unknown or non-object materials", () => {
		expect(
			getBuildMaterials(
				[{ ItemId: "(BC)10", Amount: 1 }, { ItemId: "(O)999" }, {}],
				names,
			),
		).toEqual([]);
	});

	it("counts one of a material without an amount", () => {
		expect(
			getBuildMaterials(
				[{ ItemId: "(O)388" }, { ItemId: "(O)390", Amount: null }],
				names,
			),
		).toEqual([
			{ item: "Wood", amount: 1 },
			{ item: "Stone", amount: 1 },
		]);
		expect(getBuildMaterials([{ ItemId: null, Amount: 5 }], names)).toEqual([]);
	});

	it("handles buildings without materials", () => {
		expect(getBuildMaterials(null, names)).toEqual([]);
		expect(getBuildMaterials(undefined, names)).toEqual([]);
	});
});
