/**
 * What every service error code means, for people. `fail()` (`./errors.ts`) shows these on the
 * error page and in toasts, instead of the code's constant (`API_KEYS_QUERY_FAILED`).
 *
 * An entry is the message, or `[status, message]` when the error isn't a `500`: a caller that
 * doesn't handle the code itself still answers with the right status. Keep the messages short,
 * in sentence case and without a final period; the underlying cause is shown separately.
 */
export const ERROR_MESSAGES: Record<number, string | [number, string]> = {
	// Database
	1000: 'Could not look up the databases on Cloudflare',
	1001: 'Could not create the database on Cloudflare',
	1002: 'Could not update the database to this version of Pouchbase',
	1003: 'Could not create the app database on Cloudflare',
	1004: 'The app database is missing; it may have been deleted on Cloudflare',
	1005: 'Could not bind the databases to the Worker',
	1006: 'Could not delete the database on Cloudflare',

	// Install
	2000: [409, 'An admin account already exists'],
	2002: 'POUCHBASE_ADMIN_EMAIL or POUCHBASE_ADMIN_PASSWORD is invalid',

	// Users (admins)
	3000: 'Could not check whether there are admins',
	3001: 'Could not look up the admin',
	3002: 'Could not create the admin',
	3004: [409, 'An admin with this email address already exists'],
	3005: 'Could not load the admins',

	// Sessions
	4000: 'Could not start a session',
	4001: 'Could not check your session',
	4002: 'Could not end the session',
	4003: [401, 'Invalid email address or password'],
	4004: 'Could not log in',

	// Settings
	5000: 'Could not read the settings',
	5001: 'Could not save the settings',

	// Collections
	6000: 'Could not load the collections',
	6001: 'Could not load the collection',
	6002: [400, 'This collection name is not allowed'],
	6003: [409, 'A collection with this name already exists'],
	6005: 'Could not create the collection',
	6006: [404, 'Collection not found'],
	6007: 'Could not rename the collection',
	6008: 'Could not delete the collection',
	6009: [
		409,
		'Relation fields of other collections point to this collection; delete those fields first'
	],
	6010: 'Could not load the collection',
	6011: [403, "Built-in collections can't be renamed or deleted"],
	6012: 'Could not create the built-in collections',
	6013: 'Could not save the collection settings',
	6014: [400, 'The API rules are invalid'],
	6015: [422, 'Relation fields point at collections this instance does not have'],
	6016: [409, 'The changes delete collections, fields or their data; confirm them first'],

	// Fields
	7000: 'Could not load the fields',
	7001: [400, 'This field name is not allowed'],
	7002: [409, 'A field with this name already exists'],
	7003: [400, 'The default value does not fit the field'],
	7004: 'Could not create the field',
	7005: 'Could not load the field',
	7006: [404, 'Field not found'],
	7007: 'Could not rename the field',
	7008: 'Could not delete the field',
	7009: [400, 'The relation points at a collection that does not exist'],
	7010: [403, "Built-in fields can't be changed"],
	7011: [400, 'The formula of the computed field is invalid'],
	7012: [409, 'Other fields still use this field'],
	7013: 'The files collection is not available',
	7014: 'Could not save the fields',
	7015: [409, 'Records have duplicate values in this field, so it cannot be unique'],
	7016: 'Could not compute the values of the field',
	7017: 'Could not update the computed values',
	7018: [400, 'The list items are invalid'],
	7019: [400, 'This field type does not exist'],
	7020: [409, 'Relation fields still point to this id field'],
	7022: [409, 'This collection already has an id field'],
	7023: [400, 'The default value expression is invalid'],
	7024: [400, 'A field with multiple values cannot be unique'],
	7025: [409, 'Records have more than one value in this field'],
	7026: [409, 'Records still use the list items you removed'],
	7027: 'Could not save the field',

	// Records
	8000: 'Could not load the records',
	8001: [400, 'The record is invalid'],
	8002: [409, 'A record with this value already exists'],
	8003: [404, 'Record not found'],
	8004: 'Could not create the record',
	8005: 'Could not save the record',
	8006: 'Could not delete the records',
	8007: 'Could not load the options of the relation',
	8008: 'Could not load the file fields',
	8009: 'Could not refresh the computed values',
	8010: 'Could not preview the computed value',
	8011: 'Could not load the record',
	8012: [400, 'The collection has no fields yet'],
	8013: [403, 'This is not available for this collection'],
	8014: [403, 'Only admins can do this: the API rule is locked'],
	8015: [400, 'The filter or sort is invalid'],
	8016: [400, 'The API rule is invalid'],
	8017: [403, 'The API rule does not allow this'],
	8018: 'Could not load the linked records',
	8019: [409, 'Other records still link to this record'],
	8020: [409, 'Deleting would cascade to too many linked records'],
	8021: [409, 'This record is the default value of a relation field'],

	// Indexes
	9000: 'Could not load the indexes',
	9001: [400, 'The columns of the index are invalid'],
	9002: [409, 'Records have duplicate values, so the index cannot be unique'],
	9003: 'Could not create the index',
	9004: [404, 'Index not found'],
	9005: 'Could not delete the index',
	9006: 'Could not save the index',

	// OAuth providers
	10000: 'Could not load the sign-in providers',
	10001: 'Could not load the sign-in provider',
	10002: 'Could not save the sign-in provider',
	10003: [400, 'The sign-in provider is missing its client ID or secret'],
	10004: [404, 'Sign-in provider not found'],

	// Auth
	11000: 'Could not set up authentication',
	11001: [403, 'This sign-in provider is not enabled'],
	11003: 'Signing in with the provider failed',
	11004: 'Could not sign in',
	11005: [409, 'This email address is already used by another account'],
	11006: [401, 'Invalid or expired token'],
	11007: [404, 'User not found'],
	11009: 'Could not load the user',
	11010: [400, 'The sign-in request is invalid'],
	11011: [404, 'The sign-in request has expired; start again'],
	11012: [400, 'The sign-in request could not be verified; start again'],
	11013: 'Could not process the sign-in request',
	11014: [404, 'Sign-in provider not found'],
	11015: 'The plugin of the sign-in provider failed',
	11020: [403, 'Signing in with a password is disabled'],
	11021: [403, 'Signing up is disabled'],
	11022: [401, 'Invalid email address or password'],
	11024: [409, 'An account with this email address already exists'],
	11025: [400, 'The input is invalid'],
	11026: 'Could not sign in with the password',
	11027: [409, 'Sending mail is not set up'],
	11028: [400, 'This link is invalid or has expired'],
	11029: [400, 'This link is invalid or has expired'],
	11030: 'Could not reset the password',
	11031: 'Could not verify the email address',
	11032: [403, 'The email address is not verified yet'],

	// Storage
	12000: 'Could not set up the storage bucket on Cloudflare',
	12001: 'Could not upload the file to storage',
	12002: 'Could not download the file from storage',
	12003: 'Could not delete the file from storage',
	12004: 'Could not connect to the storage bucket',
	12005: [409, 'A storage migration is still running'],
	12006: 'Could not move the files to the new storage',

	// Files
	13001: [413, 'The file is too large'],
	13002: [400, 'The file is empty'],
	13003: [404, 'File not found'],
	13004: 'Could not import the file',
	13005: 'Could not save the file',
	13006: 'Could not load the file',
	13007: [400, 'The file is not an image'],
	13008: 'Could not edit the image',
	13009: 'Could not create the thumbnail',
	13010: 'Could not scan the files',
	13011: 'Could not load the files',

	// Cloudflare
	14000: 'Could not load the resources from Cloudflare',
	14001: 'Could not load the Worker from Cloudflare',
	14002: [403, 'The Cloudflare API token is not allowed to read the Worker'],
	14003: [400, 'This is only available when Pouchbase runs as a Cloudflare Worker'],
	14010: 'Could not load the usage from Cloudflare',
	14011: [403, 'The Cloudflare API token is not allowed to read Account Analytics'],

	// Mail
	15000: 'Sending mail needs the Cloudflare connection',
	15001: [409, 'Sending mail is not set up'],
	15004: 'Could not send the email',

	// Backups
	16000: 'Could not load the backups',
	16001: [404, 'Backup destination not found'],
	16002: 'Could not connect to the backup destination',
	16003: [409, 'A backup or restore is already running'],
	16004: [404, 'Backup not found'],
	16005: [409, 'Not all files of the backup were uploaded'],
	16006: 'Could not delete the backup',
	16007: 'Could not look for backups in the destination',
	16008: [400, 'The schedule is invalid'],
	16009: 'A step of the backup job failed',
	16010: [400, 'This is not a Pouchbase backup: its manifest.json is missing or invalid'],
	16011: [409, 'This upload is no longer active; start it again'],
	16012: 'Could not transfer the backup',

	// Types
	17000: 'Could not load the collections for the types',
	17001: 'Could not load the fields for the types',
	17002: 'Could not check the token',

	// Functions
	18000: 'Could not load the functions',
	18001: [404, 'Function not found'],
	18002: [409, 'A function with this name already exists'],
	18003: [413, 'The code of the function is too large'],
	18004: 'The Cloudflare account has no workers.dev subdomain yet',
	18005: 'Could not deploy the function to Cloudflare',
	18006: 'Could not delete the function on Cloudflare',
	18007: [404, 'Version not found'],
	18008: 'Could not save the secrets of the function',
	18009: [409, 'The function is not deployed yet'],
	18010: 'Could not load the logs of the function',
	18011: [403, 'The Cloudflare API token is not allowed to read the logs'],
	18012: 'Could not run the function',

	// Plugins
	19000: 'Could not reach the plugin registry',
	19001: 'Could not load the plugins',
	19002: [404, 'Plugin not found'],
	19003: [409, 'This plugin does not work with this version of Pouchbase'],
	19004: [400, 'The plugin bundle is invalid'],
	19005: 'Could not install the plugin',
	19006: 'Could not uninstall the plugin',
	19007: 'Could not deploy the plugin to Cloudflare',
	19008: [409, 'Another plugin already provides a sign-in provider with this ID'],
	19009: 'The plugin failed',
	19010: [403, "Built-in plugins can't be uninstalled"],
	19011: 'The Cloudflare account has no workers.dev subdomain yet',
	19012: 'Could not install the built-in plugins',
	19013: 'The plugin route failed',
	19014: [400, "The plugin's UI components could not be compiled"],
	19015: "Could not load the plugin's components",
	19016: [409, 'The field type comes from a plugin that is not installed'],
	19017: 'The plugin could not process the field values',
	19018: [400, 'The plugin settings are invalid'],
	19019: 'Could not save the plugin settings',
	19020: [409, "A collection with the name of one of the plugin's collections already exists"],
	19021: [400, "One of the plugin's collections is invalid"],
	19022: "Could not create, update or delete the plugin's collections",
	19023: [409, "Another collection links to one of the plugin's collections"],

	// Environments
	20000: 'Could not read the schema of this environment',
	20001: 'Could not load the deploy tokens',
	20002: [404, 'Deploy token not found'],
	20003: 'Could not load the deployments',
	20004: [409, 'The target environment changed since the plan was made; make a new plan'],
	20005: [409, 'The changes delete collections, fields or their data; confirm them first'],
	20006: [409, 'A deployment is already running'],
	20007: 'A step of the deployment failed',
	20008: [409, 'No other environment is linked yet'],
	20009: [502, 'The linked environment did not answer'],
	20010: [409, 'The source environment changed since the plan was made; make a new plan'],
	20011: 'A step of the deployment failed',

	// Updates
	21000: 'Could not check for updates',
	21001: [400, 'This instance cannot update itself'],
	21002: [409, 'There is no newer version to install'],
	21003: 'Could not prepare the update',
	21004: 'Could not download the update',
	21005: 'Could not upload the assets of the update',
	21006: 'The update contains invalid modules',
	21007: 'Could not deploy the update to Cloudflare',
	21008: 'Could not update the binary',

	// Realtime
	22000: 'Could not send the realtime event',
	22002: [403, 'This subscription is not allowed'],
	22003: [400, 'The subscription is invalid'],
	22004: 'Could not authorize the realtime connection',

	// API keys
	23000: 'Could not load the API keys',
	23001: [404, 'API key not found'],
	23002: [409, 'The key of a function is renewed when the function is deployed'],
	23003: [409, 'The key of a plugin is renewed when the plugin is installed or updated'],

	// Mail templates
	24000: 'Could not load the mail templates',
	24001: [404, 'Mail template not found'],
	24002: [409, 'A mail template with this name already exists'],
	24003: [403, "Built-in mail templates can't be deleted"],
	24004: [400, 'The template is missing required variables'],
	24005: [400, 'The template is invalid']
};
