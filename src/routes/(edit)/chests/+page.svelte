<script lang="ts">
	import {
		type ChestGroupId,
		ChestGroups,
		chestColor,
		chestGroup,
	} from "$lib/chestGroups";
	import { type ChestProxy, SwappableChests } from "$lib/proxies/Chest.svelte";
	import { Item } from "$lib/proxies/Item.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import {
		canHaveQuality,
		QualityLevels,
		setItemQuality,
	} from "$lib/setItemQuality";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import ItemSlot from "../inventory/ItemSlot.svelte";
	import ItemSprite from "../inventory/ItemSprite.svelte";
	import ItemView from "../inventory/ItemView.svelte";

	const toastManager = getToastManager();
	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");

	// Each group lists all of its chests at once
	const groups = $derived(
		ChestGroups.map((group) => ({
			...group,
			chests: save.chests.filter((chest) => chestGroup(chest) === group.id),
		})),
	);

	let selectedGroupId = $state<ChestGroupId>("chests");
	let selectedGroup = $derived(
		groups.find((g) => g.id === selectedGroupId) ?? groups[0],
	);

	let selectedChest = $state<ChestProxy | undefined>(
		save.chests.find((chest) => chestGroup(chest) === "chests"),
	);
	let selectedIndex = $state(0);
	let selectedItem = $derived(selectedChest?.inventory.get(selectedIndex));

	let chestList = $state<HTMLElement>();

	const selectGroup = (id: ChestGroupId) => {
		selectedGroupId = id;
		if (chestList) chestList.scrollTop = 0;
		selectedChest = groups.find((g) => g.id === id)?.chests[0];
		selectedIndex = 0;
	};

	const select = (chest: ChestProxy, index: number) => {
		selectedChest = chest;
		selectedIndex = index;
	};

	const slots = (chest: ChestProxy) =>
		Array.from({ length: chest.inventory.slotCount }, (_, index) => ({
			index,
			item: chest.inventory.get(index),
		}));

	/** Section headings; chests with the same label get a number to tell them apart */
	const headings = $derived.by(() => {
		const result = new Map<ChestProxy, string>();
		const seen = new Map<string, number>();
		const counts = new Map<string, number>();
		for (const chest of selectedGroup?.chests ?? [])
			counts.set(chest.label, (counts.get(chest.label) ?? 0) + 1);
		for (const chest of selectedGroup?.chests ?? []) {
			const label = chest.label;
			const n = (seen.get(label) ?? 0) + 1;
			seen.set(label, n);
			result.set(
				chest,
				(counts.get(label) ?? 0) > 1 ? `${label} #${n}` : label,
			);
		}
		return result;
	});

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

	/** Swap a chest for another kind (e.g. Stone Chest, or a 70-slot Big Chest) */
	const changeType = (chest: ChestProxy, itemId: string) => {
		const type = SwappableChests.find((t) => t.itemId === itemId);
		if (!type || type === chest.type) return;
		try {
			chest.setType(type);
			if (chest === selectedChest && selectedIndex >= type.capacity)
				selectedIndex = 0;
			toastManager.add(new Toast(`Changed to a ${type.name}`, "success"));
		} catch (e) {
			toastManager.add(
				new Toast(e instanceof Error ? e.message : String(e), "failure"),
			);
		}
	};

	const expandBin = (chest: ChestProxy) => {
		chest.expandMiniShippingBin();
		toastManager.add(new Toast("Expanded to a 36-slot Chest", "success"));
	};

	/** Set every item that can have a quality to `quality`, in every chest listed */
	const setAllQuality = (quality: number, name: string) => {
		let changed = 0;
		for (const chest of selectedGroup?.chests ?? []) {
			for (const item of chest.inventory.values()) {
				if (!item || !canHaveQuality(item)) continue;
				setItemQuality(item, quality);
				changed++;
			}
		}
		const where = selectedGroup?.name.toLowerCase() ?? "these chests";
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
{:else}
	<UiContainer>
		<h3>Chests</h3>
		<label class="picker">
			<span hidden>Container group</span>
			<UiSelect
				value={selectedGroupId}
				onchange={(e) =>
					selectGroup(
						(e.currentTarget as HTMLSelectElement).value as ChestGroupId,
					)}
				data-testid="chest-group"
			>
				{#each groups as group (group.id)}
					<option value={group.id}>{group.name} ({group.chests.length})</option>
				{/each}
			</UiSelect>
		</label>
		<div class="bulk-quality" data-testid="chest-bulk-quality">
			<small>Change the quality of every item listed:</small>
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
		</div>
	</UiContainer>

	<UiContainer>
		<div class="chest-list" data-testid="chest-list" bind:this={chestList}>
			{#each selectedGroup?.chests ?? [] as chest (chest.metadata.id)}
				{@const color = chestColor(chest)}
				{@const chestIndex = save.chests.indexOf(chest)}
				<section
					class="chest"
					class:colored={color}
					style:--chest-color={color?.css}
					data-testid="chest-section"
				>
					<header>
						<h4>{headings.get(chest)}</h4>
						<small>
							{chest.inventory.usedSlots} / {chest.inventory.slotCount} occupied
							slots
						</small>
					</header>
					{#if chest.type}
						<label class="chest-type">
							<small
								title="A smaller chest type is only available when all the items fit, so nothing is lost"
								>Chest type:</small
							>
							<select
								value={chest.type.itemId}
								onchange={(e) => {
									changeType(chest, e.currentTarget.value);
									// Show the real type if the change was refused
									e.currentTarget.value = chest.type?.itemId ?? "";
								}}
								data-testid={`chest-${chestIndex}-type`}
							>
								{#each SwappableChests as type (type.itemId)}
									<option
										value={type.itemId}
										disabled={chest.inventory.usedSlots > type.capacity}
										>{type.name} ({type.capacity} slots)</option
									>
								{/each}
							</select>
						</label>
					{:else if chest.isMiniShippingBin}
						<div class="chest-type">
							<button
								type="button"
								onclick={() => expandBin(chest)}
								data-testid={`chest-${chestIndex}-expand`}
								title="It keeps its items, but no longer adds them to the nightly shipment"
							>
								Expand to 36 slots (becomes a regular Chest)
							</button>
						</div>
					{/if}
					<div class="item-grid">
						{#each slots(chest) as { index, item }}
							<ItemSlot
								active={chest === selectedChest && index === selectedIndex}
								data-testid={`chest-${chestIndex}-item-${index}`}
								onclick={() => select(chest, index)}
							>
								<div class="item">
									<ItemSprite {item} />
								</div>
							</ItemSlot>
						{/each}
					</div>
				</section>
			{:else}
				<p class="empty">
					No {selectedGroup?.name.toLowerCase()} in this save.
				</p>
			{/each}
		</div>
	</UiContainer>

	{#if selectedChest}
		<UiContainer>
			<small class="editing"
				>Editing: {headings.get(selectedChest) ?? selectedChest.label}</small
			>
			<ItemView {selectedItem} {selectedIndex} {createItem} {deleteItem} />
		</UiContainer>
	{/if}
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

	/* All the group's chests, scrolling within a 1920x1080 screen */
	.chest-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: max(20rem, calc(100dvh - 590px));
		overflow-y: auto;
		padding-right: 4px;
	}

	.chest {
		padding: 6px 8px 8px;
		border-radius: 6px;
		border: 2px solid #b14e0544;
		background: #fff3dc66;
	}

	/* Tinted with the colour picked for the chest in-game */
	.chest.colored {
		border-color: var(--chest-color);
		background: color-mix(in srgb, var(--chest-color) 45%, #ffe7c2);
	}

	.chest header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 4px;
	}

	.chest-type {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.chest-type select,
	.chest-type button {
		font: inherit;
		font-size: 0.85em;
		padding: 1px 4px;
		border: solid 2px #9c613b;
		border-radius: 4px;
		background-color: #f9bb65;
		color: inherit;
		cursor: pointer;
	}

	.chest h4 {
		margin: 0;
	}

	.empty {
		opacity: 0.7;
	}

	.editing {
		display: block;
		margin-bottom: 4px;
		opacity: 0.8;
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
