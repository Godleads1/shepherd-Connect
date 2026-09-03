# SHEPHERD CONNECT
# PHASES 1–5 HUMAN ACCEPTANCE + PHASE 6 MASTER BRIEF

## HUMAN DECISION — PHASES 1–5

I have reviewed the Consolidated Phase 1–5 Implementation Report dated 3 September 2026.

**PHASES 1–5 ARE HUMAN-ACCEPTED AS DEVELOPMENT-COMPLETE.**

This acceptance covers the implemented and verified development controls for:

- Phase 1 — Authentication boundary and user-record privacy
- Phase 2 — Registration OTP security and abuse prevention
- Phase 3 — Multi-role concurrency and role integrity
- Phase 4 — Attendance and offline integrity
- Phase 5 — Notification outbox, SSE and operational reliability

This acceptance does **NOT** authorize production deployment.

The existing security, transactional-integrity, concurrency, authentication, authorization, notification-durability, data-integrity and audit protections established in Phases 1–5 must be preserved.

Do not weaken an existing Phase 1–5 security control merely to simplify Phase 6.

---

# PHASE 6

## ATTENDANCE OPERATIONS, JUNIOR CHURCH CARE, WHATSAPP PARENT EXPERIENCE, REPORTING & FINAL SECURITY HARDENING

Phase 6 will improve:

- Staff attendance.
- Service-specific attendance.
- Child check-in.
- Parent-initiated attendance.
- Physical child handover.
- Child checkout/pickup ownership.
- Junior Church class registers.
- Teacher visibility.
- Parent and teacher notifications.
- WhatsApp parent functionality.
- Administrative reporting.
- Downloadable operational reports.
- API/state-machine consistency.
- Final security and operational integration.

---

# CRITICAL EXECUTION RULE

## DO NOT IMPLEMENT PHASE 6 YET.

First perform a **READ-ONLY architecture, security, API, database, concurrency, workflow, notification, authorization and reporting analysis** against the existing Phase 1–5 implementation.

During this analysis:

- Do not modify code.
- Do not modify tests.
- Do not modify schema.
- Do not apply migrations.
- Do not change dependencies.
- Do not change secrets.
- Do not change provider configuration.
- Do not modify workflows.
- Do not modify development or production data.
- Do not deploy.
- Do not commit.
- Do not push.
- Do not contact paid providers.

Return the proposed Phase 6 implementation plan for explicit human approval before making changes.

---

# 1. STAFF ATTENDANCE — REQUIRED WORKFLOW

Staff must be able to clock into church attendance by scanning the official attendance QR code.

After scanning, the authenticated staff member must be able to choose:

- First Service
- Second Service
- Both Services

The selected service or services must be recorded accurately.

---

# 2. STAFF IDENTITY AND QR SECURITY

Scanning the attendance QR must NOT itself authenticate a staff member.

The staff member must already be authenticated through the existing application authentication system.

The backend must derive the staff identity from the authenticated principal.

Never trust a:

- user ID;
- staff ID;
- role;
- name;
- attendance identity

merely because it came from:

- QR payload;
- request body;
- query parameter;
- frontend state.

Existing Phase 1 authoritative account and role validation must remain enforced.

The QR should initiate or identify the attendance operation, not grant identity or privilege.

---

# 3. STAFF SERVICE SELECTION

## First Service

Selecting First Service creates/activates attendance for First Service only.

## Second Service

Selecting Second Service creates/activates attendance for Second Service only.

## Both Services

Selecting Both Services must represent attendance for both services distinctly.

Do not collapse Both Services into one ambiguous attendance record if that prevents independent reporting of:

- First Service attendance;
- Second Service attendance;
- First Service clock-in;
- First Service clock-out;
- Second Service clock-in;
- Second Service clock-out.

The analysis must determine the safest representation within the existing database model.

---

# 4. STAFF CLOCK-IN TIME

Staff may clock in at **any time**.

There must be no arbitrary time restriction preventing an otherwise authorized staff member from clocking into a service.

If the staff member arrives late, allow the clock-in.

The system must preserve the **actual authoritative clock-in timestamp**.

Do not rewrite a late clock-in to the scheduled service start time.

Use server/database-authoritative time.

Administrative reports must show the actual arrival time.

---

# 5. STAFF CLOCK-OUT

Clock-out must be service-specific.

If a staff member has First Service attendance, they may clock out First Service.

That clock-out must close only First Service attendance.

It must NOT automatically close Second Service.

If a person attended Both Services, the system must preserve separate service state.

The interface should make the service being clocked out explicit.

Examples:

- Clock out First Service
- Clock out Second Service

