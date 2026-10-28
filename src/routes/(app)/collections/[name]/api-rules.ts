import type { ApiRuleAction } from '#lib/filter/rules.js';

import { ownerRule, SIGNED_IN_RULE } from '#lib/filter/rules.js';

/** A choice in the access menu of a rule, and the rule it stands for (`null`: locked). */
export type AccessOption = {
	value: string;
	label: string;
	description: string;
	icon: string;
	rule: string | null;
	/** Who it allows, as the end of a sentence: `users whose id is in author`. */
	who?: string;
};

/** The value of the access menu for a custom rule. */
export const CUSTOM = 'custom';

/** How each action of the records API is shown in its rule card. */
export const ACTIONS: Record<
	ApiRuleAction,
	{ title: string; request: string; icon: string; verb: string; destructive: boolean }
> = {
	list: {
		title: 'List and search',
		request: 'GET /api/db/:collection',
		icon: 'lucide:list',
		verb: 'list and search records',
		destructive: false
	},
	view: {
		title: 'View',
		request: 'GET /api/db/:collection/:id',
		icon: 'lucide:eye',
		verb: 'view records',
		destructive: false
	},
	create: {
		title: 'Create',
		request: 'POST /api/db/:collection',
		icon: 'lucide:plus',
		verb: 'create records',
		destructive: true
	},
	update: {
		title: 'Update',
		request: 'PATCH /api/db/:collection/:id',
		icon: 'lucide:pencil',
		verb: 'update records',
		destructive: true
	},
	delete: {
		title: 'Delete',
		request: 'DELETE /api/db/:collection/:id',
		icon: 'lucide:trash-2',
		verb: 'delete records',
		destructive: true
	}
};

/** What a custom rule does for each action. */
export const CUSTOM_HINTS: Record<ApiRuleAction, string> = {
	list: 'Only records that match the rule are listed; others are left out.',
	view: 'Only records that match the rule can be viewed; others are not found.',
	create: 'A new record is only created when it matches the rule.',
	update: 'Only records that match the rule (before the change) can be updated.',
	delete: 'Only records that match the rule can be deleted.'
};

/** Example custom rules: a label and the rule. */
export const EXAMPLES = [
	['Only the author', 'author == $user.id'],
	['Signed-in users', '$user.id != null'],
	['Verified users', '$user.verified == true'],
	['Published, or your own', 'status == "published" || author == $user.id'],
	['Only as yourself (create)', '$input.author == $user.id'],
	['Any of a multiple relation', 'any(editors) == $user.id'],
	['A field of a related record', 'author.role == "admin"'],
	['Published by now', 'published_at <= now()'],
	['Created this week', 'created_at >= start_of(now(), "week")'],
	['Company addresses only', 'ends_with($user.email, "@example.com")']
];

/**
 * The choices of the access menu. `owners` are the relation fields that point to `users` (or the
 * user itself in `users`, when `isUsers`).
 */
export function accessOptions(
	owners: { field: string; multiple: boolean }[],
	isUsers: boolean
): AccessOption[] {
	return [
		{
			value: 'locked',
			label: 'Admins only',
			description: 'Not available through the API',
			icon: 'lucide:lock',
			rule: null
		},
		{
			value: 'everyone',
			label: 'Everyone',
			description: 'Also without signing in',
			icon: 'lucide:globe',
			rule: ''
		},
		{
			value: 'signed-in',
			label: 'Signed-in users',
			description: 'Any user with a valid token',
			icon: 'lucide:user-check',
			rule: SIGNED_IN_RULE,
			who: 'signed-in users'
		},
		...owners.map(({ field, multiple }) =>
			isUsers
				? {
						value: 'owner:id',
						label: 'The user themselves',
						description: 'Each user only their own record',
						icon: 'lucide:user-round',
						rule: ownerRule('id'),
						who: 'the user themselves'
					}
				: {
						value: `owner:${field}`,
						label: `Owner (${field})`,
						description: multiple ? `Users listed in ${field}` : `The user in ${field}`,
						icon: 'lucide:user-round',
						rule: ownerRule(field, multiple),
						who: multiple ? `users listed in ${field}` : `the user in ${field}`
					}
		),
		{
			value: CUSTOM,
			label: 'Custom rule',
			description: 'Write a condition',
			icon: 'lucide:code-xml',
			rule: null
		}
	];
}
