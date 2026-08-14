-- AlterTable
ALTER TABLE "attendance" ADD COLUMN "checkInLatitude" REAL;
ALTER TABLE "attendance" ADD COLUMN "checkInLongitude" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "radius" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_locations" ("addressLine", "city", "country", "createdAt", "id", "isActive", "name", "state", "updatedAt") SELECT "addressLine", "city", "country", "createdAt", "id", "isActive", "name", "state", "updatedAt" FROM "locations";
DROP TABLE "locations";
ALTER TABLE "new_locations" RENAME TO "locations";
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
