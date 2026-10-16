import { calculateEdibility, calculatePrice } from "$lib/ItemQuality";
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

/** Set an item's quality, and recalculate its price & edibility to match */
export function setItemQuality(item: ItemProxy, quality: number) {
	item.quality = quality;

	if ("price" in item && item.info?.price !== undefined) {
		item.price = calculatePrice(item.info.price, quality);
	}

	if ("edibility" in item && item.info && "edibility" in item.info) {
		const edibility = item.info.edibility;
		if (typeof edibility === "number")
			item.edibility = calculateEdibility(edibility, quality);
	}
}
