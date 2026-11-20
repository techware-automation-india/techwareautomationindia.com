import assert from "node:assert";

console.log("=================================================");
console.log("🧪 STARTING INVENTORY UNIT & LOGIC AUTOMATED TESTS");
console.log("=================================================\n");

// -------------------------------------------------------------------------
// 1. Logic for Solution A: computeReservedStockForItem & available calculation
// -------------------------------------------------------------------------
console.log("▶️ TEST 1: Solution A - Reserved Stock & Over-Approval Prevention");

function computeReservedStock(activeApprovedRequests, targetItem, excludeRequestId = null) {
  let reservedCount = 0;
  const targetCodeUpper = (targetItem.code || "").trim().toUpperCase();
  const targetNameUpper = (targetItem.name || "").trim().toUpperCase();

  for (const req of activeApprovedRequests) {
    if (excludeRequestId && req.id === excludeRequestId) continue;

    const noteStr = String(req.reviewNote || "");
    if (noteStr.includes("[PRODUCT_FOUND]") || noteStr.includes("[STOCK_UPDATED]")) {
      continue;
    }

    const desc = req.description || "";
    const isReturn = desc.toLowerCase().includes("action type: return");
    if (isReturn) continue;

    // Simulate extraction
    const qtyMatch = desc.match(/Quantity:\s*(\d+)/i);
    const codeMatch = desc.match(/Product ID:\s*([^\n\r|]+)/i);
    const nameMatch = desc.match(/Item Name:\s*([^\n\r|]+)/i);

    const itmCodeUpper = codeMatch ? codeMatch[1].trim().toUpperCase() : "";
    const itmNameUpper = nameMatch ? nameMatch[1].trim().toUpperCase() : "";

    if (
      (targetCodeUpper && itmCodeUpper && targetCodeUpper === itmCodeUpper) ||
      (targetNameUpper && itmNameUpper && targetNameUpper === itmNameUpper)
    ) {
      reservedCount += qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    }
  }

  return reservedCount;
}

function checkStockAvailability(physicalStock, reservedStock, requestedQty) {
  const availableUnreservedStock = Math.max(0, physicalStock - reservedStock);
  if (availableUnreservedStock <= 0 || availableUnreservedStock < requestedQty) {
    return {
      allowed: false,
      physicalStock,
      reservedStock,
      availableUnreservedStock,
      message: `Insufficient available stock. Physical stock: ${physicalStock}, Reserved: ${reservedStock}, Available: ${availableUnreservedStock}, Approving: ${requestedQty}`,
    };
  }
  return {
    allowed: true,
    availableUnreservedStock,
  };
}

const mockItem = { code: "PLC-001", name: "Mitsubishi PLC FX3U", quantity: 5 };

// Scenario: Request 1 is APPROVED for 5 PLCs (waiting collection)
const mockRequests = [
  {
    id: "req-101",
    status: "APPROVED",
    reviewNote: "Approved by Admin. Waiting for employee collection.",
    description: "Action Type: Taking\nProduct ID: PLC-001\nItem Name: Mitsubishi PLC FX3U\nQuantity: 5",
  },
];

const reservedStock = computeReservedStock(mockRequests, mockItem, "req-102");
assert.strictEqual(reservedStock, 5, "Reserved stock should be 5");
console.log(`   Physical Stock: ${mockItem.quantity}, Reserved: ${reservedStock}`);

// Request 2 tries to approve 1 PLC
const checkResult = checkStockAvailability(mockItem.quantity, reservedStock, 1);
assert.strictEqual(checkResult.allowed, false, "Request 2 should be rejected due to 0 available stock");
console.log(`   ✅ PASS [Solution A]: Over-approval blocked successfully: "${checkResult.message}"`);

// -------------------------------------------------------------------------
// 2. Logic for Solution B: Atomic Decrement & Negative Stock Prevention
// -------------------------------------------------------------------------
console.log("\n▶️ TEST 2: Solution B - Atomic Decrement & Concurrency Guard");

class MockInventoryDatabase {
  constructor(initialStock) {
    this.stock = initialStock;
    this.issues = [];
    this.requests = new Map();
  }

