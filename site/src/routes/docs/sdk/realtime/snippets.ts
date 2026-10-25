import { snippet } from '#lib/highlight.js';

export const quickStart = snippet(
	'typescript',
	`
const subscription = pouch.db.posts.subscribe((event) => {
	console.log(event.action, event.record); // 'create' | 'update' | 'delete'
});

// Later, when you no longer need the changes
subscription.unsubscribe();`
);

export const subscribe = snippet(
	'typescript',
	`
const subscription = pouch.db.posts.subscribe(
	(event) => {
		event.action; // 'create' | 'update' | 'delete'
		event.record; // typed by \`select\`; for a delete, the record as it was
	},
	{
		where: { status: 'published' },
		select: ['id', 'title'],
		onError: (error) => console.error(error) // a subscription that fails later
	}
);

await subscription.ready; // rejects with \`forbidden\`, \`not_found\` or \`invalid\`
subscription.unsubscribe();`
);

export const subscribeRecord = snippet(
	'typescript',
	`
pouch.db.posts.subscribe((event) => console.log(event.record), { id: postId });`
);

export const subscribeTopic = snippet(
	'typescript',
	`
pouch.realtime.subscribe('posts', (event) => console.log(event));
pouch.realtime.subscribe('posts/<id>', (event) => console.log(event));`
);

export const state = snippet(
	'typescript',
	`
const stop = pouch.realtime.onState((collection, state) => {
	// 'connecting' | 'open' | 'closed', e.g. show a connection indicator while open
});

// Ends every subscription and closes every connection
pouch.realtime.disconnect();`
);
