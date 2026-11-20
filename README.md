# RepairLoop — Repair. Reuse. Renew.

RepairLoop is a full-stack electronics and household appliance repair, quotation management, warranty register, resale marketplace, and repair-vs-replace decision platform.

## Architecture Overview

1. **Frontend Application (`src/`)**:
   - Built with **React 19, TypeScript, and Tailwind CSS**.
   - **Firebase Authentication & Cloud Firestore (`firebase-blueprint.json`, `firestore.rules`)** for real persistent storage, role-based access control (`customer`, `mechanic`, `vendor`), confidential quotation/offer isolation, and atomic single-winner acceptance.
2. **Core Business Logic Module (`RepairLoopCore/`)**:
   - Pure **Java 21** object-oriented module (zero Spring Boot or external dependencies).
   - Implements `RepairDecisionEngine`, `QuotationManager`, `RepairTracker`, `VendorOfferManager`, interfaces (`Identifiable`, `Scorable`, `OfferEvaluator`), custom exceptions (`InvalidStateTransitionException`, `DuplicateSelectionException`), enums, `ArrayList`/`HashMap` collections, runnable `Main.java` demonstration, and an optional built-in JDK `HttpServer` (`RepairLoopHttpServer.java`).

> **Note on Java Integration:** In cloud preview environments without a JDK runtime, the web frontend transparently executes its identical TypeScript mirror (`src/services/decisionEngineService.ts`) and never falsely claims live Java execution. When running locally with Java 21 installed, you can start `RepairLoopHttpServer` on port `8080` and connect the Decision Engine UI directly to the Java core service.

## Running the Web Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Authentication Setup Notes
- **Google Sign-In** works immediately out of the box and lets first-time users choose their RepairLoop role (`Customer`, `Mechanic`, or `Vendor`).
- **Email/Password Registration & Login**: If you wish to use Email/Password sign-up directly against Firebase Auth, enable **Email/Password** under *Firebase Console → Authentication → Sign-in method*.

## Running the Java 21 Core Module (`RepairLoopCore`)

Requires **JDK 21** (`javac` and `java`). No Maven, Gradle, or Spring Boot dependencies are needed.

```bash
cd RepairLoopCore
mkdir -p out
javac -d out $(find src -name "*.java")
```

### Run the End-to-End Console Demonstration
```bash
java -cp out com.repairloop.core.Main
```

### Run the Built-in Java HTTP Decision Engine Server (Optional)
```bash
java -cp out com.repairloop.core.server.RepairLoopHttpServer 8080
```

Then open the **Decision Engine** tab in the RepairLoop web app and click **Connect Java Service** (`http://localhost:8080`).
