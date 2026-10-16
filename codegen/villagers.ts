import { readFile, writeFile } from "node:fs/promises";
import { characters } from "../src/lib/NPCs.js";
import { getJson } from "./wikiFetch.js";
import { parseVillagerWikitext, type VillagerInfo } from "./wikiVillager.js";

// Villager descriptions and loved gifts aren't in the game's data files, so they come from
// the Stardew Valley Wiki (https://stardewvalleywiki.com, CC BY-NC-SA 3.0).
const api = "https://stardewvalleywiki.com/mediawiki/api.php";

const items = new Set(
	(
		JSON.parse(await readFile("./generated/iteminfo.json", "utf-8")) as [
			string,
			unknown,
		][]
	).map(([name]) => name),
);

const villagers: Record<string, VillagerInfo> = {};
for (const name of characters) {
	const json = await getJson(
		`${api}?action=parse&prop=wikitext&format=json&section=0&redirects=1&page=${encodeURIComponent(name)}`,
	);
	if (!json.parse) throw new Error(`${name}: wiki page not found`);
	villagers[name] = parseVillagerWikitext(json.parse.wikitext["*"], items);
}

await writeFile("./generated/villagers.json", JSON.stringify(villagers));
console.log(`Wrote ${Object.keys(villagers).length} villagers`);