A mismatched transition must fail safely.

Examples:

- attempting to clock out Second Service without Second Service attendance;
- closing First Service from a Second Service operation;
- overwriting a previous timestamp due to retry;
- duplicate concurrent clock-out.

Existing Phase 4 idempotency/concurrency protections must remain.

---

# 6. STAFF FIRST-TO-SECOND SERVICE TRANSITION

A staff member may:

1. Clock into First Service.
2. Clock out First Service.
3. Choose to clock into Second Service.

Second Service clock-in must be explicit.

Clocking out First Service must not automatically create Second Service attendance.

---

# 7. STAFF ATTENDANCE RECORD

For each service, administrators must be able to determine:

- Staff member.
- Service.
- Role where appropriate.
- Attendance/service date.
- Clock-in timestamp.
- Clock-out timestamp if applicable.
- Current attendance status.

A person attending both services must be represented accurately in both service reports.

---

# 8. EXISTING CHILD CLASS ASSIGNMENT

Every child already has an assigned class in the existing application.

Do NOT create a new class-assignment mechanism.

Do NOT ask support or parents to choose the child's class unless the current authoritative system already requires it.

Use the child's existing authoritative assigned class.

That class assignment must determine:

- class register;
- teacher/class notification;
- class attendance count;
- reporting.

If the repository contains inconsistent class assignment data, report the inconsistency rather than creating another source of truth.

---

# 9. PARENT-INITIATED CHILD CHECK-IN

A registered parent/guardian must be able to initiate child attendance before physical handover.

The parent must be able to choose:

- one child;
- several children;
- all linked children.

For each selected child, the parent must be able to choose:

- First Service;
- Second Service;
- Both Services.

Different children in the same family may attend different services.

Example:

- Child A — First Service
- Child B — Both Services
- Child C — Second Service

The backend must validate that each selected child is genuinely linked to the authenticated/verified parent.

A parent must never be able to manipulate a child ID and initiate attendance for a child from another family.

---

# 10. PARENT INITIATION IS NOT PHYSICAL HANDOVER

Parent initiation represents:

**“I intend to hand this child to Junior Church for the selected service(s).”**

It does NOT mean Junior Church has physically received the child.

Do not show the child as being under Junior Church care merely because a parent initiated check-in.

Do not send a physical handover confirmation yet.

Parent initiation may create a pending handover state.

All authorized support staff should be able to see children awaiting physical handover.

---

# 11. SUPPORT STAFF PHYSICAL HANDOVER

An authorized support staff member physically receives and accepts/scans the child.

That successful support action establishes actual Junior Church care.

Once Support Staff A accepts Child A:

- Child A becomes officially checked in.
- Child A is now under Junior Church care.
- Child A appears automatically in the child's already assigned class register.
- The class attendance count updates.
- Parent notification intent is created.
- Relevant teacher notification intent is created.
- Support Staff A becomes the recorded accepting/custodian support worker for that child attendance event.

Only after the authoritative backend transaction commits should the UI display:

**“{Child Name} is now under the care of Junior Church.”**

---

# 12. REMOVE NORMAL EN-ROUTE / IN-CLASS PROCESS

For the normal Junior Church check-in workflow, the previous multi-step process is no longer required.

The old process may currently include:

- support scan;
- en route;
- teacher confirmation;
- teacher clicks “in class”.

The desired normal workflow is now:

**Parent initiation where applicable → physical support acceptance → child immediately under Junior Church care → automatic class register → parent/teacher notifications.**

There should be:

- no required “en route” step;
- no required teacher “in class” confirmation.

Teacher confirmation must not be required to make attendance valid.

However, do not blindly delete legacy states/endpoints.

Analyze their dependencies first.

Classify each old component as:

- remove from normal flow;
- retain for another legitimate workflow;
- migrate;
- deprecate;
- compatibility-only;
- unsafe/stale.

---

# 13. CHILD CLASS REGISTER

Once support successfully accepts the child, the child must automatically appear in their existing assigned class register for the selected service.

Do not create a second independent attendance truth if the register can safely derive from authoritative attendance data.

Avoid duplicate sources of truth.

---

# 14. TEACHER VIEW

Authorized teachers must be able to see:

- children currently present in their permitted class;
- number of children currently present;
- service context;
- relevant attendance status.

The count must derive from authoritative attendance state.

Do not maintain a manually incremented counter if the current database state can be queried safely.

Concurrent child check-ins must not:

- double-count a child;
- duplicate the child in the register;
- lose a child;
- produce inconsistent class totals.

---

# 15. SUPPORT CHECK-IN OWNERSHIP

This is a critical operational rule.

