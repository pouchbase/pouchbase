<script lang="ts">
	import * as Callout from '#lib/components/ui/callout/index.js';
	import * as Code from '#lib/components/ui/code/index.js';
	import * as CodeBlock from '#lib/components/ui/code-block/index.js';
	import * as Icon from '#lib/components/ui/icon/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import DocsPage, { type Section } from '../../../docs-page.svelte';
	import DocsTable from '../../../docs-table.svelte';

	let { data }: PageProps = $props();

	const sections: Section[] = [
		{ id: 'conditions', title: 'Conditions' },
		{ id: 'operands', title: 'Operands' },
		{ id: 'related-records', title: 'Related records' },
		{ id: 'operators', title: 'Operators' },
		{ id: 'functions', title: 'Functions' },
		{ id: 'dates', title: 'Dates' },
		{ id: 'empty-values', title: 'Empty values' },
		{ id: 'examples', title: 'Examples' },
		{ id: 'limits', title: 'Limits and errors' }
	];

	const operands = [
		['title  views  author', 'A field of the record'],
		['author.role  post.author.name', 'A field of a related record (see Related records)'],
		['"text"  \'text\'', 'A string, in double or single quotes; \\" escapes a quote'],
		['42  -1  3.14', 'A number'],
		['true  false', 'A boolean'],
		['null', 'An empty value (see below)'],
		['$user.<field>', 'A field of the signed-in user, such as $user.id or $user.role'],
		['$input.<field>', 'The value sent for a field, in create and update rules'],
		['lower(title)  now()', 'A function call; see Functions']
	];

	const operators = [
		['==  !=', 'Equal, not equal'],
		['>  >=  <  <=', 'Greater and less than, for numbers, dates and text'],
		[
			'any(<field>)',
			'Each item of a multiple field: true when any item matches, as in any(tags) == "news" or contains(any(tags), "re")'
		],
		['not', 'The opposite of a condition: not contains(title, "draft")'],
		['and  or', 'Both, either; not goes before and, and before or'],
		['( )', 'Grouping'],
		['# …', 'A comment, until the end of the line']
	];

	const functions = [
		['contains(text, search)', 'The text contains search, in any case'],
		['starts_with(text, prefix)', 'The text starts with prefix, in any case'],
		['ends_with(text, suffix)', 'The text ends with suffix, in any case'],
		[
			'like(text, pattern)',
			'The text matches the pattern, in any case: % is any text, _ one character (at most 50 bytes)'
		],
		['lower(text)  upper(text)', 'The text in lowercase, in uppercase'],
		['trim(text)', 'The text without spaces at the start and end'],
		['length(text)', 'The number of characters; 0 for an empty value'],
		['abs(number)', 'The number without its sign'],
		['round(number, digits?)', 'The number rounded, to a number of decimals (0 by default)'],
		['count(field)', 'The number of items of a multiple relation, file or list field; 0 when empty']
	];

	const dateFunctions = [
		['now()', 'The current date and time'],
		['today()', 'Today, as YYYY-MM-DD'],
		['date(date)', 'The day of a date, as YYYY-MM-DD'],
		[
			'date_add(date, amount, unit)',
			'The date plus an amount of "years", "months", "weeks", "days", "hours", "minutes" or "seconds" ("day" works too); a negative amount goes back'
		],
		[
			'start_of(date, unit)',
			'The start of the "year", "month", "week" (Monday), "day" or "hour" of a date'
		],
		['year(date)  month(date)  day(date)', 'The year, the month (1 to 12), the day of the month'],
		['weekday(date)', 'The day of the week, 1 (Monday) to 7 (Sunday)'],
		['hour(date)  minute(date)', 'The hour (0 to 23), the minute (0 to 59)']
	];

	const examples = [
		['status == "published"', 'Published posts'],
		['status != "draft" and views >= 100', 'Not drafts, with 100 views or more'],
		['contains(title, "svelte")', 'Svelte in the title, in any case'],
		['not contains(title, "draft")', 'No draft in the title'],
		['starts_with(slug, "release-")', 'A slug that starts with release-'],
		['lower(status) == "draft"', 'Draft, in any case'],
		['length(title) <= 80', 'A title of at most 80 characters'],
		['any(tags) == "news"', 'Tagged news'],
		['contains(any(tags), "re")', 'A tag with re in it: release'],
		['count(tags) >= 2', 'At least two tags'],
		['tags == ""', 'No tags at all'],
		['cover != null', 'Has a cover'],
		['published_at <= now()', 'Published by now'],
		['published_at > "2026-01-01"', 'Published after the start of 2026'],
		['created_at >= date_add(now(), -7, "days")', 'Created in the last seven days'],
		['created_at >= start_of(now(), "month")', 'Created this month'],
		['date(published_at) == today()', 'Published today'],
		['weekday(starts_at) >= 6', 'Starts on a weekend'],
		['author == $user.id', 'Written by the signed-in user'],
		['author.role == "admin"', 'Written by an admin'],
		['post.author == $user.id', 'Comments on posts of the signed-in user'],
		['any(editors.team.name) == "Docs"', 'An editor in the Docs team'],
		['featured == true or (status == "published" and views > 500)', 'Featured, or popular']
	];

	const problems = [
		['status = "draft"', 'Use `==` to compare'],
		['a && b', 'Use `and` to combine conditions'],
		['title contains "x"', 'Use `contains(text, search)` or `not contains(text, search)`'],
		['published_at <= $now', 'Use `now()` for the current date and time'],
		['contains(title)', 'Call it as `contains(text, search)`'],
		['lower(title)', 'Compare `lower()` with a value, e.g. `lower(status) == "draft"`'],
		['date_add(now(), 1, "fortnight") > a', 'The unit of `date_add()` is one of "years", …'],
		['nope(title) == 1', 'Unknown function `nope()`'],
		['editors.role == "admin"', '`editors` holds several records; use `any(editors.role)`'],
		['title.length == 1', '`title` is not a relation, so `title.length` doesn’t exist'],
		[
			'author.role == "admin"',
			'The API doesn’t show records of `users`, so `author.role` can’t be used (in a where)'
		],
		['$me.id', 'Unknown variable `$me.id`; use $user.<field> or $input.<field>'],
		['status == "draft', 'Unterminated string'],
		['(views > 10', 'Missing `)`']
	];
