/** Title and explanation of the error page per HTTP status. */
const STATUSES: Record<number, { title: string; description: string }> = {
	400: {
		title: 'Invalid request',
		description: 'Something in the request is invalid, so it could not be processed.'
	},
	401: {
		title: 'Sign in first',
		description: 'This page is for signed-in users. Sign in to continue.'
	},
	403: {
		title: 'Not allowed',
		description: 'Your account is not allowed to see this page.'
	},
	404: {
		title: 'Page not found',
		description: 'This page does not exist, or it was moved. Check the address or start over.'
	},
	429: {
		title: 'Too many requests',
		description: 'Wait a moment and try again.'
	},
	502: {
		title: 'A service did not answer',
		description: 'The site could not reach a service it depends on. Try again in a moment.'
	},
	503: {
		title: 'Not available',
		description: 'This part of the site is not available right now. Try again in a moment.'
	}
};

/** Title and explanation for the error page of a status, e.g. `Page not found` for `404`. */
export function statusText(status: number): { title: string; description: string } {
	return (
		STATUSES[status] ?? {
			title: 'Something went wrong',
			description:
				status >= 500
					? 'An error occurred on our side. Try again in a moment.'
					: 'The request could not be completed.'
		}
	);
}