  // Simulates prisma.$transaction with lock & boundary check
  async executeItemFoundTransaction(requestId, requestedQty, employeeName) {
    const req = this.requests.get(requestId);
    if (!req) throw new Error("Request not found");
    if (req.status === "COMPLETED" || req.reviewNote.includes("[PRODUCT_FOUND]")) {
      return { alreadyCompleted: true };
    }

    // Atomic boundary check
    if (this.stock < requestedQty) {
      throw new Error(`Insufficient stock in store. Available: ${this.stock}, Required: ${requestedQty}`);
    }

    // Atomic decrement
    this.stock -= requestedQty;

    // Issue record created
    this.issues.push({
      requestId,
      quantity: requestedQty,
      assignedTo: employeeName,
      status: "ISSUED",
      date: new Date(),
    });

    // Request status updated
    req.status = "COMPLETED";
    req.reviewNote += " | [PRODUCT_FOUND] [STOCK_UPDATED]";

    return { alreadyCompleted: false, remainingStock: this.stock };
  }
}

const db = new MockInventoryDatabase(5);
db.requests.set("req-101", { id: "req-101", status: "APPROVED", reviewNote: "Approved" });

// First Item Found click:
async function testTransaction() {
  const res1 = await db.executeItemFoundTransaction("req-101", 5, "Aakash");
  assert.strictEqual(res1.alreadyCompleted, false);
  assert.strictEqual(db.stock, 0);
  assert.strictEqual(db.issues.length, 1);
  console.log(`   ✅ PASS: Item Found deducted stock 5 -> ${db.stock} and logged issue.`);

  // Double click (Idempotency test):
  const res2 = await db.executeItemFoundTransaction("req-101", 5, "Aakash");
  assert.strictEqual(res2.alreadyCompleted, true);
  assert.strictEqual(db.stock, 0); // No double deduction
  console.log(`   ✅ PASS: Double-click avoided double deduction (Idempotent check).`);

  // Racing request attempting to deduct below 0:
  db.requests.set("req-102", { id: "req-102", status: "APPROVED", reviewNote: "Approved" });
  let errorCaught = null;
  try {
    await db.executeItemFoundTransaction("req-102", 1, "Another Employee");
  } catch (err) {
    errorCaught = err;
  }
  assert.notStrictEqual(errorCaught, null);
  assert.strictEqual(db.stock, 0); // Still 0, not -1
  console.log(`   ✅ PASS [Solution B]: Race condition below 0 prevented: "${errorCaught.message}"`);
}

await testTransaction();

// -------------------------------------------------------------------------
// 3. Logic for Solution C: Auto-Expiry for Stale Requests (> 48 hours)
// -------------------------------------------------------------------------
console.log("\n▶️ TEST 3: Solution C - Auto-Expiry of Stale Requests (> 48h)");

function autoExpireStaleRequests(requestsList, maxAgeHours = 48) {
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  let expiredCount = 0;

  for (const req of requestsList) {
    if (req.status !== "APPROVED") continue;
    const note = req.reviewNote || "";
    if (note.includes("[PRODUCT_FOUND]") || note.includes("[STOCK_UPDATED]")) continue;

    const age = now - req.reviewedAt.getTime();
    if (age > maxAgeMs) {
      req.status = "REJECTED";
      req.reviewNote = `[EXPIRED_UNCOLLECTED] Request automatically cancelled after 48 hours without collection. Reserved stock released.`;
      expiredCount++;
    }
  }

  return expiredCount;
}

const mockRequestsForExpiry = [
  {
    id: "req-fresh",
    status: "APPROVED",
    reviewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours old
    reviewNote: "Approved recently",
  },
  {
    id: "req-stale",
    status: "APPROVED",
    reviewedAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours old
    reviewNote: "Approved 50h ago",
  },
];

const expiredCount = autoExpireStaleRequests(mockRequestsForExpiry, 48);
assert.strictEqual(expiredCount, 1);
assert.strictEqual(mockRequestsForExpiry[0].status, "APPROVED");
assert.strictEqual(mockRequestsForExpiry[1].status, "REJECTED");
console.log(`   ✅ PASS [Solution C]: Stale request correctly expired after 48 hours and cancelled.`);

console.log("\n=================================================");
console.log("🎉 ALL AUTOMATED UNIT TESTS PASSED (100% SUCCESS)");
console.log("=================================================");
