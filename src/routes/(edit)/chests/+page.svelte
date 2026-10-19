<script lang="ts">
	import { tick } from "svelte";
	import {
		type ChestGroupId,
		ChestGroups,
		chestColor,
		chestGroup,
	} from "$lib/chestGroups";
	import {
		moveItem,
		moveItems,
		type SlotRef,
		sameSlot,
		sortChest,
	} from "$lib/chestMoves";
	import {
		type ChestProxy,
		SwappableChests,
		searchChests,
	} from "$lib/proxies/Chest.svelte";
	import { Item } from "$lib/proxies/Item.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import {
		canHaveQuality,
		QualityLevels,
		setItemQuality,
	} from "$lib/setItemQuality";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import SortButton from "$lib/ui/SortButton.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
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

	let search = $state("");
	let searchResults = $derived(searchChests(save.chests, search));
	let showResults = $state(true);
	let searchBox: HTMLDivElement | undefined = $state();
	let searching = $derived(showResults && search.trim() !== "");
	let matches = $derived(new Set(searchResults.map((result) => result.item)));

	/** Items picked with Ctrl/Cmd+click, to drag several at once */
	let picked = $state<SlotRef[]>([]);
	const multiSelected = $derived(picked.length > 1);
	const isPicked = (chest: ChestProxy, index: number) =>
		picked.some((ref) => sameSlot(ref, { chest, index }));

	const selectGroup = (id: ChestGroupId) => {
		selectedGroupId = id;
		if (chestList) chestList.scrollTop = 0;
		selectedChest = groups.find((g) => g.id === id)?.chests[0];
		selectedIndex = 0;
		picked = [];
	};

	const select = (chest: ChestProxy, index: number, event?: MouseEvent) => {
		if (event?.ctrlKey || event?.metaKey) {
			// Only items can be picked; start from whatever was selected before
			if (!chest.inventory.get(index)) return;
			const next =
				picked.length || !selectedChest?.inventory.get(selectedIndex)
					? [...picked]
					: [{ chest: selectedChest, index: selectedIndex }];
			const at = next.findIndex((ref) => sameSlot(ref, { chest, index }));
			if (at >= 0) next.splice(at, 1);
			else next.push({ chest, index });
			picked = next;
		} else {
			picked = [];
		}
		selectedChest = chest;
		selectedIndex = index;
	};

	/** Show a search result: switch to its group, select it and scroll to its chest */
	const selectResult = async (chestIndex: number, slotIndex: number) => {
		const chest = save.chests[chestIndex];
		if (!chest) return;
		selectedGroupId = chestGroup(chest);
		selectedChest = chest;
		selectedIndex = slotIndex;
		picked = [];
		showResults = false;
		await tick();
		chestList
			?.querySelector(`[data-chest-index="${chestIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	};

	const clearSearch = () => {
		search = "";
		searchBox?.querySelector("input")?.focus();
	};

	// Drag and drop: one item onto a slot (moving or swapping), or onto a chest
	let dragging: SlotRef[] | undefined;

	const dragStart = (chest: ChestProxy, index: number, event: DragEvent) => {
		if (!chest.inventory.get(index)) return event.preventDefault();
		dragging =
			multiSelected && isPicked(chest, index)
				? [...picked]
				: [{ chest, index }];
		event.dataTransfer?.setData("text/plain", "chest-item");
		if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	};

	const allowDrop = (event: DragEvent) => {
		if (dragging) event.preventDefault();
	};

	const chestName = (chest: ChestProxy) => headings.get(chest) ?? chest.label;

	/** Drop several items into a chest's empty slots, or warn if they won't fit */
	const dropMany = (refs: SlotRef[], target: ChestProxy) => {
		const result = moveItems(refs, target);
		if (!result.ok) {
			// Keep the selection so it can be dropped somewhere with more room
			toastManager.add(
				new Toast(
					`${result.needed} items won't fit: ${chestName(target)} has ${result.free} free slot${result.free === 1 ? "" : "s"}`,
					"failure",
				),
			);
			return;
		}
		if (refs.length > 1) picked = result.moved;
		const first = result.moved[0];
		if (first) {
			selectedChest = first.chest;
			selectedIndex = first.index;
		}
	};

	const dropOnSlot = (chest: ChestProxy, index: number, event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const refs = dragging;
		dragging = undefined;
		const [from] = refs ?? [];
		if (!refs || !from) return;
		if (refs.length > 1) return dropMany(refs, chest);
		moveItem(from, { chest, index });
		picked = [];
		selectedChest = chest;
		selectedIndex = index;
	};

	const dropOnChest = (chest: ChestProxy, event: DragEvent) => {
		event.preventDefault();
		const refs = dragging;
		dragging = undefined;
		if (refs) dropMany(refs, chest);
	};

	const sort = (chest: ChestProxy) => {
		sortChest(chest);
		picked = [];
		toastManager.add(new Toast(`Sorted ${chestName(chest)}`, "success"));
	};

	const sortAll = () => {
		for (const chest of save.chests) sortChest(chest);
		picked = [];
		toastManager.add(
			new Toast(`Sorted all ${save.chests.length} chests`, "success"),
		);
	};

	const slots = (chest: ChestProxy) =>
		Array.from({ length: chest.inventory.slotCount }, (_, index) => ({
			index,
			item: chest.inventory.get(index),
		}));

	/**
	    Chest names, for every group (search results can be in any of them);
	    chests in a group with the same label get a number to tell them apart
	*/
	const headings = $derived.by(() => {
		const result = new Map<ChestProxy, string>();
		for (const group of groups) {
			const seen = new Map<string, number>();
			const counts = new Map<string, number>();
			for (const chest of group.chests)
				counts.set(chest.label, (counts.get(chest.label) ?? 0) + 1);
			for (const chest of group.chests) {
				const label = chest.label;
				const n = (seen.get(label) ?? 0) + 1;
				seen.set(label, n);
				result.set(
					chest,
					(counts.get(label) ?? 0) > 1 ? `${label} #${n}` : label,
				);
			}
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
		<div class="title">
			<h3>Chests</h3>
			<SortButton
				label="Sort all chests"
				onclick={sortAll}
				data-testid="sort-all-chests"
			/>
		</div>
		<div class="search" bind:this={searchBox}>
			<UiInput
				type="text"
				placeholder="Search all chests..."
				data-testid="chest-search"
				bind:value={search}
				onfocus={() => (showResults = true)}
				oninput={() => (showResults = true)}
				onkeydown={(event) => {
					if (event.key === "Escape" && search) {
						event.preventDefault();
						clearSearch();
					}
				}}
			/>
			{#if search}
				<button
					class="clear"
					type="button"
					aria-label="Clear search"
					title="Clear search"
					data-testid="chest-search-clear"
					onclick={clearSearch}
				>
					&times;
				</button>
			{/if}
		</div>
		{#if searching}
			{#if searchResults.length === 0}
				<small>No items found.</small>
			{:else}
				<small>
					{searchResults.length}
					{searchResults.length === 1 ? "match" : "matches"}
				</small>
				<div class="results">
					{#each searchResults as { chestIndex, slotIndex, chest, item }}
						<button
							class="result"
							class:active={chest === selectedChest &&
								slotIndex === selectedIndex}
							data-testid={`chest-search-result-${chestIndex}-${slotIndex}`}
							onclick={() => selectResult(chestIndex, slotIndex)}
						>
							<div class="result-sprite">
								<ItemSprite {item} />
							</div>
							<span class="result-name"
								>{item.name} &times;{item.amount ?? item.stack}</span
							>
							<span class="result-chest">{chestName(chest)}</span>
						</button>
					{/each}
				</div>
			{/if}
		{/if}
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

	<div class="workspace">
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
						data-chest-index={chestIndex}
						aria-label={headings.get(chest)}
						ondragover={allowDrop}
						ondrop={(e) => dropOnChest(chest, e)}
					>
						<header>
							<h4>{headings.get(chest)}</h4>
							<small
								class="used"
								title={`${chest.inventory.usedSlots} of ${chest.inventory.slotCount} slots occupied`}
							>
								{chest.inventory.usedSlots}/{chest.inventory.slotCount}
							</small>
							{#if chest.type}
								<select
									class="chest-type"
									value={chest.type.itemId}
									onchange={(e) => {
										changeType(chest, e.currentTarget.value);
										// Show the real type if the change was refused
										e.currentTarget.value = chest.type?.itemId ?? "";
									}}
									aria-label="Chest type"
									title="Chest type. A smaller type is only available when all the items fit, so nothing is lost"
									data-testid={`chest-${chestIndex}-type`}
								>
									{#each SwappableChests as type (type.itemId)}
										<option
											value={type.itemId}
											disabled={chest.inventory.usedSlots > type.capacity}
											>{type.name} ({type.capacity})</option
										>
									{/each}
								</select>
							{:else if chest.isMiniShippingBin}
								<button
									type="button"
									class="chest-type"
									onclick={() => expandBin(chest)}
									data-testid={`chest-${chestIndex}-expand`}
									title="Becomes a regular Chest. It keeps its items, but no longer adds them to the nightly shipment"
								>
									Expand to 36 slots
								</button>
							{/if}
							<SortButton
								label="Sort this chest"
								nativeTooltip
								onclick={() => sort(chest)}
								data-testid={`sort-chest-${chestIndex}`}
							/>
						</header>
						<div class="item-grid">
							{#each slots(chest) as { index, item }}
								<ItemSlot
									active={multiSelected
										? isPicked(chest, index)
										: chest === selectedChest && index === selectedIndex}
									{item}
									data-testid={`chest-${chestIndex}-item-${index}`}
									onclick={(e) => select(chest, index, e)}
									ondragover={allowDrop}
									ondrop={(e) => dropOnSlot(chest, index, e)}
								>
									<div
										class="item"
										class:dimmed={searching && item && !matches.has(item)}
										draggable={item !== undefined}
										ondragstart={(e) => dragStart(chest, index, e)}
										ondragend={() => (dragging = undefined)}
										role="presentation"
										data-testid={`chest-${chestIndex}-drag-${index}`}
									>
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

		{#if multiSelected}
			<div class="side">
				<UiContainer>
					<div class="picked" data-testid="chest-multi-selection">
						<strong>{picked.length} items selected</strong>
						<small>
							Drag them onto another chest to move them together, or Ctrl+click
							an item to add or remove it.
						</small>
						<button type="button" onclick={() => (picked = [])}>
							Clear selection
						</button>
					</div>
				</UiContainer>
			</div>
		{:else if selectedChest}
			<div class="side">
				<UiContainer>
					<small class="editing"
						>Editing: {headings.get(selectedChest) ??
							selectedChest.label}</small
					>
					<ItemView {selectedItem} {selectedIndex} {createItem} {deleteItem} />
				</UiContainer>
			</div>
		{/if}
	</div>
{/if}

<style>
	.title {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.search {
		position: relative;
		margin-bottom: 4px;
	}

	.search :global(input) {
		width: 100%;
		box-sizing: border-box;
		padding-right: 28px;
		font-size: large;
	}

	.clear {
		all: unset;
		position: absolute;
		top: 50%;
		right: 6px;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		line-height: 20px;
		text-align: center;
		font-size: 22px;
		font-weight: bold;
		color: #6f3b31;
		border-radius: 4px;
		cursor: pointer;
	}

	.clear:hover,
	.clear:focus-visible {
		background-color: rgba(0, 0, 0, 0.12);
	}

	.results {
		display: flex;
		flex-direction: column;
		max-height: 12rem;
		overflow-y: auto;
		margin-top: 4px;
		margin-bottom: 8px;
	}

	.result {
		all: unset;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 4px;
		border-bottom: #5b2b2a 1px solid;
		cursor: pointer;
	}

	.result:hover,
	.result:focus-visible,
	.result.active {
		background-color: rgba(255, 255, 255, 0.4);
	}

	.result-sprite {
		position: relative;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.result-name {
		flex: 1;
	}

	.result-chest {
		font-size: small;
		opacity: 0.8;
	}

	.picked {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
	}

	.picked button {
		font: inherit;
		font-size: 0.85em;
		padding: 2px 8px;
		border: solid 2px #9c613b;
		border-radius: 4px;
		background-color: #f9bb65;
		color: inherit;
		cursor: pointer;
	}

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

	/*
	    A little wider than the other pages, so a chest's 12 slots fit across
	    with room to spare beside a scrollbar
	*/
	:global(.content):has(.workspace) {
		width: 540px;
	}

	.workspace {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/*
	    All the group's chests, scrolling. Always tall enough for three
	    regular (36-slot) chests, and taller when the screen has room.
	*/
	.chest-list {
		--three-chests: calc(3 * 166px + 2 * 10px);
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: max(var(--three-chests), calc(100dvh - 621px));
		overflow-y: auto;
		/* The same width whether or not a scrollbar is showing */
		scrollbar-gutter: stable;
		padding-right: 4px;
	}

	/*
	    On wide screens the item editor sits to the right of the sidebar
	    instead of under the list, so the list can use the full height
	*/
	@media (min-width: 1600px) {
		.side {
			position: absolute;
			top: 0;
			left: calc(100% + 48px);
			width: 100%;
		}

		.chest-list {
			max-height: max(var(--three-chests), calc(100dvh - 426px));
		}
	}

	.chest {
		--chest-border: #b14e0544;
		border-radius: 6px;
		border: 2px solid var(--chest-border);
	}

	.chest header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		padding: 4px 8px;
		border-radius: 4px 4px 0 0;
		border-bottom: 2px solid var(--chest-border);
		background: #fff3dc66;
	}

	/* The colour picked for the chest in-game frames it and tints its heading */
	.chest.colored {
		--chest-border: var(--chest-color);
	}

	.chest.colored header {
		background: color-mix(in srgb, var(--chest-color) 45%, #ffe7c2);
	}

	.used {
		opacity: 0.8;
	}

	.chest-type {
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
		flex: 1;
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

	/* Slots side by side on the plain background, like the backpack */
	.item-grid {
		display: grid;
		grid-template-columns: repeat(12, min-content);
		grid-auto-rows: 36px;
		justify-content: center;
		padding: 6px;
	}

	.item {
		position: relative;
		transition:
			transform 0.1s,
			opacity 3s linear;
		cursor: pointer;
	}

	.item:hover {
		transform: scale(1.2);
		transform-origin: center;
	}

	/* Fade out quickly while searching; fade back in slowly once results close */
	.item.dimmed {
		opacity: 0.3;
		transition:
			transform 0.1s,
			opacity 0.15s;
	}
</style>
