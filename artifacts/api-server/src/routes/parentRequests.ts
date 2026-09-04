import { Router } from "express";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import {
  attendanceTable,
  childrenTable,
  classChangeRequestsTable,
  classesTable,
  custodyEpisodesTable,
  db,
  familiesTable,
  parentConcernsTable,
  parentFeedbackTable,
  pickupDelegatesTable,
} from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { getPickupRequestsForChildren } from "./pickupRequests";
import { GetParentRequestParams, GetParentRequestResponse, ListParentRequestsQueryParams, ListParentRequestsResponse } from "@workspace/api-zod";

const router = Router();
const requestTypes = ["custody", "pickup", "delegate", "class_change", "concern", "feedback"] as const;
type RequestType = typeof requestTypes[number];

type ParentRequestItem = {
  id: string;
  sourceId: number | string;
  requestType: RequestType;
  title: string;
  childId: number | null;
  childName: string | null;
  status: string;
  serviceDate: string | null;
  createdAt: string;
  deepLink: string;
  summary: string | null;
};

function lagosDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function loadParentCenter(userId: number): Promise<{
  children: Array<{ id: number; firstName: string; lastName: string; checkedIn: boolean }>;
  items: ParentRequestItem[];
}> {
  const families = await db.select({ id: familiesTable.id }).from(familiesTable).where(or(
    eq(familiesTable.parent1Id, userId),
    eq(familiesTable.parent2Id, userId),
  ));
  const familyIds = families.map(family => family.id);
  if (familyIds.length === 0) return { children: [], items: [] };

  const ownedChildren = await db.select({
    id: childrenTable.id,
    firstName: childrenTable.firstName,
    lastName: childrenTable.lastName,
  }).from(childrenTable).where(inArray(childrenTable.familyId, familyIds));
  const childIds = ownedChildren.map(child => child.id);
  const childNames = new Map(ownedChildren.map(child => [child.id, `${child.firstName} ${child.lastName}`]));
  if (childIds.length === 0) return { children: [], items: [] };

  const today = lagosDate();
  const [attendance, custody, delegates, classChanges, concerns, feedback, classes] = await Promise.all([
    db.select({ childId: attendanceTable.childId }).from(attendanceTable).where(and(
      inArray(attendanceTable.childId, childIds),
      eq(attendanceTable.serviceDate, today),
      ne(attendanceTable.status, "picked_up"),
    )),
    db.select().from(custodyEpisodesTable)
      // familyId alone is not enough: a stale/orphaned custody row must never
      // be shown unless its child is still in this parent's owned child set.
      .where(inArray(custodyEpisodesTable.childId, childIds))
      .orderBy(desc(custodyEpisodesTable.createdAt)),
    db.select().from(pickupDelegatesTable)
      .where(inArray(pickupDelegatesTable.childId, childIds))
      .orderBy(desc(pickupDelegatesTable.createdAt)),
    db.select().from(classChangeRequestsTable)
      .where(inArray(classChangeRequestsTable.childId, childIds))
      .orderBy(desc(classChangeRequestsTable.createdAt)),
    db.select().from(parentConcernsTable)
      .where(eq(parentConcernsTable.parentUserId, userId))
      .orderBy(desc(parentConcernsTable.createdAt)),
    db.select().from(parentFeedbackTable)
      .where(eq(parentFeedbackTable.parentId, userId))
      .orderBy(desc(parentFeedbackTable.createdAt)),
    db.select({ id: classesTable.id, name: classesTable.name }).from(classesTable),
  ]);
  const checkedIn = new Set(attendance.map(row => row.childId));
  const classNames = new Map(classes.map(cls => [cls.id, cls.name]));
  const items: ParentRequestItem[] = [];

  for (const row of custody) items.push({
    id: `custody:${row.id}`, sourceId: row.id, requestType: "custody",
    title: "Child check-in request", childId: row.childId, childName: childNames.get(row.childId) ?? null,
    status: row.status, serviceDate: row.serviceDate, createdAt: iso(row.createdAt),
    deepLink: "/my-family", summary: `${row.requestedServices.replace("_", " ")} service`,
  });
  for (const row of await getPickupRequestsForChildren(childIds)) items.push({
    id: `pickup:${row.id}`, sourceId: row.id, requestType: "pickup",
    title: "Pickup request", childId: row.childId, childName: childNames.get(row.childId) ?? null,
    status: "requested", serviceDate: today, createdAt: iso(row.requestedAt),
    deepLink: "/my-family", summary: "The classroom has been notified",
  });
  for (const row of delegates) items.push({
    id: `delegate:${row.id}`, sourceId: row.id, requestType: "delegate",
    title: `Pickup delegate: ${row.name}`, childId: row.childId, childName: childNames.get(row.childId) ?? null,
    status: row.approvalStatus ?? (row.parentApproved ? "approved" : "created"),
    serviceDate: null, createdAt: iso(row.createdAt), deepLink: "/pickup-delegates",
    summary: row.parentApproved ? "Approved pickup delegate" : "Pickup delegate awaiting approval",
  });
  for (const row of classChanges) items.push({
    id: `class_change:${row.id}`, sourceId: row.id, requestType: "class_change",
    title: "Class change request", childId: row.childId, childName: childNames.get(row.childId) ?? null,
    status: row.status, serviceDate: null, createdAt: iso(row.createdAt),
    deepLink: "/class-change-requests", summary: `Requested ${classNames.get(row.requestedClassId) ?? "class"}`,
  });
  for (const row of concerns) items.push({
    id: `concern:${row.id}`, sourceId: row.id, requestType: "concern",
    title: row.type.replaceAll("_", " "), childId: row.childId, childName: row.childId ? childNames.get(row.childId) ?? null : null,
    status: row.status, serviceDate: null, createdAt: iso(row.createdAt),
    deepLink: "/my-concerns", summary: `Reference ${row.referenceNumber}`,
  });
  for (const row of feedback) items.push({
    id: `feedback:${row.id}`, sourceId: row.id, requestType: "feedback",
    title: "Service feedback", childId: null, childName: null,
    status: "submitted", serviceDate: row.serviceDate, createdAt: iso(row.createdAt),
    deepLink: "/feedback", summary: `${Number(row.rating)}/5 overall rating`,
  });

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    children: ownedChildren.map(child => ({ ...child, checkedIn: checkedIn.has(child.id) })),
    items,
  };
}

router.get("/parent-requests", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const center = await loadParentCenter(req.user!.userId);
  const query = ListParentRequestsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Bad request", message: query.error.message });
    return;
  }
  const { type, status } = query.data;
  const items = center.items.filter(item =>
    (!type || item.requestType === type) && (!status || item.status === status)
  );
  const counts = requestTypes.reduce<Record<string, number>>((result, requestType) => {
    result[requestType] = center.items.filter(item => item.requestType === requestType).length;
    return result;
  }, {});
  res.json(ListParentRequestsResponse.parse({ items, children: center.children, counts, total: items.length, refreshedAt: new Date().toISOString() }));
});

router.get("/parent-requests/:type/:id", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const params = GetParentRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Bad request", message: params.error.message });
    return;
  }
  const { type, id } = params.data;
  const center = await loadParentCenter(req.user!.userId);
  const item = center.items.find(candidate => candidate.requestType === type && String(candidate.sourceId) === id);
  if (!item) {
    res.status(404).json({ error: "Not found", message: "Request not found" });
    return;
  }
  res.json(GetParentRequestResponse.parse(item));
});

export default router;