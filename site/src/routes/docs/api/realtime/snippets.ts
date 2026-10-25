import { snippet } from '#lib/highlight.js';

export const protocol = snippet(
	'javascript',
	`
const socket = new WebSocket('wss://pouchbase.example.com/api/realtime?collection=posts');

socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token })); // leave out token: anonymous

socket.onmessage = ({ data }) => {
	const message = JSON.parse(data);

	if (message.type === 'ready') {
		socket.send(
			JSON.stringify({ type: 'subscribe', id: 'published', where: 'status == "published"' })
		);
	}

	if (message.type === 'event') {
		console.log(message.action, message.record); // message.id is your subscription's id
	}
};

// Every 30 seconds; answered by {"type":"pong"}
setInterval(() => socket.send('{"type":"ping"}'), 30_000);`
);

export const event = snippet(
	'json',
	`
{
	"type": "event",
	"id": "published",
	"action": "update",
	"record": {
		"id": "k3j9x2m1q8w7e5r",
		"title": "Hello, Pouchbase",
		"status": "published",
		"updated_at": 1792924200000
	},
	"at": 1792924200000
}`
);

export const error = snippet(
	'json',
	`
{ "type": "error", "id": "published", "code": "forbidden", "message": "…" }`
);
