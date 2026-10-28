export { createClient, Pouchbase } from './client.js';
export type { PouchbaseOptions, RequestOptions } from './client.js';
export { browserStorage, memoryStorage, Session } from './session.js';
export type { SessionData, SessionListener, SessionStorage } from './session.js';
export { isPouchbaseError, PouchbaseError } from './error.js';
export type { ErrorKind, Pending, Result } from './error.js';
export { decodeToken, isTokenValid } from './jwt.js';
export { AuthService } from './services/auth.js';
export type { OAuthOptions } from './services/auth.js';
export { SchemaService } from './services/schema.js';
export type {
	ApiRules,
	CollectionExport,
	CollectionField,
	CollectionIndex,
	CollectionSchema,
	CreateCollectionInput,
	FieldInput,
	FieldOptions,
	FieldType,
	ImportOptions,
	ImportPlan,
	IndexInput,
	Severity,
	ThumbnailSettings,
	UpdateCollectionInput
} from './services/schema.js';
export { FilesService } from './services/files.js';
export type { FileUrlOptions } from './services/files.js';
export { FunctionsService } from './services/functions.js';
export type { InvokeOptions } from './services/functions.js';
export { MailService } from './services/mail.js';
export type { CustomMail, SendCustomMailOptions, SendMailOptions } from './services/mail.js';
export { CollectionClient } from './services/db.js';
export { RealtimeService } from './services/realtime.js';
export type {
	SubscribeOptions,
	Topic,
	TopicCollection,
	TopicOutput,
	TopicRecord,
	TopicRelations
} from './services/realtime.js';
export { RealtimeConnection } from './realtime/connection.js';
export type {
	ConnectionState,
	RealtimeEvent,
	RealtimeSubscription,
	SubscriptionRequest,
	WebSocketInstance,
	WebSocketLike
} from './realtime/connection.js';
export type { RealtimeAction } from './realtime/protocol.js';
export type {
	AnyInclude,
	AnyRecord,
	AnyRelations,
	CallOptions,
	CollectionSubscribeOptions,
	CreateOf,
	Db,
	FindFirstOptions,
	FindManyOptions,
	Include,
	Included,
	IterateOptions,
	Page,
	RecordOf,
	RelationsOf,
	SelectOptions
} from './services/db.js';
export { condition } from './query.js';
export type {
	Condition,
	ConditionValue,
	FieldCondition,
	FieldName,
	JsonValue,
	OrderBy,
	Selected,
	Where
} from './query.js';
export { fetchTypes } from './typegen.js';
export type { FetchTypesOptions } from './typegen.js';
export { KNOWN_OAUTH_PROVIDERS } from './types.js';
export type {
	AuthResult,
	DefaultCollections,
	DefaultMailTemplates,
	Issues,
	KnownOAuthProvider,
	OAuthProvider,
	OAuthProviderInfo,
	RegisterInput,
	RegisterResult,
	User,
	UserOf
} from './types.js';
