import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import {
	SaveManager,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import {
	setToastManagerContext,
	ToastManager,
} from "../src/lib/ToastManager.svelte";
import uploadPage from "../src/routes/(home)/(upload)/+page.svelte";

describe("Upload page", () => {
	mockIDB();

	it("reports a file that looks compressed but isn't, and lets you pick another", async () => {
		let saveManager!: SaveManager;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
		});
		const toastManager = new ToastManager();
		const context = new Map<unknown, unknown>([
			...setSaveManagerContext(saveManager),
			...setToastManagerContext(toastManager),
		]);
		const page = render(uploadPage, { context });

		// A first byte of 0x78 ("x") marks a zlib-compressed save; pako throws a string
		const file = new File(["xyz, not a save"], "Farm_1");
		const input = page.getByLabelText("Save file") as HTMLInputElement;
		const transfer = new DataTransfer();
		transfer.items.add(file);
		input.files = transfer.files;
		await fireEvent.change(input);

		await waitFor(() => expect(toastManager.toasts).toHaveLength(1));
		expect(toastManager.toasts[0]?.icon).toBe("❌");
		expect(toastManager.toasts[0]?.message).toBeTruthy();
		await waitFor(() => expect(input.disabled).toBe(false));
		expect(page.getByTestId("upload-hint").textContent).not.toContain(
			"Uploading",
		);
		cleanup();
	});
});
