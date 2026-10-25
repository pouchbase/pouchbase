<script lang="ts">
	import * as Badge from '#lib/components/ui/badge/index.js';
	import * as Callout from '#lib/components/ui/callout/index.js';
	import type { DialogProps } from '#lib/components/ui/dialog/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as Skeleton from '#lib/components/ui/skeleton/index.js';
	import { errorMessage } from '#lib/errors.js';
	import { pluginSettingsSchema } from '#lib/schemas/plugins.js';
	import { getPluginSettings, savePluginSettings } from './plugins.remote';
	import type { InstalledPlugin } from './types';

	type Props = { plugin: InstalledPlugin } & DialogProps;

	let { plugin, close }: Props = $props();

	const form = $derived(savePluginSettings.for(plugin.id).preflight(pluginSettingsSchema));
</script>

<!-- Opened through `Dialog.getDialogs()`: the dialog root of the app hosts it, docked as a sheet. -->
<Sheet.Content>
	<Sheet.Header>
		<Sheet.Title>Settings</Sheet.Title>
		<Sheet.Description>Settings of {plugin.name}</Sheet.Description>
	</Sheet.Header>

	<svelte:boundary>
		{@const settings = await getPluginSettings(plugin.id)}
		{@const labels = new Map(settings.definition.map((setting) => [setting.key, setting.label]))}

		<Form.Root
			{form}
			success={`Settings of ${plugin.name} saved`}
			class="min-h-0 flex-1 gap-0"
			enhance={async (instance) => {
				if (await instance.submit()) {
					close();
				}
			}}
		>
			<Form.Hidden field={form.fields.id} value={plugin.id} />

			<Sheet.Body>
				{#if settings.missing.length}
					<Callout.Root variant="warning">
						<Icon.Root icon="lucide:triangle-alert" class="size-4 shrink-0" />
						<p>
							{plugin.name} needs
							{settings.missing.map((key) => labels.get(key) ?? key).join(', ')}
							to work.
						</p>
					</Callout.Root>
				{/if}

				{#each settings.definition as setting (setting.key)}
					{@const current = settings.values[setting.key]}
					{@const label = setting.required ? `${setting.label} (required)` : setting.label}

					{#if setting.type === 'boolean'}
						<Form.Field field={form.fields.flags[setting.key]!} orientation="horizontal">
							<Form.Checkbox defaultChecked={current?.value === 'true'} />
							<Form.Label>{setting.label}</Form.Label>
							{#if setting.description}
								<Form.Description class="w-full">{setting.description}</Form.Description>
							{/if}
							<Form.Errors />
						</Form.Field>
					{:else if setting.type === 'secret'}
						<Form.Field field={form.fields._secrets[setting.key]!}>
							<div class="flex items-center gap-2">
								<Form.Label>{label}</Form.Label>
								{#if current?.set}
									<Badge.Root variant="success">Set</Badge.Root>
								{:else}
									<Badge.Root variant="outline">Not set</Badge.Root>
								{/if}
							</div>
							<Form.Input
								type="password"
								autocomplete="off"
								placeholder={current?.set ? 'Leave empty to keep the saved value' : ''}
							/>
							{#if setting.description}
								<Form.Description>{setting.description}</Form.Description>
							{/if}
							<Form.Errors />
						</Form.Field>
					{:else if setting.type === 'number'}
						<Form.Field field={form.fields.numbers[setting.key]!}>
							<Form.Label>{label}</Form.Label>
							<Form.Input type="number" defaultValue={current?.value ?? ''} step="any" />
							{#if setting.description}
								<Form.Description>{setting.description}</Form.Description>
							{/if}
							<Form.Errors />
						</Form.Field>
					{:else}
						<Form.Field field={form.fields.values[setting.key]!}>
							<Form.Label>{label}</Form.Label>
							<Form.Input
								type={setting.type === 'url' ? 'url' : 'text'}
								defaultValue={current?.value ?? ''}
								placeholder={setting.type === 'url' ? 'https://' : undefined}
							/>
							{#if setting.description}
								<Form.Description>{setting.description}</Form.Description>
							{/if}
							<Form.Errors />
						</Form.Field>
					{/if}
				{/each}
			</Sheet.Body>

			<Sheet.Footer>
				<Sheet.Close>Cancel</Sheet.Close>
				<Form.Submit>Save</Form.Submit>
			</Sheet.Footer>
		</Form.Root>

		{#snippet pending()}
			<Sheet.Body>
				<div class="flex flex-col gap-2">
					<Skeleton.Root class="h-4 w-24" />
					<Skeleton.Root class="h-control w-full" />
				</div>
				<div class="flex flex-col gap-2">
					<Skeleton.Root class="h-4 w-32" />
					<Skeleton.Root class="h-control w-full" />
				</div>
			</Sheet.Body>
		{/snippet}

		{#snippet failed(error)}
			<Sheet.Body>
				<Callout.Root variant="error">
					<Icon.Root icon="lucide:circle-alert" class="size-4 shrink-0" />
					<p>{errorMessage(error)}</p>
				</Callout.Root>
			</Sheet.Body>
		{/snippet}
	</svelte:boundary>
</Sheet.Content>
