# AttendIQ Firestore Security Specification

## 1. Data Invariants
1. Every document in `users/{uid}` is strictly readable and writable only when `request.auth != null && request.auth.uid == uid`.
2. Every document in `subjects`, `attendance`, `timetable`, `exams`, `studyTasks`, `marks`, `notifications`, `achievements`, and `monthlyReports` MUST store `userId` equal to `request.auth.uid` on creation and preserve `userId` immutably on updates.
3. No unauthenticated client (`request.auth == null`) may read, list, create, update, or delete any document in any collection.
4. All `list` queries MUST enforce `resource.data.userId == request.auth.uid` in rules so cross-user scraping is mathematically impossible even if client filters are bypassed.
5. All document IDs (`uid`, `subjectId`, `logId`, etc.) must satisfy `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
6. Every string field enforces strict `.size()` bounds and every numeric counter enforces logical domain bounds (e.g., `attendedClasses <= totalClasses`, `targetAttendance` between 50 and 95).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get(/subjects/sub_1)` with `auth: null` -> DENIED.
2. **Cross-User Profile Read (PII Leak)**: `get(/users/user_b)` signed in as `user_a` -> DENIED.
3. **Cross-User List Scrape**: `list(/subjects)` without `where('userId', '==', auth.uid)` -> DENIED.
4. **UID Spoofing on Create**: `create(/subjects/sub_1, { userId: 'user_b', ... })` signed in as `user_a` -> DENIED.
5. **Owner Mutation on Update**: `update(/subjects/sub_1, { userId: 'user_b' })` -> DENIED (`userId` immutable).
6. **Shadow / Ghost Field Injection**: `create(/subjects/sub_1, { ..., isAdmin: true })` -> DENIED (`keys().hasOnly(...)`).
7. **ID Poisoning**: `create(/subjects/bad..id$1234, { ... })` -> DENIED (`isValidId` regex).
8. **String Size Exhaustion (Denial of Wallet)**: `create(/studyTasks/t1, { title: '<5000 chars>', ... })` -> DENIED.
9. **Attended Exceeds Total Integrity Violation**: `create(/subjects/s1, { attendedClasses: 20, totalClasses: 10, ... })` -> DENIED.
10. **Invalid Enum Status**: `create(/attendance/l1, { status: 'hacked', ... })` -> DENIED.
11. **Value Poisoning Type Mismatch on Update**: `update(/studyTasks/t1, { completed: 'yes' })` -> DENIED (`isValidStudyTask`).
12. **Cross-User Delete**: `delete(/marks/m1)` where `resource.data.userId == 'user_b'` signed in as `user_a` -> DENIED.
