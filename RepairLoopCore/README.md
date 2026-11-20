# RepairLoopCore (Java 21 Core Business Logic Module)

`RepairLoopCore` is a pure Java 21 object-oriented module (zero external frameworks, no Spring Boot) implementing the core domain rules of RepairLoop.

## Package Structure

- `com.repairloop.core.enums`: `RepairStatus`, `DecisionRecommendation`, `OfferStatus`, `ListingStatus`
- `com.repairloop.core.exceptions`: `InvalidStateTransitionException`, `DuplicateSelectionException`
- `com.repairloop.core.interfaces`: `Identifiable`, `Scorable`, `OfferEvaluator<T>`
- `com.repairloop.core.model`: `BaseEntity`, `ProductInfo`, `RepairRequest`, `Quotation`, `DecisionResult`, `ResaleListing`, `VendorOffer`
- `com.repairloop.core.engine`: `RepairDecisionEngine`
- `com.repairloop.core.manager`: `QuotationManager`, `RepairTracker`, `VendorOfferManager`
- `com.repairloop.core.server`: `RepairLoopHttpServer` (built-in `com.sun.net.httpserver.HttpServer`)
- `com.repairloop.core.Main`: End-to-end console demonstration

## Compile & Run (Java 21+)

From the `RepairLoopCore` directory:

```bash
mkdir -p out
javac -d out $(find src -name "*.java")
```

### Run the Console Demonstration (`Main.java`)

```bash
java -cp out com.repairloop.core.Main
```

### Run the Optional Lightweight Java HTTP Server (Port 8080)

```bash
java -cp out com.repairloop.core.server.RepairLoopHttpServer 8080
```

Once running locally, the RepairLoop web app's Decision Engine page can connect to `http://localhost:8080/api/decision/evaluate` (or fall back seamlessly to its TypeScript engine mirror when running standalone).
