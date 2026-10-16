<script lang="ts">
	import { Item } from "$lib/proxies/Item.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import {
		canHaveQuality,
		QualityLevels,
		setItemQuality,
	} from "$lib/setItemQuality";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import ItemSlot from "../inventory/ItemSlot.svelte";
	import ItemSprite from "../inventory/ItemSprite.svelte";
	import ItemView from "../inventory/ItemView.svelte";

	const toastManager = getToastManager();
	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");

	let selectedChestIndex = $state(0);
	let selectedIndex = $state(0);
	let selectedChest = $derived(save.chests[selectedChestIndex]);
	let selectedItem = $derived(selectedChest?.inventory.get(selectedIndex));
	let gridSlots = $derived(
		selectedChest
			? Array.from(
					{ length: selectedChest.inventory.slotCount },
					(_, index) => ({
						index,
						item: selectedChest?.inventory.get(index),
					}),
				)
			: [],
	);

	const createItem = (name: string) => {
		if (!selectedChest) return;
		try {
			if (!name) {
				toastManager.add(
					new Toast("You must enter an item name first", "failure"),
				);
				return;
			}
			selectedChest.inventory.set(selectedIndex, Item.fromName(name));
		} catch (error) {
			toastManager.add(new Toast("Failed to create item", "failure"));
			throw error;
		}
	};

	const deleteItem = () => selectedChest?.inventory.delete(selectedIndex);

	let applyToAllChests = $state(false);

	/** Set every item that can have a quality to `quality`, in this chest or all of them */
	const setAllQuality = (quality: number, name: string) => {
		const chests = applyToAllChests ? save.chests : [selectedChest];
		let changed = 0;
		for (const chest of chests) {
			for (const item of chest?.inventory.values() ?? []) {
				if (!item || !canHaveQuality(item)) continue;
				setItemQuality(item, quality);
				changed++;
			}
		}
		const where = applyToAllChests ? "all chests" : "this chest";
		toastManager.add(
			changed
				? new Toast(
						`Set ${changed} item${changed === 1 ? "" : "s"} in ${where} to ${name} quality`,
						"success",
					)
				: new Toast(`No items in ${where} can have a quality`, "failure"),
		);
	};
</script>

{#if save.chests.length === 0}
	<UiContainer>
		<p>No editable chests were found in this save.</p>
	</UiContainer>
{:else if selectedChest}
	<UiContainer>
		<h3>Chests</h3>
		<label class="picker">
			<span hidden>Container</span>
			<UiSelect
				bind:value={selectedChestIndex}
				onchange={() => (selectedIndex = 0)}
			>
				{#each save.chests as chest, index}
					<option value={index}>{chest.metadata.label}</option>
				{/each}
			</UiSelect>
		</label>
		<small>
			{selectedChest.inventory.usedSlots} / {selectedChest.inventory.slotCount}
			occupied slots
		</small>
		<div class="bulk-quality" data-testid="chest-bulk-quality">
			<small>Change all item quality:</small>
			<div class="stars">
				{#each QualityLevels as { quality, name }}
					<button
						type="button"
						class={`star quality-${quality}`}
						title={`Set every item to ${name} quality`}
						aria-label={`Set every item to ${name} quality`}
						data-testid={`chest-quality-${quality}`}
						onclick={() => setAllQuality(quality, name)}
					>
						{quality === 0 ? "☆" : "★"}
					</button>
				{/each}
			</div>
			<label class="all-chests">
				<UiCheckbox
					bind:checked={applyToAllChests}
					data-testid="chest-quality-all"
				/>
				<small>Apply to all chests</small>
			</label>
		</div>
	</UiContainer>

	<UiContainer>
		<div class="item-grid">
			{#each gridSlots as { index, item }}
				<ItemSlot
					active={index === selectedIndex}
					data-testid={`chest-item-${index}`}
					onclick={() => (selectedIndex = index)}
				>
					<div class="item">
						<ItemSprite {item} />
					</div>
				</ItemSlot>
			{/each}
		</div>
	</UiContainer>

	<UiContainer>
		<ItemView {selectedItem} {selectedIndex} {createItem} {deleteItem} />
	</UiContainer>
{/if}

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bulk-quality {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		margin-top: 6px;
	}

	.stars {
		display: flex;
		gap: 2px;
	}

	.star {
		all: unset;
		cursor: pointer;
		font-size: 1.5rem;
		line-height: 1;
		padding: 0 2px;
		-webkit-text-stroke: 1px #0006;
		transition: transform 0.1s;
	}

	.star:hover,
	.star:focus-visible {
		transform: scale(1.25);
	}

	.quality-0 {
		color: #6f3b31;
		-webkit-text-stroke: 0;
	}

	.quality-1 {
		color: #c8d0d8;
	}

	.quality-2 {
		color: #ffd23f;
	}

	.quality-4 {
		color: #b56cff;
	}

	.all-chests {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.item-grid {
		display: grid;
		grid-template-columns: repeat(12, min-content);
		grid-auto-rows: 48px;
	}

	.item {
		position: relative;
		transition: transform 0.1s;
		cursor: pointer;
	}

	.item:hover {
		transform: scale(1.2);
		transform-origin: center;
	}
</style>
