<script lang="ts">
	import * as Code from '#lib/components/ui/code/index.js';
	import { resolve } from '$app/paths';
</script>

<!-- The last section of every self-hosting guide; add `finish-the-installation` to its sections. -->
<h2 id="finish-the-installation">Finish the installation</h2>

<p>
	The first visit redirects to <Code.Root>/install</Code.Root>. Enter the email address and password
	of your admin account: Pouchbase creates the D1 databases and the account, and signs you in.
</p>

<p>
	To skip that page, set <Code.Root>POUCHBASE_ADMIN_EMAIL</Code.Root> and
	<Code.Root>POUCHBASE_ADMIN_PASSWORD</Code.Root> (at least 10 characters): Pouchbase then installs itself
	with that admin on the first request. Once it is installed, both are ignored.
</p>

<p>
	Next, create your first <a href={resolve('/docs/platform/collections')}>collections</a>.
</p>
