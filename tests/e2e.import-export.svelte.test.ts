import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import { assertXmlEqual } from "./helpers/xmlDiff";

// helpers moved to tests/helpers/xmlDiff.ts

describe("Import/Export roundtrip", () => {
	mockIDB();
	let saveManager: SaveManager;
	let originalXml: string;

	beforeEach(async () => {
		const fileBlob = await readFile("tests/TestSave");
		originalXml = fileBlob.toString("utf-8");
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([fileBlob], "TestSave"));
		});
		await promise;
		cleanup();
	});

	it("exports identical XML after immediate re-export", async () => {
		const blob = await saveManager.export(true);
		expect(blob.size).toBeGreaterThan(0);
		expect(blob.type).toBe("application/octet-stream");
		const exportedXml = await blob.text();
		assertXmlEqual(originalXml, exportedXml);
		expect(true).toBe(true);
	});

	it("keeps number-like text as written, such as a farm called 007", async () => {
		const xml = originalXml
			.replace("<farmName>Test</farmName>", "<farmName>007</farmName>")
			.replace(
				"<favoriteThing>Unit Tests</favoriteThing>",
				"<favoriteThing>0x1F</favoriteThing>",
			)
			.replace("<name>Test</name>", "<name>1e3</name>");
		let manager!: SaveManager;
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			manager = new SaveManager();
			promise = manager.import(new File([xml], "TestSave"));
		});
		await promise;

		expect(manager.save?.player.farmName).toBe("007");
		const exportedXml = await (await manager.export(true)).text();
		assertXmlEqual(xml, exportedXml);
		cleanup();
	});
});
