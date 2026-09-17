//#region node_modules/.nitro/vite/services/ssr/assets/db-Q6crUSgl.js
var _0002_watchboard_default = "create table if not exists officers (\n  id            text primary key,\n  name          text not null,\n  unit          text not null,\n  rank_sort     integer not null,\n  role          text not null default 'deputy',\n  hire_date     text,\n  tmt           boolean not null default false,\n  radio_num     integer,\n  rdo_days      text not null default '',\n  default_zone  text,\n  last_name     text not null\n);\n\ncreate table if not exists zone_assignments (\n  id          serial primary key,\n  date        text not null,\n  officer_id  text not null references officers(id),\n  zone        text not null,\n  unique (date, officer_id)\n);\ncreate index if not exists zone_assignments_date_idx on zone_assignments (date);\n\ncreate table if not exists time_off_requests (\n  id          serial primary key,\n  officer_id  text not null references officers(id),\n  start_date  text not null,\n  end_date    text not null,\n  kind        text not null,\n  reason      text not null default '',\n  status      text not null default 'pending',\n  created_at  timestamptz not null default now()\n);\ncreate index if not exists time_off_requests_status_idx on time_off_requests (status);\ncreate index if not exists time_off_requests_dates_idx on time_off_requests (start_date, end_date);\n\ncreate table if not exists schedule_meta (\n  key   text primary key,\n  value text not null\n);\n\ninsert into officers (id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name) values\n  ('keyes',      'LT. C. KEYES',          '305', 1, 'lt',     '2007-05-14', false, null, '5,6', 'ALL',    'KEYES'),\n  ('johnson',    'SGT. R. JOHNSON',       '306', 2, 'sgt',    '1997-04-17', false, null, '0,6', 'ALL',    'JOHNSON'),\n  ('henry',      'CPL. S. HENRY',         '307', 3, 'cpl',    '2022-06-05', true,  null, '4,5', 'ALL',    'HENRY'),\n  ('garmon',     'CPL/FTO J. GARMON',     '308', 4, 'cpl',    '2017-02-01', false, null, '0,1', 'RW',     'GARMON'),\n  ('means',      'R. MEANS',              '309', 5, 'deputy', '2024-12-01', false, 8,    '1,2', null,     'MEANS'),\n  ('griese',     'FTO. A.GRIESE',         '310', 6, 'fto',    '2021-02-07', false, 1,    '5,6', null,     'GRIESE'),\n  ('hill',       'D.HILL',                '311', 7, 'deputy', '2025-02-03', false, 8,    '2,3', null,     'HILL'),\n  ('gainey',     'J. GAINEY',             '312', 8, 'deputy', '2025-03-31', false, 10,   '1,2', null,     'GAINEY'),\n  ('hudgens',    'J.HUDGENS',             '313', 9, 'deputy', '2021-04-25', false, 3,    '0,6', null,     'HUDGENS'),\n  ('scott',      'J. SCOTT',              '314', 10,'deputy', '2024-06-07', false, 7,    '3,4', 'NW',     'SCOTT'),\n  ('brazelton',  'T.BRAZELTON',           '315', 11,'deputy', '2022-10-10', true,  5,    '3,4', 'NE',     'BRAZELTON'),\n  ('anderson',   'A.ANDERSON',            '316', 12,'deputy', '2023-04-09', false, 6,    '1,2', 'SE',     'ANDERSON'),\n  ('metcalf',    'S.METCALF',             '317', 13,'deputy', '2021-02-07', false, 2,    '0,6', null,     'METCALF'),\n  ('harris',     'D.HARRIS',              '318', 14,'deputy', '2022-08-07', false, 4,    '0,1', 'RE',     'HARRIS'),\n  ('ladd',       'R.LADD',                '319', 15,'deputy', '2023-06-13', true,  1,    '4,5', null,     'LADD'),\n  ('dodson',     'B.DODSON',              '320', 16,'deputy', '2026-08-03', false, 11,   '2,3', 'SW',     'DODSON');\n\ninsert into schedule_meta (key, value) values\n  ('effective_date', '2026-08-30');\n\ninsert into time_off_requests (officer_id, start_date, end_date, kind, reason, status) values\n  ('gainey', '2026-09-13', '2026-09-19', 'vacation', 'Annual leave — approved on the RDO sheet', 'approved'),\n  ('means',  '2026-09-18', '2026-09-18', 'training', 'In-service firearms', 'pending'),\n  ('hill',   '2026-09-15', '2026-09-15', 'court',    'Circuit court subpoena', 'pending'),\n  ('ladd',   '2026-09-21', '2026-09-22', 'vacation', 'Family travel', 'pending');\n";
/**
* Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
* (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
*
* Applied files are keyed by BASENAME, so the same file applies once no matter
* which directory it is globbed from. That is what makes the auth schema safe to
* copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
* a database that already has `0001_auth.sql` will not re-run it.
*
* Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
* out of scope for both until it is copied up.
*/
/**
* The `_migrations` key for a migration path (or bare filename).
* @param {string} path
* @returns {string}
*/
function migrationName(path) {
	return path.split("/").pop() ?? path;
}
/**
* @param {string} path
* @returns {boolean}
*/
function isMigrationFile(path) {
	return path.endsWith(".sql");
}
/**
* Migrations in `paths` that are not yet in `applied`, in apply order.
* Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
* @param {Iterable<string>} paths
* @param {Iterable<string>} applied
* @returns {Array<{ name: string, path: string }>}
*/
function pendingMigrations(paths, applied) {
	const done = new Set(applied);
	return [...paths].filter(isMigrationFile).map((path) => ({
		name: migrationName(path),
		path
	})).sort((a, b) => a.name.localeCompare(b.name)).filter(({ name }) => !done.has(name));
}
var rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
var databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : void 0;
/**
* Active backend: real **Neon** when `DATABASE_URL` is set (deployed / configured
* sandbox), otherwise a local embedded **PGLite** (Postgres compiled to WASM) so
* the app has a working database even with nothing configured — the live preview
* included. Swap in Neon later by just setting `DATABASE_URL`; no code changes.
*/
var dbSource = databaseUrl ? "neon" : "pglite";
/**
* Init state lives on globalThis as promises: dev HMR creates new instances of
* this module, and two instances racing module-level state would open a second
* pool or run two concurrent PGLite migration passes (whose duplicate
* `_migrations` insert rejects — and would get memoized, poisoning every later
* `getSql()`). A failed init clears its slot so the next call retries.
*/
var globalRef = globalThis;
/**
* Result-type parity: Postgres sends every value as text plus a type OID — the
* JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
* int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
* JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
* production return identical, JSON-safe shapes:
*   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
*                                   `::text` if you ever need huge integers)
*   date                         -> 'YYYY-MM-DD' string
*   interval                     -> Postgres interval text
* numeric already comes back as a string on both (arbitrary precision).
*/
var OID_INT8 = 20;
var OID_DATE = 1082;
var OID_INTERVAL = 1186;
var identity = (v) => v;
/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0];
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
		return run(text, values);
	});
	sql.query = (text, params = []) => run(text, params);
	return sql;
}
function createNeonSql() {
	globalRef.__pgSqlPromise__ ??= (async () => {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(OID_INT8, Number);
		types.setTypeParser(OID_DATE, identity);
		types.setTypeParser(OID_INTERVAL, identity);
		const pool = new Pool({ connectionString: databaseUrl });
		return toSql(async (text, params) => {
			return (await pool.query(text, params)).rows;
		});
	})().catch((err) => {
		globalRef.__pgSqlPromise__ = void 0;
		throw err;
	});
	return globalRef.__pgSqlPromise__;
}
async function createPgliteSql() {
	globalRef.__pgliteInstance__ ??= (async () => {
		const { PGlite } = await import("../_libs/electric-sql__pglite.mjs").then((n) => n.t);
		const pg = new PGlite({ parsers: {
			[OID_INT8]: Number,
			[OID_DATE]: identity,
			[OID_INTERVAL]: identity
		} });
		await pg.waitReady;
		await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
		return pg;
	})().catch((err) => {
		globalRef.__pgliteInstance__ = void 0;
		throw err;
	});
	const pg = await globalRef.__pgliteInstance__;
	const migrate = async () => {
		const migrations = /* #__PURE__ */ Object.assign({ "/migrations/0002_watchboard.sql": _0002_watchboard_default });
		const done = (await pg.query("select name from _migrations")).rows.map((r) => r.name);
		for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) await pg.transaction(async (tx) => {
			await tx.exec(migrations[path]);
			await tx.query("insert into _migrations (name) values ($1)", [name]);
		});
	};
	const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve()).catch(() => void 0).then(migrate);
	globalRef.__pgliteMigrateChain__ = pass;
	await pass;
	return toSql(async (text, params) => {
		return (await pg.query(text, params)).rows;
	});
}
var sqlPromise = null;
async function createSql() {
	if (typeof window !== "undefined") throw new Error("@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.");
	return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}
/**
* Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
* otherwise the local PGLite fallback. Memoized — safe to call per request.
*
* Schema comes from `migrations/*.sql`, auto-applied before the first query on
* both backends — define tables there, never inline in server functions.
*/
function getSql() {
	sqlPromise ??= createSql().catch((err) => {
		sqlPromise = null;
		throw err;
	});
	return sqlPromise;
}
/**
* Finish DB bootstrap before the server handles traffic.
*
* - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
*   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
* - **Neon**: no-op (pool is created lazily on first query).
*
* Vite `configureServer` awaits this at dev startup; production imports of this
* module kick it off immediately (see bottom of file).
*/
function ensureDbReady() {
	if (dbSource !== "pglite") return Promise.resolve();
	return getSql().then(() => void 0);
}
var globalBoot = globalThis;
if (typeof window === "undefined" && dbSource === "pglite") globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
	globalBoot.__pgBootstrapPromise__ = void 0;
	console.error("[db] PGLite bootstrap failed:", err);
	throw err;
});
//#endregion
export { getSql };
