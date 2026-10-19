<script lang="ts">
	import { untrack } from "svelte";
	import { lovedGiftNames } from "$lib/LovedGifts";
	import { characters } from "$lib/NPCs";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import { Villagers } from "$lib/Villagers";
	import HeartBar from "./HeartBar.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const player = $derived(save.player);
	// Sorted by points, but only when villagers are added, replaced or removed, or
	// the farmer changes: re-sorting as points are edited would move the row being
	// typed in, losing focus
	const friendships = $derived.by(() => {
		const all = player.friendships;
		// Reads every entry, so replacing a villager counts too (keys() alone can
		// miss that); their points are only read untracked, when sorting
		all.entries();
		return untrack(() => Array.from(all));
	});
	let search = $state("");
	// Match the villager's name, description or anything they love (their own
	// loves, every item in a group such as Penny's books, and the universal
	// loves they don't override)
	const shown = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return friendships;
		return friendships.filter(([name]) =>
			[
				name,
				Villagers.get(name)?.description ?? "",
				...lovedGiftNames(name),
			].some((text) => text.toLowerCase().includes(term)),
		);
	});
	const missingCharacters = $derived(
		characters.filter((name) => !player.friendships.has(name)),
	);
</script>

<UiContainer>
	<h3>Relationships</h3>
	<div class="toolbar">
		<h4>NPCs encountered: {friendships.length}</h4>

		<UiButton
			onclick={() => player.friendships.addMissingCharacters()}
			disabled={missingCharacters.length === 0}
			data-testid="add-missing-friendships"
		>
			<h4>
				{#if missingCharacters.length === 0}
					No missing NPCs
				{:else}
					Add all missing NPCs
				{/if}
			</h4>
		</UiButton>
	</div>
	<div class="search">
		<UiInput
			type="search"
			placeholder="Search villagers or loved gifts..."
			aria-label="Search villagers"
			bind:value={search}
			data-testid="relationships-search"
		/>
	</div>
	<div class="wrapper">
		{#each shown as [name, npc] (name)}
			<HeartBar {name} {npc} />
		{:else}
			<p class="empty">No villagers match "{search}".</p>
		{/each}
	</div>
	<small class="credit">
		Villager descriptions from the
		<a href="https://stardewvalleywiki.com" target="_blank" rel="noreferrer"
			>Stardew Valley Wiki</a
		>
		(<a
			href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
			target="_blank"
			rel="noreferrer">CC BY-NC-SA 3.0</a
		>).
	</small>
</UiContainer>

<style>
	.wrapper {
		overflow-y: scroll;
		/* Fill the window below the page header, never below 20rem */
		height: max(20rem, calc(100dvh - 360px));
	}

	.search :global(input) {
		width: 100%;
		margin: 4px 0 8px;
		font-size: large;
	}

	.empty {
		opacity: 0.7;
		text-align: center;
	}

	.credit {
		display: block;
		margin-top: 6px;
		font-size: x-small;
		opacity: 0.8;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
</style>
