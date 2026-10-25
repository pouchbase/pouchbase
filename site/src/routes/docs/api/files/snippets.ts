import { snippet } from '#lib/highlight.js';

export const download = snippet(
	'bash',
	`
# The file itself
curl -O https://pouchbase.example.com/api/files/f9w2e4r6t8y1u3i

# A thumbnail from the settings of files
curl -O "https://pouchbase.example.com/api/files/f9w2e4r6t8y1u3i?size=400x300"

# Always as a download, also for an image
curl -OJ "https://pouchbase.example.com/api/files/f9w2e4r6t8y1u3i?download"`
);

export const headers = snippet(
	'bash',
	`
HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Disposition: inline; filename*=UTF-8''cover.jpg
Content-Length: 84512
Cache-Control: public, max-age=3600
Content-Security-Policy: default-src 'none'; img-src 'self'; sandbox
X-Content-Type-Options: nosniff
Access-Control-Allow-Origin: *`
);

export const notFound = snippet(
	'json',
	`
{ "message": "File not found" }`
);