</script>

<DocsPage
	title="Filters"
	description="The condition syntax that picks records: in access rules, in the where of the JS SDK and the REST API, and in realtime subscriptions."
	{sections}
>
	<h2 id="conditions">Conditions</h2>

	<p>
		A condition is an expression that is true or false for a record, such as
		<Code.Root>status == "published" and views &gt; 10</Code.Root>. The same syntax is used in four
		places:
	</p>

	<ul>
		<li>
			the <Code.Root>where</Code.Root> of the <a href={resolve('/docs/sdk/filters')}>JS SDK</a>,
			which builds conditions from objects;
		</li>
		<li>
			the <Code.Root>where</Code.Root> parameter of the
			<a href="{resolve('/docs/api/records')}#list-records">REST API</a>;
		</li>
		<li>
			the <Code.Root>where</Code.Root> of a
			<a href={resolve('/docs/platform/realtime')}>realtime subscription</a>;
		</li>
		<li>
			custom <a href={resolve('/docs/platform/collections/access-rules')}>access rules</a>, which
			the rule editor checks as you type.
		</li>
	</ul>

	<h2 id="operands">Operands</h2>

	<p>
		A condition compares two operands, or is a function that is true or false on its own, such as
		<Code.Root>contains(title, "svelte")</Code.Root>:
	</p>

	<DocsTable head={['Operand', 'Meaning']} rows={operands} />

	<p>
		<Code.Root>$user</Code.Root> is the user whose token came with the request; any field of
		<Code.Root>users</Code.Root> can follow it, including fields you added. When nobody is signed in,
		<Code.Root>$user.id != null</Code.Root> is false, and a comparison such as
		<Code.Root>author == $user.id</Code.Root> matches no record, not even those without an author.
		<Code.Root>$input</Code.Root> is only set in create and update rules; see
		<a href="{resolve('/docs/platform/collections/access-rules')}#checking-what-is-written"
			>Access rules</a
		>.
	</p>

	<h2 id="related-records">Related records</h2>

	<p>
		A relation field followed by a dot and a field name is that field of the related record:
		<Code.Root>author.role</Code.Root> is the role of the post's author, and
		<Code.Root>post.author.name</Code.Root> on a comment the name of the author of its post. A path goes
		through at most three relations. It works anywhere a field does, also in functions:
		<Code.Root>lower(author.name) == "ada"</Code.Root>. When the relation is empty, or the related
		record is gone, the field is empty too, so <Code.Root>author.role == null</Code.Root> matches posts
		without an author.
	</p>

	<p>
		A multiple relation points to several records, so its fields go in <Code.Root>any()</Code.Root>:
		<Code.Root>any(editors.role) == "admin"</Code.Root> is true when one of the editors is an admin. The
		path may go on after it (<Code.Root>any(editors.team.name)</Code.Root>).
	</p>

	<p>
		In a <Code.Root>where</Code.Root>, related records are checked against the view rule of their
		collection, as with <Code.Root>include</Code.Root>: a related record the user may not see counts
		as empty, so a filter can't find out what is in it, and a collection the API doesn't show can't
		be followed at all. Hidden fields can't be used either. Access rules are written by you, so they
		see every related record and field.
	</p>

	<h2 id="operators">Operators</h2>

	<DocsTable head={['Operator', 'Meaning']} rows={operators} />

	<p>
		<Code.Root>and</Code.Root> binds more tightly than <Code.Root>or</Code.Root>, so
		<Code.Root>a or b and c</Code.Root> means <Code.Root>a or (b and c)</Code.Root>; add parentheses
		when you mean otherwise. A long condition can span several lines, with comments:
	</p>

	<CodeBlock.Root title="Condition">
		<CodeBlock.Source code={data.code.multiline} />
	</CodeBlock.Root>

	<h2 id="functions">Functions</h2>

	<p>
		Functions turn a value into another one, such as <Code.Root>lower(title)</Code.Root> or
		<Code.Root>length(title)</Code.Root>, which you then compare:
		<Code.Root>length(title) &lt;= 80</Code.Root>. <Code.Root>contains</Code.Root>,
		<Code.Root>starts_with</Code.Root>, <Code.Root>ends_with</Code.Root> and <Code.Root
			>like</Code.Root
		>
		are true or false, so they are conditions of their own; put <Code.Root>not</Code.Root> in front for
		the opposite. The rule editor suggests them as you type. Arguments are values: fields, strings, numbers,
		<Code.Root>$user</Code.Root> and <Code.Root>$input</Code.Root> fields, and other functions.
	</p>

	<DocsTable head={['Function', 'Gives']} rows={functions} />

	<p>
		"In any case" means without regard to upper and lower case for the letters A to Z; other
		letters, such as é and É, are compared exactly.
	</p>

	<h2 id="dates">Dates</h2>

	<p>
		Date fields hold ISO 8601 text, and Created and Updated fields milliseconds since 1970;
		conditions compare them all as dates. <Code.Root>published_at &lt;= now()</Code.Root>,
		<Code.Root>created_at &lt;= now()</Code.Root> and <Code.Root
			>created_at &gt;= "2026-01-01"</Code.Root
		>
		all work, and so does comparing a Created field with a Date field. A string such as
		<Code.Root>"2026-01-01"</Code.Root> or <Code.Root>"2026-01-01T09:30"</Code.Root> counts as UTC unless
		it ends in a zone (<Code.Root>"2026-01-01T09:30:00+02:00"</Code.Root>). Every date function
		works in UTC.
	</p>

	<DocsTable head={['Function', 'Gives']} rows={dateFunctions} />

	<h2 id="empty-values">Empty values</h2>

	<p>
		<Code.Root>null</Code.Root> and <Code.Root>""</Code.Root> both stand for an empty value:
		<Code.Root>cover == null</Code.Root> and <Code.Root>cover == ""</Code.Root> both match records without
		a cover, and <Code.Root>!=</Code.Root> matches the ones with one. For a multiple field,
		<Code.Root>tags == ""</Code.Root> matches records without any tags. The other comparisons never match
		an empty value: <Code.Root>views &lt; 10</Code.Root> leaves out records without views.
	</p>

	<p>
		<Code.Root>not</Code.Root> matches everything the condition doesn't:
		<Code.Root>not (views &gt; 10)</Code.Root> includes records without views, and
		<Code.Root>not contains(title, "x")</Code.Root> records without a title.
	</p>

	<h2 id="examples">Examples</h2>

	<DocsTable head={['Condition', 'Matches']} rows={examples} />

	<h2 id="limits">Limits and errors</h2>

	<ul>
		<li>A condition has at most 3,500 characters, 30 comparisons and 30 function calls.</li>
		<li>
			A path goes through at most three relations (<Code.Root>post.author.team.name</Code.Root>).
			Blob fields can't be compared.
		</li>
		<li>
			In conditions of app users (their <Code.Root>where</Code.Root>),
			<a href="{resolve('/docs/platform/collections')}#hidden-fields">hidden fields</a>
			don't exist: not of the collection, not through a path, and not as
			<Code.Root>$user.&lt;field&gt;</Code.Root>. Access rules can use them.
		</li>
		<li>
			Field names are lowercase letters, digits and underscores, starting with a letter;
			<Code.Root>and</Code.Root>, <Code.Root>or</Code.Root> and <Code.Root>not</Code.Root> are keywords.
			A field may share its name with a function (<Code.Root>date</Code.Root>,
			<Code.Root>count</Code.Root>): without parentheses it is the field.
		</li>
	</ul>

	<p>
		An invalid <Code.Root>where</Code.Root> fails with <Code.Root>invalid</Code.Root> (400), and the message
		says what is wrong:
	</p>

	<CodeBlock.Root title="400 Bad Request">
		<CodeBlock.Source code={data.code.filterError} />
	</CodeBlock.Root>

	<DocsTable head={['Condition', 'Message']} rows={problems} />

	<Callout.Root variant="warning">
		<Callout.Icon><Icon.Root icon="lucide:triangle-alert" /></Callout.Icon>
		<Callout.Body>
			<Callout.Title>A broken rule locks the action</Callout.Title>
			<Callout.Description>
				The same mistakes in an access rule make the action fail with <Code.Root
					>forbidden</Code.Root
				>, for example after a field the rule uses was deleted. The rule editor underlines them.
			</Callout.Description>
		</Callout.Body>
	</Callout.Root>
</DocsPage>