For normal pickup:

**Only the support staff member who physically accepted/scanned a particular child into Junior Church may clock that child out.**

Example:

Support Staff A accepts Child A.

Support Staff B may see Child A where authorized but must not be able to complete Child A's normal checkout.

The backend must enforce this rule.

Frontend visibility alone is insufficient.

The accepting support staff identity must be stored in authoritative attendance/handover state.

---

# 16. SUPPORT ACCEPTANCE RACE CONDITION

All authorized support workers may see pending parent-initiated child handovers.

But only one can become the authoritative accepting custodian.

If Support A and Support B simultaneously attempt to accept the same child:

- at most one may win;
- the losing operation must return authoritative current state;
- accepting staff identity must not be overwritten;
- duplicate attendance must not be created;
- duplicate notifications must not be created;
- class register must not duplicate the child.

Use proper PostgreSQL transaction/concurrency controls.

---

# 17. CHILD CHECKOUT / PICKUP

A normal child checkout may be performed only by the recorded support worker who originally accepted that child.

Checkout must preserve:

- child identity;
- service;
- check-in time;
- accepting support worker;
- checkout time;
- checkout actor.

The original accepting staff identity must never be rewritten.

---

# 18. ADMIN CHECKOUT OVERRIDE

An authorized administrator may clock out any child if operationally necessary.

This is an explicit exception.

Example:

- Support Staff A accepted the child.
- Support Staff A is unavailable at pickup.
- Authorized Admin can perform checkout.

Administrative override must be distinctly audited.

Record, where applicable:

- child;
- service;
- original accepting support worker;
- administrator performing override;
- original check-in time;
- checkout timestamp;
- override reason/context.

The analysis must recommend whether an admin override reason should be mandatory.

Admin override must not rewrite history to make the administrator appear to be the original accepting support worker.

---

# 19. NO SILENT SUPPORT OWNERSHIP TRANSFER

Support Staff A must not silently transfer child checkout authority to Support Staff B.

If responsibility transfer is an operational requirement, report it as a separate workflow requiring explicit human approval.

Do not invent automatic transfer behavior.

---

# 20. MULTIPLE CHILDREN — OWNERSHIP IS PER CHILD

Child custody/check-out ownership must be tracked individually.

Example:

Same parent brings Child A and Child B.

Support A accepts Child A.

Support B accepts Child B.

Then:

- Support A may normally check out Child A.
- Support B may normally check out Child B.
- Authorized admin may override either.

Family association must not collapse individual child custody ownership.

---

# 21. CHILD BOTH-SERVICES ATTENDANCE

If a child is selected for Both Services, preserve:

- First Service attendance;
- Second Service attendance;
- existing assigned class;
- reporting for both services;
- accurate custody state;
- correct pickup/checkout;
- notification deduplication.

If the child physically remains continuously in Junior Church between services, avoid creating contradictory or duplicate custody records solely because two service attendance records exist.

Analyze and propose the safest model before implementation.

---

# 22. PARENT NOTIFICATIONS

After parent initiation, the parent may receive an acknowledgement such as:

**“Check-in request received for {Child Name}. Please hand the child to a Junior Church support staff member.”**

This must NOT say the child is already under Junior Church care.

After physical support acceptance, create a durable parent notification such as:

**“{Child Name} is now under the care of Junior Church.”**

Do not expose unnecessary internal staff information.

---

# 23. TEACHER NOTIFICATIONS

When physical support acceptance succeeds, relevant teacher/class personnel should receive a durable notification indicating the child has been checked into their assigned class/service.

Do not require teacher confirmation before attendance becomes valid.

---

# 24. CHECKOUT NOTIFICATIONS

After a valid checkout, the appropriate parent/guardian should receive an appropriate checkout/pickup notification.

Notification/audit history must distinguish:

- normal checkout;
- admin override checkout.

Do not expose unnecessary internal operational details in parent-facing messages.

---

# 25. PHASE 5 NOTIFICATION GUARANTEES MUST REMAIN

All Phase 6 notifications must preserve the Phase 5 notification architecture.

Preserve:

- PostgreSQL transactional outbox;
- logical deduplication;
- retry limits;
- claim token/lease safety;
- provider failure isolation;
- uncertainty handling;
- operational history;
- provider calls after commit.

Do not return to:

**domain commit → best-effort notification**

for required notifications.

A provider outage must not roll back a valid attendance mutation.

---

# 26. WHATSAPP — MAJOR PARENT CHANNEL

Parents should be able to perform essentially all normal parent-facing activities through WhatsApp **except initial sign-up/account registration**.

Sign-up remains outside WhatsApp.

