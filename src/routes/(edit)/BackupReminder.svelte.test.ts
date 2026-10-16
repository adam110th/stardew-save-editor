import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, test, vi } from "vitest";
import BackupReminder, { backupReminderSkipped } from "./BackupReminder.svelte";

describe("Backup reminder", () => {
	beforeEach(() => localStorage.clear());

	const show = () => {
		const onconfirm = vi.fn();
		const oncancel = vi.fn();
		render(BackupReminder, {
			filename: "Wookies_450650579",
			onconfirm,
			oncancel,
		});
		return { onconfirm, oncancel };
	};

	test("names the save folder to back up", () => {
		show();
		expect(screen.getByTestId("backup-reminder").textContent).toContain(
			"Wookies_450650579",
		);
	});

	test("downloads only when confirmed", async () => {
		const { onconfirm, oncancel } = show();
		await fireEvent.click(screen.getByTestId("backup-cancel"));
		expect(oncancel).toHaveBeenCalledOnce();
		expect(onconfirm).not.toHaveBeenCalled();

		await fireEvent.click(screen.getByTestId("backup-confirm"));
		expect(onconfirm).toHaveBeenCalledOnce();
		// Still reminds next time unless asked not to
		expect(backupReminderSkipped()).toBe(false);
	});

	test("Escape cancels", async () => {
		const { oncancel } = show();
		await fireEvent.keyDown(window, { key: "Escape" });
		expect(oncancel).toHaveBeenCalledOnce();
	});

	test("'Don't remind me again' is remembered", async () => {
		const { onconfirm } = show();
		await fireEvent.click(screen.getByTestId("backup-dont-remind"));
		await fireEvent.click(screen.getByTestId("backup-confirm"));
		expect(onconfirm).toHaveBeenCalledOnce();
		expect(backupReminderSkipped()).toBe(true);
	});
});
