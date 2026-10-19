import { readFile } from "node:fs/promises";
import { fireEvent, render, within } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { CCRoom } from "$lib/bundleSideEffects";
import { Raw } from "$lib/proxies";
import { type Bundle, BundleName } from "$lib/proxies/CommunityBundles.svelte";
import { MailFlag } from "$lib/proxies/Mail.svelte";
import { SaveManager } from "../src/lib/SaveManager.svelte";
import BundleCard from "../src/routes/(edit)/bundles/Bundle.svelte";
import JojaBundles from "../src/routes/(edit)/bundles/JojaBundles.svelte";

describe("Community Center bundles", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		const file = await readFile("tests/TestSave");
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([file], "TestSave"));
		});
		await promise;
		flushSync();
		cleanup();
	});

	const loaded = () => {
		const save = saveManager.save;
		const bundles = save?.communityBundles;
		const cc = save?.locations.find((l) => l[Raw].name === "CommunityCenter");
		if (!save || !bundles || !cc) throw new Error("Save not loaded");
		return { save, bundles, cc };
	};

	const byName = (name: string): Bundle => {
		const bundle = [...loaded().bundles.values()].find((b) => b.name === name);
		if (!bundle) throw new Error(`No ${name} bundle`);
		return bundle;
	};

	/** The bundle's slots in the save's `bundles` */
	const slots = (bundle: Bundle) =>
		loaded().cc[Raw].bundles?.item.find((kv) => kv.key.int === bundle.id)?.value
			.ArrayOfBoolean.boolean;

	const reward = (id: number) =>
		loaded().cc[Raw].bundleRewards?.item.find((kv) => kv.key.int === id)?.value
			.boolean;

	it("completes a bundle like the game does, ticking every slot", () => {
		// Quality Crops needs any 3 of its 4 items
		const bundle = byName("Quality Crops");
		expect(bundle.requiredItemCount).toBeLessThan(bundle.requiredItems.length);
		// The game keeps three slots per item
		expect(slots(bundle)).toHaveLength(bundle.requiredItems.length * 3);

		bundle.complete();
		flushSync();
		expect(bundle.completed).toBe(true);
		expect(bundle.requiredItems.every((i) => i.submitted)).toBe(true);
		// The game only counts a bundle as complete once every slot is ticked
		expect(slots(bundle)?.every(Boolean)).toBe(true);

		bundle.clear();
		flushSync();
		expect(bundle.completed).toBe(false);
		expect(bundle.requiredItems.some((i) => i.submitted)).toBe(false);
		expect(slots(bundle)?.some(Boolean)).toBe(false);
	});

	it("leaves a finished bundle's reward to collect, and takes it back when cleared", async () => {
		const bundle = byName("Spring Crops");
		expect(reward(bundle.id)).toBe(false);

		bundle.complete();
		flushSync();
		await tick();
		expect(reward(bundle.id)).toBe(true);

		bundle.clear();
		flushSync();
		await tick();
		expect(reward(bundle.id)).toBe(false);
	});

	it("doesn't touch rewards for bundles that didn't change", async () => {
		const spring = byName("Spring Crops");
		const summer = byName("Summer Crops");

		spring.complete();
		flushSync();
		await tick();

		expect(reward(spring.id)).toBe(true);
		expect(reward(summer.id)).toBe(false);
	});

	it("never leaves a reward waiting for the Missing Bundle, which has none", async () => {
		const { bundles } = loaded();
		const missing = bundles.get(BundleName.Missing);
		if (!missing) throw new Error("No Missing Bundle");
		expect(missing.reward?.item).toBeUndefined();

		for (const bundle of bundles.values())
			if (bundle.room === CCRoom.AbandonedJojaMart) bundle.complete();
		flushSync();
		await tick();

		expect(missing.completed).toBe(true);
		expect(reward(BundleName.Missing)).toBe(false);
	});

	it("leaves a reward to collect when the save has no bundleRewards yet", async () => {
		// An empty <bundleRewards /> parses as ""
		const { cc } = loaded();
		(cc[Raw] as { bundleRewards: unknown }).bundleRewards = "";
		const bundle = byName("Spring Crops");

		bundle.complete();
		flushSync();
		await tick();
		expect(cc[Raw].bundleRewards?.item).toEqual([
			{ key: { int: bundle.id }, value: { boolean: true } },
		]);
	});

	it("updates the joja room flags when membership changes", async () => {
		const { save, bundles } = loaded();
		for (const bundle of bundles.values())
			if (bundle.room === CCRoom.Vault) bundle.complete();
		flushSync();
		await tick();
		expect(save.player.mailReceived.has(MailFlag.ccVault)).toBe(true);
		expect(save.player.mailReceived.has(MailFlag.jojaVault)).toBe(false);

		save.player.mailReceived.add(MailFlag.JojaMember);
		flushSync();
		await tick();
		expect(save.player.mailReceived.has(MailFlag.jojaVault)).toBe(true);

		save.player.mailReceived.delete(MailFlag.JojaMember);
		flushSync();
		await tick();
		expect(save.player.mailReceived.has(MailFlag.jojaVault)).toBe(false);
	});

	it("shows quantities and qualities, and completes from the card button", async () => {
		const bundle = byName("Quality Crops");
		const { container } = render(BundleCard, { bundle });

		const quantities = within(container).getAllByTestId("bundle-item-quantity");
		expect(quantities[0]?.textContent).toBe("5×");
		const star = within(container).getAllByTestId("bundle-item-quality")[0];
		expect(star?.getAttribute("title")).toBe("Gold quality or better");
		expect(within(container).getByTestId("bundle-pick").textContent).toBe(
			"(any 3 of 4)",
		);

		await fireEvent.click(within(container).getByTestId("bundle-toggle"));
		expect(bundle.completed).toBe(true);
		expect(
			within(container).getByTestId("bundle-progress").textContent,
		).toContain(`${bundle.requiredItemCount}/${bundle.requiredItemCount}`);

		await fireEvent.click(within(container).getByTestId("bundle-toggle"));
		expect(bundle.completed).toBe(false);
	});

	it("shows a Vault bundle's price in gold", () => {
		const { container } = render(BundleCard, { bundle: byName("2,500g") });
		expect(
			within(container).getByTestId("bundle-required-items").textContent,
		).toContain("2,500g");
	});

	it("names each item's checkbox after the item", () => {
		const bundle = byName("Quality Crops");
		const { container } = render(BundleCard, { bundle });
		const boxes = within(container).getAllByRole("checkbox", {
			name: / donated$/,
			hidden: true,
		});
		expect(boxes).toHaveLength(bundle.requiredItems.length);
		const labels = boxes.map((box) => box.getAttribute("aria-label"));
		expect(labels).toContain("Parsnip donated");
		expect(labels).not.toContain("undefined donated");
	});

	it("only ticks a Joja project once every bundle in its room is done", async () => {
		const { save, bundles } = loaded();
		const { container } = render(JojaBundles, { save, bundles });
		const busRow = container.querySelector('[data-project-name="Bus"]');
		const bus = busRow?.querySelector("input") as HTMLInputElement;

		// One of the four Vault bundles isn't enough
		const vault = [...bundles.values()].filter((b) => b.room === CCRoom.Vault);
		vault[0]?.complete();
		flushSync();
		await tick();
		expect(bus.checked).toBe(false);

		await fireEvent.click(bus);
		expect(vault.every((b) => b.completed)).toBe(true);
		expect(bus.checked).toBe(true);
	});
});

