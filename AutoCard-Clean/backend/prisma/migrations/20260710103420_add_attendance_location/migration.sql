-- AlterTable
ALTER TABLE "attendance" ADD COLUMN "location" TEXT;
ALTER TABLE "attendance" ADD COLUMN "locationType" TEXT DEFAULT 'OFFICE';

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN "employmentType" TEXT;
ALTER TABLE "employee_profiles" ADD COLUMN "profileImage" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "holidayType" TEXT NOT NULL DEFAULT 'FESTIVAL',
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_holidays" ("createdAt", "date", "description", "id", "isRecurring", "name", "updatedAt") SELECT "createdAt", "date", "description", "id", "isRecurring", "name", "updatedAt" FROM "holidays";
DROP TABLE "holidays";
ALTER TABLE "new_holidays" RENAME TO "holidays";
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");
CREATE INDEX "holidays_date_idx" ON "holidays"("date");
CREATE INDEX "holidays_holidayType_idx" ON "holidays"("holidayType");
CREATE TABLE "new_leave_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "daysPerYear" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_leave_types" ("code", "createdAt", "daysPerYear", "description", "id", "isActive", "isPaid", "name", "updatedAt") SELECT "code", "createdAt", "daysPerYear", "description", "id", "isActive", "isPaid", "name", "updatedAt" FROM "leave_types";
DROP TABLE "leave_types";
ALTER TABLE "new_leave_types" RENAME TO "leave_types";
CREATE UNIQUE INDEX "leave_types_name_key" ON "leave_types"("name");
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
