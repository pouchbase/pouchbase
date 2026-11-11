/** The function's own code, uploaded next to the entry as `function.js`. */
declare const handler:
	| {
			fetch?: (request: Request, env: object, ctx: object) => Response | Promise<Response>;
	  }
	| undefined;

export default handler;
