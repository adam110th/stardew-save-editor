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

	// Rooms in the order the game lists them, with what restoring each one unlocks
	const roomInfo: Record<
		CCRoom,
		{ name: string; icon: string; reward: string; note?: string }
	> = {
		[CCRoom.CraftsRoom]: {
			name: "Crafts Room",
			icon: "🌿",
			reward: "Bridge repair (to the Quarry)",
		},
		[CCRoom.Pantry]: {
			name: "Pantry",
			icon: "🥕",
			reward: "Greenhouse restored",
		},
		[CCRoom.FishTank]: {
			name: "Fish Tank",
			icon: "🐟",
			reward: "Glittering boulder removed (above the Mines)",
		},
		[CCRoom.BoilerRoom]: {
			name: "Boiler Room",
			icon: "🔥",
			reward: "Minecart repair (fast travel)",
		},
		[CCRoom.BulletinBoard]: {
			name: "Bulletin Board",
			icon: "📌",
			reward:
				"Friendship boost (+2 hearts with all non-marriageable villagers)",
			note: "Restoring the room puts the villagers' thank-you letter in each farmer's mailbox; the hearts are added when it's read in-game.",
		},
		[CCRoom.Vault]: {
			name: "Vault",
			icon: "💰",
			reward: "Bus repair (to the Calico Desert)",
		},
		[CCRoom.AbandonedJojaMart]: {
			name: "Abandoned JojaMart",
			icon: "🎬",
			reward: "Movie Theater",
		},
	};
	const roomOrder = [
		CCRoom.CraftsRoom,
		CCRoom.Pantry,
		CCRoom.FishTank,
		CCRoom.BoilerRoom,
		CCRoom.BulletinBoard,
		CCRoom.Vault,
		CCRoom.AbandonedJojaMart,
	];

	const rooms = $derived(
		[...Map.groupBy(bundles.values(), (b) => b.room)]
			.toSorted(([a], [b]) => roomOrder.indexOf(a) - roomOrder.indexOf(b))
			.map(([room, list]) => ({
				room,
				...(roomInfo[room] ?? {
					name: `Room ${room}`,
					icon: "📦",
					reward: "",
				}),
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
			restores it and unlocks its reward, shown under each room. Each finished
			bundle's reward waits in that room's bundle menu in-game, ready to
			collect.
		</p>

		<div class="wrapper" data-testid="bundle-wrapper">
			{#each rooms as { room, name, icon, reward, note, bundles: list } (room)}
				{@const done = isDone(list)}
				<section
					class="room"
					class:done
					data-testid="bundle-room"
					data-room={name}
				>
					<header>
						<span class="room-icon" aria-hidden="true">{icon}</span>
						<div class="room-title">
							<h2>{name}</h2>
							<small data-testid="bundle-room-progress">
								{list.filter((b) => b.completed).length}/{list.length} bundles
								{#if done}· Restored ✅{/if}
							</small>
						</div>
						<UiButton
							onclick={() => setRoom(list, !done)}
							data-testid="bundle-room-toggle"
						>
							{done ? "Clear room" : "Complete room"}
						</UiButton>
					</header>
					{#if reward}
						<p class="room-reward" data-testid="bundle-room-reward">
							🎁 <strong>Reward:</strong>
							{reward}
							{#if note}<br /><small class="room-note">{note}</small>{/if}
						</p>
					{/if}
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

	.room {
		margin: 12px 4px;
		padding: 4px 4px 8px;
		border: 2px solid #b14e0544;
		border-radius: 8px;
		background: #fff3dc55;
	}

	.room.done {
		border-color: #3c8d2f88;
		background: #d8f0c855;
	}

	.room header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 4px 8px 0;
		padding-bottom: 4px;
		border-bottom: 2px solid #0003;
	}

	.room-icon {
		font-size: 1.6em;
	}

	.room-title {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.room h2 {
		margin: 0;
		font-size: 1.1em;
	}

	.room-reward {
		margin: 6px 12px 0;
		font-size: 0.85em;
	}

	.room-note {
		opacity: 0.75;
	}
</style>
