import { createHash } from "node:crypto";
import { and, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  childrenTable,
  classMergesTable,
  classesTable,
  classroomDisplayTokensTable,
  custodyEpisodesTable,
  db,
  pool,
  pickupRequestsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

export interface ClassroomDisplayClient {
  res: any;
  displayToken: string;
}

export interface CheckInAlert {
  id: string;
  childId: number;
  childName: string;
  parentName: string;
  classId: number;
  className: string;
  homeClassName?: string;
  requestedServices: "first" | "second" | "both";
  serviceDate: string;
  requestedAt: string;
}

const classClients = new Map<number, Set<ClassroomDisplayClient>>();
let listener: any;
let listenerRetry: ReturnType<typeof setTimeout> | undefined;
let listenerStopping = false;
let listenerStartPromise: Promise<void> | undefined;
interface ClassRefreshState {
  running: boolean;
  latestGeneration: number;
  activeGeneration: number;
  deliveredGeneration: number;
  retryAttempt: number;
  timer?: ReturnType<typeof setTimeout>;
}
const classRefreshStates = new Map<number, ClassRefreshState>();
const REFRESH_RETRY_MS = [250, 1000, 3000, 5000] as const;

async function writeAuthoritativeRefresh(classId: number) {
  const clients = classClients.get(classId);
  if (!clients?.size) return;
  const [queue, checkInAlerts] = await Promise.all([
    db.select().from(pickupRequestsTable).where(and(
      eq(pickupRequestsTable.classId, classId),
      eq(pickupRequestsTable.status, "requested"),
      eq(pickupRequestsTable.serviceDate, todayWAT()),
    )).orderBy(pickupRequestsTable.requestedAt),
    getPendingCheckInAlertsForClass(classId),
  ]);
  await broadcastToClass(classId, {
    type: "refresh",
    queue: queue.map(row => ({
      id: String(row.id), childId: row.childId, childName: row.childName,
      parentName: row.parentName, classId: row.classId, className: row.className,
      ...(row.homeClassName ? { homeClassName: row.homeClassName } : {}),
      requestedAt: row.requestedAt.toISOString(),
    })),
    checkInAlerts,
  });
}

function clearClassRefreshState(classId: number) {
  const state = classRefreshStates.get(classId);
  if (state?.timer) clearTimeout(state.timer);
  classRefreshStates.delete(classId);
}

function requestClassRefresh(classId: number) {
  if (!classClients.get(classId)?.size || listenerStopping) {
    clearClassRefreshState(classId);
    return;
  }
  const existing = classRefreshStates.get(classId);
  if (existing) {
    existing.latestGeneration += 1;
    // A newer signal supersedes an older generation waiting in backoff.
    if (existing.timer) {
      clearTimeout(existing.timer);
      existing.timer = undefined;
      existing.retryAttempt = 0;
      runClassRefresh(classId, existing);
    }
    return;
  }
  const state: ClassRefreshState = {
    running: false,
    latestGeneration: 1,
    activeGeneration: 0,
    deliveredGeneration: 0,
    retryAttempt: 0,
  };
  classRefreshStates.set(classId, state);
  runClassRefresh(classId, state);
}

function runClassRefresh(classId: number, state: ClassRefreshState) {
  if (classRefreshStates.get(classId) !== state || state.running || state.timer) return;
  if (!classClients.get(classId)?.size || listenerStopping) {
    clearClassRefreshState(classId);
    return;
  }
  state.running = true;
  state.activeGeneration = state.latestGeneration;
  const attemptedGeneration = state.activeGeneration;
  void writeAuthoritativeRefresh(classId).then(() => {
    if (classRefreshStates.get(classId) !== state) return;
    state.running = false;
    state.deliveredGeneration = attemptedGeneration;
    state.retryAttempt = 0;
    if (state.latestGeneration > state.deliveredGeneration) {
      runClassRefresh(classId, state);
    } else {
      classRefreshStates.delete(classId);
    }
  }).catch((error) => {
    if (classRefreshStates.get(classId) !== state) return;
    state.running = false;
    logger.warn({ err: error, classId, attempt: state.retryAttempt }, "classroom display refresh failed");
    if (!classClients.get(classId)?.size || listenerStopping) {
      clearClassRefreshState(classId);
      return;
    }
    // Retry budgets are per generation. A signal that arrived while this
    // attempt was running starts the newer generation immediately.
    if (state.latestGeneration > attemptedGeneration) {
      state.retryAttempt = 0;
      runClassRefresh(classId, state);
      return;
    }
    if (state.retryAttempt >= REFRESH_RETRY_MS.length) {
      classRefreshStates.delete(classId);
      return;
    }
    const delay = REFRESH_RETRY_MS[state.retryAttempt++];
    state.timer = setTimeout(() => {
      if (classRefreshStates.get(classId) !== state) return;
      state.timer = undefined;
      runClassRefresh(classId, state);
    }, delay);
  });
}

export function ensureClassroomDisplayListener(): Promise<void> {
  if (listener) return Promise.resolve();
  if (listenerStopping) return Promise.reject(new Error("Classroom display listener is shutting down"));
  if (listenerStartPromise) return listenerStartPromise;
  listenerStartPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query("LISTEN classroom_display_refresh");
    } catch (error) {
      client.release();
      throw error;
    }
    let disconnected = false;
    const reconnect = () => {
      if (disconnected) return;
      disconnected = true;
      if (listener === client) listener = undefined;
      try { client.release(); } catch {}
      if (!listenerStopping && !listenerRetry) {
        listenerRetry = setTimeout(() => {
          listenerRetry = undefined;
          void ensureClassroomDisplayListener().catch(error => {
            logger.warn({ err: error }, "classroom display listener reconnect failed");
          });
        }, 1000);
      }
    };
    client.on("notification", (message: { channel: string; payload?: string }) => {
      if (message.channel !== "classroom_display_refresh") return;
      const classId = Number(message.payload);
      if (Number.isInteger(classId) && classId > 0) requestClassRefresh(classId);
    });
    client.on("error", reconnect);
    client.on("end", reconnect);
    listener = client;
  })().finally(() => { listenerStartPromise = undefined; });
  return listenerStartPromise;
}

