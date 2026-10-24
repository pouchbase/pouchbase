<script lang="ts">
	import Output from '#lib/components/output.svelte';
	import Panel from '#lib/components/panel.svelte';
	import { pouch } from '#lib/pouchbase.svelte.js';
	import { Runner } from '#lib/run.svelte.js';

	const health = new Runner();
	const providers = new Runner();

	health.run(() => pouch.health());
	providers.run(() => pouch.auth.providers());
</script>

<div class="grid">
	<Panel title="Health" description="GET /api/health · pouch.health()">
		<div class="row">
			<button disabled={health.loading} onclick={() => health.run(() => pouch.health())}
				>Check</button
			>
		</div>
		<Output outcome={health.outcome} />
	</Panel>

	<Panel title="OAuth providers" description="GET /api/auth/providers · pouch.auth.providers()">
		<div class="row">
			<button
				disabled={providers.loading}
				onclick={() => providers.run(() => pouch.auth.providers())}
			>
				Load
			</button>
		</div>
		<Output outcome={providers.outcome} />
	</Panel>
</div>
