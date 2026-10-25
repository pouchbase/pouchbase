/**
 * What a field type's check says about a value: valid, with what Pouchbase stores, or not, with the
 * message the record form shows. `field.ts` validates with it on the server, and the field
 * playground page with the same rules in the browser.
 */
export type Check<T> = { valid: true; stored: T } | { valid: false; message: string };
