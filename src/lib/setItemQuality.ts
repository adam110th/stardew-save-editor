import type { ItemProxy } from "$lib/proxies/items";

/** Quality levels the game uses: normal, silver, gold, iridium */
export const QualityLevels = [
	{ quality: 0, name: "Normal" },
	{ quality: 1, name: "Silver" },
	{ quality: 2, name: "Gold" },
	{ quality: 4, name: "Iridium" },
] as const;

/**
    Whether the game lets this item have a quality. Proxies only expose a
    quality for categories that use one (crops, fish, forage, artisan goods...).
*/
export const canHaveQuality = (item: ItemProxy | undefined) =>
	item?.quality !== undefined;

/**
    Set an item's quality. Its saved price and edibility stay as they are: the
    game stores the base values and applies quality itself when the item is sold
    or eaten, so scaling them here would apply it twice.
*/
export function setItemQuality(item: ItemProxy, quality: number) {
	item.quality = quality;
}
