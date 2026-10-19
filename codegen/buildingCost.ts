export interface BuildMaterial {
	/** Item name, as used by generated/iteminfo.json */
	item: string;
	amount: number;
}

/**
    Map a building's `BuildMaterials` from Data/Buildings.json to item names.
    Materials use qualified IDs like `(O)388`; ones that aren't objects are dropped.
    A material without an amount is shown as one. The JSON can hold nulls.
*/
export function getBuildMaterials(
	materials:
		| { ItemId?: string | null; Amount?: number | null }[]
		| null
		| undefined,
	objectNames: ReadonlyMap<string, string>,
): BuildMaterial[] {
	return (materials ?? []).flatMap(({ ItemId, Amount }) => {
		const id = ItemId?.replace(/^\(O\)/, "");
		const item = id && objectNames.get(id);
		return item ? [{ item, amount: Amount ?? 1 }] : [];
	});
}
