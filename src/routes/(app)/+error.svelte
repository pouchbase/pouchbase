<script lang="ts">
	import { page } from '$app/state';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import * as Page from '#lib/components/ui/page/index.js';
	import * as Topbar from '#lib/components/ui/topbar/index.js';
	import { statusText } from '#lib/errors.js';
	import ErrorView from '../error-view.svelte';
</script>

<!-- Errors of dashboard pages, inside the sidebar layout so the rest of the dashboard stays at hand. -->
<Topbar.Root>
	<Breadcrumb.Root>
		<Breadcrumb.Item>
			<Breadcrumb.Page>{statusText(page.status).title}</Breadcrumb.Page>
		</Breadcrumb.Item>
	</Breadcrumb.Root>
</Topbar.Root>

<Page.Root>
	<div class="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-16">
		<ErrorView />
	</div>
</Page.Root>