After registration and verified account linkage, WhatsApp should act as a conversational parent interface.

---

# 27. WHATSAPP PARENT CAPABILITIES

Analyze the current parent-facing features and determine which can safely be exposed through WhatsApp.

Expected capabilities include, where supported by authoritative backend functionality:

- identify linked children;
- view linked children;
- select one/multiple/all linked children;
- initiate child attendance;
- select First Service;
- select Second Service;
- select Both Services;
- view attendance/check-in status;
- receive handover confirmation;
- receive relevant attendance notifications;
- receive checkout/pickup confirmation;
- view appropriate class/service information;
- access other normal parent features that do not require support/admin privilege.

Do not expose administrative or support functions through WhatsApp merely because an endpoint exists.

---

# 28. WHATSAPP IDENTITY THROUGH PHONE NUMBER

The WhatsApp bot must identify a parent using the sender's WhatsApp phone number.

However:

**The incoming phone number is an identifier. It must correspond to a verified phone number already linked to a registered parent/guardian account before access is granted.**

For each WhatsApp interaction:

1. Canonicalize sender phone number.
2. Resolve it to the authoritative registered parent/guardian account.
3. Confirm the account still exists.
4. Confirm account status is valid.
5. Confirm the verified phone number is still linked.
6. Retrieve children through authoritative parent-child relationships.
7. Execute actions as that resolved parent.
8. Recheck object-level authorization on each state-changing operation.

---

# 29. UNVERIFIED/UNKNOWN WHATSAPP NUMBER

If the WhatsApp sender number is not linked to an active registered parent:

Do not expose:

- child names;
- family information;
- attendance records;
- class details;
- account existence information.

Return a safe message instructing the user to register/link their account through the approved application.

Do not perform sign-up through WhatsApp.

---

# 30. WHATSAPP MUST NOT TRUST CHAT-SUPPLIED IDENTIFIERS

Never treat these as authorization:

- child ID typed by user;
- parent ID typed by user;
- phone number typed in message;
- role claimed in chat;
- frontend value;
- QR code content.

Child selection should map to children already retrieved from the authoritative guardian relationship.

A parent must never gain access to another family's child by guessing or manipulating an identifier.

---

# 31. WHATSAPP CONVERSATIONAL STATE

The bot may keep temporary conversational selections such as:

- selected child;
- selected children;
- selected service;
- current workflow step.

But conversation state is NOT authorization state.

Before each backend mutation:

- re-resolve parent identity;
- revalidate account status;
- revalidate parent-child relationship;
- revalidate service/action;
- revalidate current attendance state.

A stale WhatsApp conversation must not permit an action that is no longer authorized.

---

# 32. PHONE NUMBER CHANGES

Inspect existing parent phone-number update behavior.

When a verified parent's phone number changes:

- old number must stop authorizing WhatsApp access;
- new number must not authorize access until properly verified/linked according to existing account policy.

Do not create a separate WhatsApp identity source that can drift from the authoritative account record.

---

# 33. WHATSAPP STEP-UP SECURITY REVIEW

Analyze whether sender-number verification is sufficient for every parent action.

Identify particularly sensitive actions that might justify step-up verification.

Do NOT add unnecessary OTP friction without evidence.

Do NOT weaken existing authentication controls.

Report recommendations for human review.

---

# 34. CHILD QR SECURITY

Review how child/parent QR codes currently work.

Determine:

- contents of the QR;
- predictability;
- whether identifiers are raw;
- whether the QR expires;
- whether it is signed/integrity-protected;
- replay behavior;
- whether sensitive data is embedded;
- whether screenshots/copies create unacceptable risk;
- whether backend authorization is independently revalidated.

Do not place:

- JWTs;
- passwords;
- OTPs;
- secrets;
- unnecessary personal information

inside QR codes.

QR possession must not confer support/admin privilege.

---

# 35. STAFF QR SECURITY

Perform the same security review for staff attendance QR.

Attendance QR possession must not identify or authenticate a staff member by itself.

Backend authentication and current role authorization remain mandatory.

---

# 36. CHILD DUPLICATE CHECK-IN

For the same child/service/event:

Repeated:

- scans;
- WhatsApp submissions;
- app submissions;
- browser retries;
- double clicks;
- provider retries;
- concurrent support acceptance attempts

must not create duplicate authoritative attendance.

Preserve original provenance.

---

# 37. CHILD CLASS REGISTER CONSISTENCY

Do not create independent class presence records that can disagree with attendance unless strictly necessary.

Analyze whether class register should derive from:

- existing child class assignment;
- authoritative attendance/handover;
- selected service.

