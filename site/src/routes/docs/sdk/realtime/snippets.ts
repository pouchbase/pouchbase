import { snippet } from '#lib/highlight.js';

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
		onError: (error) => console.error(error) // fails later, e.g. after a reconnect
	}
);

await subscription.ready; // rejects with forbidden, not_found, invalid or unauthorized
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
pouch.realtime.subscribe('posts', (event) => console.log(event.record.title), {
	where: { status: 'published' }
});
pouch.realtime.subscribe(\`posts/\${postId}\`, (event) => console.log(event.record));`
);

export const state = snippet(
	'typescript',
	`
const off = pouch.realtime.onState((collection, state) => {
	// state: 'connecting' | 'open' | 'closed', e.g. for a connection indicator
});
off(); // removes the listener

// Ends every subscription and closes every connection
pouch.realtime.disconnect();`
);
