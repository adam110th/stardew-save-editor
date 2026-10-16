<script lang="ts">
	import { CCRoom } from "$lib/bundleSideEffects";
	import { Raw } from "$lib/proxies";
	import type { Bundle as BundleProxy } from "$lib/proxies/CommunityBundles.svelte";
	import { MailFlag } from "$lib/proxies/Mail.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import Bundle from "./Bundle.svelte";
	import JojaBundles from "./JojaBundles.svelte";

	const save = getSaveManager().save;
	const bundles = save?.communityBundles;
	const cc = save?.locations.find((l) => l[Raw].name === "CommunityCenter");
	if (!save || !bundles) throw new Error("No save data found");

	const roomNames: Record<CCRoom, string> = {
		[CCRoom.Pantry]: "Pantry",
		[CCRoom.CraftsRoom]: "Crafts Room",
		[CCRoom.FishTank]: "Fish Tank",
		[CCRoom.BoilerRoom]: "Boiler Room",
		[CCRoom.Vault]: "Vault",
		[CCRoom.BulletinBoard]: "Bulletin Board",
		[CCRoom.AbandonedJojaMart]: "Abandoned JojaMart",
	};

	const rooms = $derived(
		[...Map.groupBy(bundles.values(), (b) => b.room)]
			.toSorted(([a], [b]) => a - b)
			.map(([room, list]) => ({
				room,
				name: roomNames[room] ?? `Room ${room}`,
				bundles: list.toSorted((a, b) => a.id - b.id),
			})),
	);

	const isDone = (list: BundleProxy[]) => list.every((b) => b.completed);

	function setRoom(list: BundleProxy[], done: boolean) {
		for (const bundle of list) {
			if (done) bundle.complete();
			else bundle.clear();
		}
	}

	let hasJojaMembership = $derived(
		save.players.some((player) => player.mailReceived.has(MailFlag.JojaMember)),
	);

	function enableJojaMembership() {
		// IMPORTANT: mailReceived is a SvelteSet; do NOT replace the Set instance
		// or we lose reactivity. Mutate it directly so hasJojaMembership updates.
		for (const player of save?.players ?? []) {
			player.mailReceived.add(MailFlag.JojaMember);
			console.log("Enabled Joja Membership for player:", player.name);
		}
	}

	function disableJojaMembership() {
		for (const player of save?.players ?? []) {
			player.mailReceived.delete(MailFlag.JojaMember);
			console.log("Disabled Joja Membership for player:", player.name);
		}
	}
</script>

<UiContainer>
	<h1>Community Bundles</h1>

	<!-- Enable or disable Joja Membership -->
	<label class="member-menu" data-testid="joja-toggle">
		<UiCheckbox
			type="checkbox"
			checked={hasJojaMembership}
			data-testid="joja-membership-checkbox"
			onchange={() => {
				if (hasJojaMembership) {
					disableJojaMembership();
				} else {
					enableJojaMembership();
				}
			}}
		/>
		Enable Joja Membership
	</label>

	{#if hasJojaMembership}
		{#if cc}
			<JojaBundles {save} {bundles} />
		{/if}
	{:else}
		<p class="hint">
			Tick the items that have been donated. Finishing every bundle in a room
			restores it and unlocks what it normally would (the bus, minecarts,
			greenhouse and so on). Each finished bundle's reward waits in that room's
			bundle menu in-game, ready to collect.
		</p>

		<div class="wrapper" data-testid="bundle-wrapper">
			{#each rooms as { room, name, bundles: list } (room)}
				{@const done = isDone(list)}
				<section class="room" data-testid="bundle-room" data-room={name}>
					<header>
						<h2>{name}</h2>
						<small data-testid="bundle-room-progress">
							{list.filter((b) => b.completed).length}/{list.length} bundles
							{#if done}✅{/if}
						</small>
						<UiButton
							onclick={() => setRoom(list, !done)}
							data-testid="bundle-room-toggle"
						>
							{done ? "Clear room" : "Complete room"}
						</UiButton>
					</header>
					{#each list as bundle (bundle.id)}
						<Bundle {bundle} />
					{/each}
				</section>
			{/each}
		</div>
	{/if}
</UiContainer>

<style>
	.member-menu {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.hint {
		font-size: 0.8em;
		opacity: 0.8;
		max-width: 60ch;
	}

	.wrapper {
		max-height: 60vh;
		overflow-y: auto;
	}

	.room header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.75rem 8px 0;
		padding-bottom: 4px;
		border-bottom: 2px solid #0003;
	}

	.room h2 {
		margin: 0;
		font-size: 1.1em;
	}

	.room header small {
		flex: 1;
	}
</style>