Prefer derived authoritative state over duplicated manually synchronized counters.

---

# 38. ADMIN REPORTING

Authorized administrators must be able to generate reports for:

- First Service;
- Second Service;
- all services;
- appropriate date/date range;
- appropriate class.

---

# 39. STAFF ATTENDANCE REPORTS

Reports must be able to show at minimum:

- staff name;
- role where applicable;
- service;
- service date;
- actual clock-in time;
- clock-out time;
- attendance status.

Both-service attendance must still preserve separate First and Second Service details.

---

# 40. CHILD ATTENDANCE REPORTS

Reports must be able to show at minimum:

- child's name;
- assigned class;
- service;
- check-in/handover status;
- actual check-in time;
- checkout time;
- accepting support staff where authorized;
- checkout actor where authorized;
- whether admin override was used.

Allow grouping by class and service.

Provide class/service totals where appropriate.

---

# 41. OTHER DOWNLOADABLE REPORTS

Administrators must be able to download relevant operational reports, including at minimum:

- staff attendance;
- child attendance;
- attendance by service;
- attendance by class;
- emergency reports;
- feedback reports.

Inspect existing application data/reporting capabilities and identify other useful existing report categories.

Do not invent information that the database does not contain.

---

# 42. REPORT EXPORT FORMAT

Inspect current export capabilities before selecting final formats.

Propose appropriate export support such as CSV and/or Excel if compatible with the existing architecture.

Do not add a new dependency without justification.

Exports must come from authoritative backend data, not frontend-rendered data.

---

# 43. REPORT AUTHORIZATION

All report/export endpoints must be backend-authorized.

Do not rely on frontend button visibility.

Ensure:

- teachers cannot access global admin reports merely because they can see their class;
- support cannot access global admin reports merely because they can check in children;
- parents cannot access other family data;
- query parameter manipulation cannot bypass service/class/report authorization.

---

# 44. CHILD DATA PRIVACY

Reports and WhatsApp can contain child information.

Review exposure of:

- names;
- classes;
- attendance;
- family association;
- staff association;
- emergencies;
- feedback;
- notifications;
- logs.

Return only data necessary for the authorized purpose.

Do not unnecessarily expose children's information in:

- error messages;
- logs;
- URLs;
- QR payloads;
- WhatsApp messages;
- export files.

---

# 45. ADMIN REPORT AUDIT

Analyze whether report generation/download should be audited.

Provide a recommendation, especially for:

- child attendance exports;
- emergency exports;
- large data exports;
- sensitive operational exports.

---

# 46. REPORT FILTERING

Analyze safe server-side filters for:

- service;
- service date;
- date range;
- class;
- attendance type;
- emergency status/type;
- feedback category/status.

Validate all filters on the backend.

Protect against:

- unbounded data requests;
- invalid date ranges;
- unauthorized classes/services;
- accidental mass exposure.

---

# 47. API COLLISION / “JAMMING” REVIEW

A major Phase 6 objective is to ensure APIs and workflows are not conflicting, racing, duplicating state or “jamming”.

Perform a focused map of every API related to:

- staff attendance;
- staff clock-in;
- staff clock-out;
- service selection;
- child parent-initiation;
- child check-in;
- child handover;
- escort;
- arrival;
- en route;
- in-class;
- checkout;
- pickup;
- class register;
- teacher attendance view;
- notifications;
- WhatsApp;
- emergencies;
- feedback;
- reporting;
- exports;
- offline synchronization;
- SSE.

Identify:

- overlapping endpoints;
- duplicate mutation logic;
- inconsistent service handling;
- contradictory state transitions;
- stale legacy paths;
- duplicate notification triggers;
- transaction conflicts;
- race conditions;
- frontend/backend contract mismatches;
- old endpoints that may mutate the same record differently;
- state names that no longer match business semantics.

Do not solve this by simply adding new routes on top of conflicting routes.

Recommend the smallest safe migration path.

---

# 48. API IDEMPOTENCY

For state-changing attendance operations, analyze whether request-level or domain-level idempotency is adequate.

Particularly verify:

- parent attendance initiation;
- WhatsApp retries;
- support acceptance;
- staff QR scans;
- staff clock-out;
- child checkout;
- admin override;
- notification enqueue.

Retries must not create duplicate state.

---

# 49. DATABASE CONCURRENCY

Preserve the Phase 3/4 concurrency model.

Analyze which operations require:

- conditional updates;
- row locks;
- unique constraints;
- transaction isolation;
- existing event identity;
- logical deduplication.

Particularly test:

