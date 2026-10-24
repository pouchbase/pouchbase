import { snippet } from '#lib/highlight.js';

export const watch = snippet(
	'typescript',
	`
const subscription = pouch.db.posts.watch(
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
subscription.stop();

// One record
pouch.db.posts.watch((event) => console.log(event.record), { id: postId });

// Without the generated schema
pouch.live.watch('posts', (event) => console.log(event));
pouch.live.watch('posts/<id>', (event) => console.log(event));`
);

export const state = snippet(
	'typescript',
	`
pouch.live.onState((collection, state) => {
	// 'connecting' | 'open' | 'closed', e.g. show a "live" indicator while open
});`
);

export const protocol = snippet(
	'javascript',
	`
const socket = new WebSocket('wss://pouchbase.example.com/api/live?collection=posts');

socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token })); // leave out token: anonymous

socket.onmessage = ({ data }) => {
	const message = JSON.parse(data);

	if (message.type === 'ready') {
		socket.send(
			JSON.stringify({ type: 'subscribe', id: 'all', where: 'status == "published"' })
		);
	}

	if (message.type === 'event') {
		console.log(message.action, message.record); // message.id is your subscription's id
	}
};

// Every 30 seconds; answered by {"type":"pong"}
setInterval(() => socket.send('{"type":"ping"}'), 30_000);`
);