const stopListener = () => {
  listenerStopping = true;
  if (listenerRetry) clearTimeout(listenerRetry);
  listenerRetry = undefined;
  for (const classId of classRefreshStates.keys()) clearClassRefreshState(classId);
  const active = listener;
  listener = undefined;
  try { active?.release(); } catch {}
};
process.once("SIGTERM", stopListener);
process.once("SIGINT", stopListener);

const hashDisplayToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function addClassroomDisplayClient(classId: number, client: ClassroomDisplayClient) {
  if (!classClients.has(classId)) classClients.set(classId, new Set());
  classClients.get(classId)!.add(client);
}

export function removeClassroomDisplayClient(classId: number, client: ClassroomDisplayClient) {
  const clients = classClients.get(classId);
  clients?.delete(client);
  if (!clients?.size) clearClassRefreshState(classId);
}

export async function broadcastToClass(classId: number, data: unknown) {
  const clients = classClients.get(classId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  await Promise.all([...clients].map(async (client) => {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(68431, ${classId})`);
        const [credential] = await tx.select({ id: classroomDisplayTokensTable.id })
          .from(classroomDisplayTokensTable)
          .where(and(
            eq(classroomDisplayTokensTable.tokenHash, hashDisplayToken(client.displayToken)),
            eq(classroomDisplayTokensTable.classId, classId),
            isNull(classroomDisplayTokensTable.revokedAt),
            gt(classroomDisplayTokensTable.expiresAt, new Date()),
          ))
          .limit(1);
        if (!credential) {
          removeClassroomDisplayClient(classId, client);
          client.res.write(`event: revoked\ndata: ${JSON.stringify({ reason: "Display credential expired or revoked" })}\n\n`);
          client.res.end();
          return;
        }
        client.res.write(payload);
      });
    } catch {
      removeClassroomDisplayClient(classId, client);
      try { client.res.end(); } catch {}
    }
  }));
}

export function closeClassroomDisplayClients(classId: number, reason: string) {
  const clients = classClients.get(classId);
  if (!clients) return;
  for (const client of clients) {
    try {
      client.res.write(`event: revoked\ndata: ${JSON.stringify({ reason })}\n\n`);
      client.res.end();
    } catch {
      // The browser may already have closed the connection.
    }
  }
  classClients.delete(classId);
  clearClassRefreshState(classId);
}

function todayWAT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function routingContext(
  executor: any,
  childId: number,
  serviceDate: string,
  requestedServices?: CheckInAlert["requestedServices"],
) {
  const [child] = await executor.select({
    id: childrenTable.id,
    firstName: childrenTable.firstName,
    lastName: childrenTable.lastName,
    classId: childrenTable.currentClassId,
  }).from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child?.classId) return null;
  const [homeClass] = await executor.select({ name: classesTable.name })
    .from(classesTable).where(eq(classesTable.id, child.classId)).limit(1);
  const slotCondition = requestedServices === "first"
    ? or(isNull(classMergesTable.serviceSlot), eq(classMergesTable.serviceSlot, "7am"))
    : requestedServices === "second"
      ? or(isNull(classMergesTable.serviceSlot), eq(classMergesTable.serviceSlot, "10:30am"))
      : undefined;
  const [merge] = await executor.select({ targetClassId: classMergesTable.targetClassId })
    .from(classMergesTable).where(and(
      eq(classMergesTable.sourceClassId, child.classId),
      eq(classMergesTable.serviceDate, serviceDate),
      slotCondition,
    )).limit(1);
  const classId = merge?.targetClassId ?? child.classId;
  const [routedClass] = await executor.select({ name: classesTable.name })
    .from(classesTable).where(eq(classesTable.id, classId)).limit(1);
  return {
    childName: `${child.firstName} ${child.lastName}`,
    classId,
    className: routedClass?.name ?? homeClass?.name ?? "Classroom",
    homeClassName: merge ? (homeClass?.name ?? "Assigned class") : undefined,
  };
}

export async function resolveCustodyClassIds(
  executor: any,
  childId: number,
  serviceDate: string,
  requestedServices: CheckInAlert["requestedServices"],
): Promise<number[]> {
  const services = requestedServices === "both" ? ["first", "second"] as const : [requestedServices];
  const contexts = await Promise.all(services.map(service => routingContext(executor, childId, serviceDate, service)));
  return [...new Set(contexts.flatMap(context => context ? [context.classId] : []))];
}

export async function getCheckInAlerts(episodeId: number): Promise<CheckInAlert[]> {
  const [row] = await db.select({
    episode: custodyEpisodesTable,
    requesterFirstName: usersTable.firstName,
    requesterLastName: usersTable.lastName,
  }).from(custodyEpisodesTable)
    .innerJoin(usersTable, eq(usersTable.id, custodyEpisodesTable.requestedBy))
    .where(eq(custodyEpisodesTable.id, episodeId))
    .limit(1);
  if (!row || row.episode.status !== "requested") return [];
  const services = row.episode.requestedServices === "both"
    ? ["first", "second"] as const : [row.episode.requestedServices];
  const alerts: Array<CheckInAlert | null> = await Promise.all(services.map(async requestedServices => {
    const context = await routingContext(db, row.episode.childId, row.episode.serviceDate, requestedServices);
    if (!context) return null;
    return {
    id: String(row.episode.id),
    childId: row.episode.childId,
    childName: context.childName,
    parentName: `${row.requesterFirstName} ${row.requesterLastName}`,
    classId: context.classId,
    className: context.className,
    ...(context.homeClassName ? { homeClassName: context.homeClassName } : {}),
    requestedServices,
    serviceDate: row.episode.serviceDate,
    requestedAt: row.episode.requestedAt.toISOString(),
    } as CheckInAlert;
  }));
  return alerts.filter((alert): alert is CheckInAlert => Boolean(alert))
    .filter((alert, index, all) => all.findIndex(other => other.classId === alert.classId) === index);
}

export async function getCheckInAlert(episodeId: number): Promise<CheckInAlert | null> {
  return (await getCheckInAlerts(episodeId))[0] ?? null;
}

export async function getCustodyAlertClassIds(episodeId: number): Promise<number[]> {
  const [episode] = await db.select({
    childId: custodyEpisodesTable.childId,
    serviceDate: custodyEpisodesTable.serviceDate,
    requestedServices: custodyEpisodesTable.requestedServices,
  }).from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, episodeId)).limit(1);
  if (!episode) return [];
  return resolveCustodyClassIds(db, episode.childId, episode.serviceDate, episode.requestedServices);
}

export async function getPendingCheckInAlertsForClass(classId: number): Promise<CheckInAlert[]> {
  const episodes = await db.select({ id: custodyEpisodesTable.id })
    .from(custodyEpisodesTable)
    .where(and(
      eq(custodyEpisodesTable.status, "requested"),
      eq(custodyEpisodesTable.serviceDate, todayWAT()),
    ))
    .orderBy(custodyEpisodesTable.requestedAt);
  const alerts = await Promise.all(episodes.map(({ id }) => getCheckInAlerts(id)));
  return alerts.flat().filter(alert => alert.classId === classId);
}

type RefreshExecutor = { execute(query: SQL): PromiseLike<unknown> };

/** Transactional signal containing only class ids; PostgreSQL delivers after commit. */
export async function notifyClassRefresh(tx: RefreshExecutor, classIds: number[]) {
  for (const classId of new Set(classIds)) {
    if (!Number.isInteger(classId) || classId < 1) throw new Error("class refresh id must be a positive integer");
    await tx.execute(sql`SELECT pg_notify('classroom_display_refresh', ${String(classId)})`);
  }
}

export async function resolvePickupRequestsForCheckout(tx: any, input: {
  childId: number; serviceDate: string; actorUserId: number; resolvedAt: Date;
}) {
  const resolved = await tx.update(pickupRequestsTable).set({
    status: "resolved",
    resolvedAt: input.resolvedAt,
    resolvedBy: input.actorUserId,
    updatedAt: input.resolvedAt,
  }).where(and(
    eq(pickupRequestsTable.childId, input.childId),
    eq(pickupRequestsTable.serviceDate, input.serviceDate),
    eq(pickupRequestsTable.status, "requested"),
  )).returning({
    id: pickupRequestsTable.id,
    classId: pickupRequestsTable.classId,
    serviceDate: pickupRequestsTable.serviceDate,
  });
  await notifyClassRefresh(tx, resolved.map((row: { classId: number }) => row.classId));
  return resolved;
}