- two support workers accepting one child;
- support checkout versus admin override;
- duplicate staff scan;
- duplicate staff clock-out;
- simultaneous WhatsApp/app parent initiation;
- both-service attendance operations.

---

# 50. DATABASE MODEL REVIEW

Determine whether the current schema can safely represent:

## Staff

- First Service attendance.
- Second Service attendance.
- Both Services.
- Independent clock-in/clock-out.
- Actual timestamps.

## Child

- parent attendance intent;
- selected service(s);
- physical support acceptance;
- accepting support worker;
- existing assigned class;
- check-in time;
- checkout;
- checkout actor;
- admin override;
- service-specific reporting.

Prefer current authoritative structures where possible.

Do not add schema merely for convenience.

---

# 51. DATABASE CHANGE REQUIREMENTS

If a schema change is genuinely required, report:

- exact new/changed fields;
- tables;
- indexes;
- uniqueness constraints;
- foreign keys;
- migration/backfill requirements;
- impact on existing data;
- compatibility risk;
- rollback considerations.

Do not apply schema changes during this analysis.

---

# 52. OFFLINE ATTENDANCE IMPACT

Phase 4 includes offline attendance safety.

Analyze whether the new:

- staff QR attendance;
- parent initiation;
- support acceptance;
- child checkout

should or should not work offline.

Do not assume all actions should be offline-capable.

A custody-sensitive operation may require online authoritative confirmation.

Report the safest model.

---

# 53. AUTHENTICATION REVIEW

Recheck Phase 1 guarantees for all Phase 6 APIs.

Ensure:

- current user exists;
- account is active;
- role still belongs to user;
- suspended/rejected/deleted accounts fail;
- request principal comes from authoritative backend state.

---

# 54. AUTHORIZATION REVIEW

Explicitly map authorization for:

## Parent

Can act only on linked children and approved parent functions.

## Support

Can view pending handovers and accept children according to approved scope.

## Accepting support

Can normally check out children they personally accepted.

## Teacher

Can view authorized class register/attendance.

## Staff

Can manage their own approved staff attendance according to role.

## Admin

Can access approved reports and perform child checkout override.

Do not rely on UI visibility as authorization.

---

# 55. OBJECT-LEVEL AUTHORIZATION

Test direct-object attacks.

Examples:

- parent changes child ID;
- teacher changes class ID;
- support changes child ID;
- staff changes attendance ID;
- admin-only report path called by non-admin;
- WhatsApp user supplies another child's identifier.

Backend must enforce ownership/scope on every request.

---

# 56. INPUT VALIDATION

Validate:

- service values;
- Both Services representation;
- service dates;
- attendance IDs;
- child IDs;
- class IDs;
- QR values;
- report filters;
- export parameters;
- WhatsApp selections.

Do not trust raw client values.

---

# 57. ERROR HANDLING

Do not expose:

- stack traces;
- database internals;
- SQL;
- credentials;
- provider secrets;
- JWTs;
- child information to unauthorized users;
- whether another family's child exists.

Use safe bounded responses.

---

# 58. LOGGING / OBSERVABILITY

Review whether required operational events are visible without leaking sensitive data.

Important events include:

- support acceptance;
- failed acceptance race;
- child checkout;
- admin checkout override;
- staff clock-in/out;
- report generation;
- WhatsApp authorization failure;
- notification dead letter/uncertain state.

Redact sensitive information appropriately.

---

# 59. EMERGENCY REPORTS

Inspect existing emergency model and access rules.

Administrator report/download functionality may expose existing emergency records.

Do not redesign the emergency workflow unless required by Phase 6 reporting.

Preserve existing authorization and audit controls.

---

# 60. FEEDBACK REPORTS

Inspect existing feedback model and access rules.

Allow appropriate admin reporting/export using authoritative backend data.

Do not weaken privacy or expose submitter data unnecessarily.

---

# 61. SECURITY REGRESSION REQUIREMENT

No Phase 6 implementation is acceptable if it weakens:

- Phase 1 authentication;
- Phase 2 OTP security;
- Phase 3 role concurrency;
- Phase 4 attendance integrity;
- Phase 5 notification durability;
- Phase 5 SSE credential hardening.

SSE must not reintroduce bearer JWTs into EventSource URLs.

---

# 62. REQUIRED STAFF TESTS

Propose tests for at least:

- First Service clock-in.
- Second Service clock-in.
- Both Services selection.
- Late First Service clock-in.
- Late Second Service clock-in.
- Exact authoritative clock-in time.
- First Service clock-out.
- Second Service clock-out.
- Both-service independent clock-outs.
- First Service clock-out then Second Service clock-in.
- Invalid Second Service clock-out.
- Duplicate QR scan.
- Concurrent QR scan.
- Concurrent clock-out.
- Unauthorized role.
- Suspended account.
- Removed role.
- forged staff/user identifier.
- invalid QR.
- service parameter tampering.