describe("Community Center side effects in a co-op save", () => {
	mockIDB();

	/** The test save plus a farmhand; both are Joja members who bought the bus without ticking bundles */
	const loadJojaCoop = async () => {
		const flags = ["JojaMember", "jojaVault", "ccVault"]
			.map((flag) => `<string>${flag}</string>`)
			.join("");
		const xml = (await readFile("tests/TestSave"))
			.toString("utf-8")
			.replace("<mailReceived>", `<mailReceived>${flags}`);
		const start = xml.indexOf("<player>") + "<player>".length;
		const farmhand = xml
			.slice(start, xml.indexOf("</player>"))
			.replace("<name>Test</name>", "<name>Hand</name>")
			.replace(
				/<UniqueMultiplayerID>\d+<\/UniqueMultiplayerID>/,
				"<UniqueMultiplayerID>123456789</UniqueMultiplayerID>",
			);
		const coop = xml.replace(
			"<farmhands />",
			`<farmhands><Farmer>${farmhand}</Farmer></farmhands>`,
		);

		let saveManager!: SaveManager;
		let promise: Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
			promise = saveManager.import(new File([coop], "TestSave"));
		});
		await promise;
		flushSync();
		const save = saveManager.save;
		if (!save?.communityBundles) throw new Error("Save not loaded");
		return { save, bundles: save.communityBundles, cleanup };
	};

	it("keeps bought Joja projects when switching farmer or editing another room", async () => {
		const { save, bundles, cleanup } = await loadJojaCoop();
		const bought = () =>
			save.players.map(
				(p) =>
					p.mailReceived.has(MailFlag.jojaVault) &&
					p.mailReceived.has(MailFlag.ccVault),
			);
		expect(bought()).toEqual([true, true]);

		save.nextFarmer();
		flushSync();
		await tick();
		expect(save.player.name).toBe("Hand");
		expect(bought()).toEqual([true, true]);

		// Finishing one Pantry bundle doesn't finish the room, so the Vault is left alone
		const spring = [...bundles.values()].find((b) => b.name === "Spring Crops");
		spring?.complete();
		flushSync();
		await tick();
		expect(spring?.completed).toBe(true);
		expect(bought()).toEqual([true, true]);

		spring?.clear();
		flushSync();
		await tick();
		expect(bought()).toEqual([true, true]);
		cleanup();
	});
});