---

# 63. REQUIRED CHILD TESTS

Propose tests for:

- Parent selects one child.
- Parent selects multiple children.
- Parent selects all linked children.
- Different services per child.
- Both Services.
- Parent cannot select unrelated child.
- Parent initiation creates pending state only.
- All authorized support can see pending child.
- Support accepts child.
- Successful care confirmation.
- Existing class assignment used.
- Child automatically appears in register.
- Class count changes correctly.
- Parent notification intent.
- Teacher notification intent.
- No en-route requirement.
- No teacher in-class requirement.
- Duplicate scan.
- Concurrent support acceptance.
- Exactly one support custodian wins.
- Losing support cannot overwrite custodian.
- Non-owning support cannot checkout.
- Accepting support can checkout.
- Admin can override checkout.
- Admin override audit preserved.
- Concurrent checkout.
- Parent notified on checkout.
- legitimate separate service attendance.
- provider failure does not rollback attendance.

---

# 64. REQUIRED WHATSAPP TESTS

Propose tests for:

- Registered verified parent recognized by number.
- Unknown number gets no child data.
- Unverified number gets no child data.
- Suspended parent gets no access.
- Changed old phone number loses access.
- Parent sees only linked children.
- Parent cannot inject arbitrary child ID.
- Multi-child selection.
- Per-child service selection.
- Both Services.
- Duplicate WhatsApp delivery.
- stale conversation state.
- simultaneous app and WhatsApp requests.
- notification responses.
- malicious text containing another phone number.
- admin/support commands rejected for parent.
- sensitive actions revalidate backend authorization.

---

# 65. REQUIRED REPORT TESTS

Propose tests for:

- First Service staff report.
- Second Service staff report.
- All Services staff report.
- Both-service staff representation.
- Child attendance by service.
- Child attendance by class.
- class totals.
- accepting support field.
- checkout actor.
- admin override field.
- emergency report.
- feedback report.
- unauthorized export.
- teacher attempting global export.
- support attempting admin export.
- invalid class/service filter.
- excessive date-range behavior.
- exported values equal authoritative database values.

---

# 66. REQUIRED CONCURRENCY TESTS

At minimum:

- two support workers accept one child;
- support checkout vs admin override;
- duplicate parent initiation;
- WhatsApp retry vs app retry;
- duplicate staff QR scan;
- duplicate staff clock-out;
- First and Second Service simultaneous attendance changes;
- notification deduplication under retries.

---

# 67. REQUIRED REGRESSION TESTS

Run all relevant Phase 1–5 security and database tests after implementation.

The implementation proposal must identify exact current regression suites to retain.

---

# 68. REQUIRED PHASE 6 READ-ONLY REPORT

Return a structured report with these sections:

1. PHASE 6 SCOPE CONFIRMED
2. CURRENT STAFF ATTENDANCE FLOW
3. CURRENT STAFF QR MODEL
4. CURRENT CHILD PARENT-INITIATION FLOW
5. CURRENT CHILD PHYSICAL HANDOVER FLOW
6. CURRENT CHILD CHECKOUT FLOW
7. CURRENT CLASS ASSIGNMENT MODEL
8. CURRENT CLASS REGISTER FLOW
9. CURRENT TEACHER VIEW
10. CURRENT WHATSAPP PARENT FLOW
11. CURRENT WHATSAPP IDENTITY MODEL
12. CURRENT QR SECURITY MODEL
13. CURRENT REPORTING/EXPORT MODEL
14. CURRENT DATABASE MODEL
15. CURRENT API MAP
16. LEGACY EN-ROUTE / IN-CLASS DEPENDENCIES
17. STAFF ATTENDANCE GAP ANALYSIS
18. CHILD CHECK-IN/HANDOVER GAP ANALYSIS
19. CHILD CHECKOUT OWNERSHIP GAP ANALYSIS
20. BOTH-SERVICE GAP ANALYSIS
21. CLASS REGISTER GAP ANALYSIS
22. WHATSAPP GAP ANALYSIS
23. NOTIFICATION IMPACT
24. REPORTING GAP ANALYSIS
25. AUTHENTICATION & AUTHORIZATION REVIEW
26. CHILD DATA PRIVACY REVIEW
27. CONCURRENCY & IDEMPOTENCY REVIEW
28. OFFLINE/SYNC IMPACT
29. API COLLISION / STATE-MACHINE FINDINGS
30. DATABASE CHANGE REQUIRED — YES/NO
31. API CONTRACT CHANGE REQUIRED — YES/NO
32. FRONTEND CHANGE REQUIRED — YES/NO
33. WHATSAPP/BOT CHANGE REQUIRED — YES/NO
34. DEPENDENCY CHANGE REQUIRED — YES/NO
35. SECURITY FINDINGS
36. EXACT SOURCE FILES EXPECTED TO CHANGE
37. EXACT TEST FILES EXPECTED TO CHANGE/CREATE
38. PROPOSED PHASE 6 IMPLEMENTATION ORDER
39. PHASE 6 ACCEPTANCE CRITERIA
40. RISKS / HUMAN DECISIONS REQUIRED
41. FILES MODIFIED DURING ANALYSIS — MUST BE NONE

---

# 69. EACH PROPOSED CHANGE MUST EXPLAIN

For every Phase 6 change, state:

- current behavior;
- identified problem;
- proposed behavior;
- security impact;
- authorization impact;
- database impact;
- concurrency impact;
- notification impact;
- API compatibility impact;
- frontend impact;
- tests required.

---

# 70. HUMAN DECISIONS — DO NOT GUESS

If any important requirement remains ambiguous after repository inspection, report it.

Do not silently decide issues such as:

- custody transfer between support staff;
- destructive removal of legacy attendance states;
- whether WhatsApp sensitive actions require additional verification;
- whether a child attending Both Services maintains one continuous custody record or another model;
- whether admin override reason must be mandatory;
- whether report downloads require audit events;
- any schema design requiring significant migration.

Present options and stop for human decision where appropriate.

---

# 71. STOP CONDITIONS

During Phase 6 analysis, stop rather than implement if the requested design would:

- weaken a Phase 1–5 control;
- create conflicting attendance truth;
- create conflicting class register truth;
- introduce an authorization bypass;
- expose child information improperly;
- permit unauthorized checkout;
- allow QR possession to become authentication;
- break notification durability;
- break attendance idempotency;
- create unsafe WhatsApp authorization;
- require destructive migration;
- require major architectural redesign.

Report the issue explicitly.

---

# 72. PRODUCTION BOUNDARY

Nothing in this prompt authorizes production deployment.

Do NOT:

- deploy;
- publish;
- modify production PostgreSQL;
- apply production migrations;
- change production secrets;
- change production providers;
- make paid SMS/email/WhatsApp calls;
- commit;
- push;
- merge;
- modify production infrastructure.

---

# 73. HUMAN INTENT SUMMARY

The intended final workflow is:

## Staff

Authenticated staff scans official attendance QR → chooses First Service, Second Service or Both → actual clock-in time is recorded → attendance remains service-specific → staff may clock out the applicable service independently.

## Parent

Registered parent uses application or verified WhatsApp number → selects one, several or all linked children → selects First, Second or Both Services for each child → submits attendance intention.

## Support

All authorized support staff can see children awaiting handover → one support worker physically accepts/scans child → that support worker becomes the recorded custodian → child immediately becomes under Junior Church care → child appears automatically in existing assigned class → class count updates → parent and teacher receive durable notification intents.

## Teacher

Teacher does not need to click “in class” → teacher sees the child automatically in the existing assigned class register → teacher sees current class attendance count.

## Pickup

Normally only the support worker who accepted the child can clock that child out.

Authorized admin may perform an audited override if the accepting support worker is unavailable.

## WhatsApp

Registered parents should be able to perform normal parent-facing functions via WhatsApp except sign-up → WhatsApp sender number maps to verified registered parent → children are retrieved through authoritative parent-child relationship → every state-changing action revalidates authorization.

## Admin

Authorized administrators can view and download service-specific/all-service staff attendance, child attendance, class attendance, emergency, feedback and other approved operational reports.

---

# FINAL INSTRUCTION

Phases 1–5 are **HUMAN-ACCEPTED AS DEVELOPMENT-COMPLETE**.

Phase 6 is authorized for:

**READ-ONLY ANALYSIS AND IMPLEMENTATION PLANNING ONLY.**

No Phase 6 implementation is authorized yet.

Inspect the actual repository.

Use repository evidence rather than assumptions.

Preserve all applicable Phase 1–5 security guarantees.

Do not make code, database, test, provider, dependency, workflow, secret, commit, push, deployment or production changes.

At the end of the response, write exactly:

**PHASE 6 ATTENDANCE, JUNIOR CHURCH CARE, WHATSAPP, REPORTING & SECURITY ANALYSIS COMPLETE — NO CHANGES MADE — AWAITING HUMAN APPROVAL**