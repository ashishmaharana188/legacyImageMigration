# Technical Design Document (TDD)

This document details the implementation plan for specific features or modules within the PDF Processor Backend project.

## 1. Introduction

(Overview of the feature/module being implemented.)

## 2. Detailed Design

(Low-level design, including data structures, algorithms, and API specifications.)

## 3. Implementation Plan

(Step-by-step plan for coding and testing.)

## 4. Performance Optimizations

### 4.1. Batch SQL Insertion for Performance

**Problem:**

The previous implementation for inserting data into the `investor.aif_document_details` table involved iterating through a list of transactions and executing a separate `INSERT` statement for each row. This one-row-at-a-time approach created a significant performance bottleneck, especially when connecting to the database over a higher-latency network like an SSH tunnel. Each `INSERT` statement required a separate network round-trip, and the cumulative latency made the data insertion process extremely slow.

**Solution:**

To address this, the `executeSql` function in `backend/services/database.ts` was refactored to use a high-performance batch insertion strategy.

**Implementation Details:**

- **Chunking:** The logic now processes the list of transactions in chunks (currently set to 500 rows per chunk).
- **Dynamic Query Building:** For each chunk, a single, parameterized `INSERT` statement is constructed dynamically. The query is built to handle multiple rows at once, for example:
  `INSERT INTO ... VALUES ($1, $2, ...), ($32, $33, ...), ...;`
- **Reduced Round-Trips:** Instead of sending thousands of individual queries, the system now sends only a handful of batch queries (e.g., 2 queries for 1000 rows instead of 1000 queries).

**Benefit:**

This change drastically reduces the number of network round-trips required to insert the data, resulting in a significant improvement in insertion speed and a reduction in the overall load on the database. ### 4.2. Sanity Check Duplicates Enhancement

**Definition of a Perfect Row:**
A row is considered "perfect" if all of the following fields are populated (not NULL): `folio_id`, `transaction_reference_id`, `user_attr1`, `user_attr2`, and `client_id`.

**Definition of an Imperfect Row:**
A row is considered "imperfect" if any of the fields required for a perfect row (`folio_id`, `transaction_reference_id`, `user_attr1`, `user_attr2`, or `client_id`) are missing (NULL).

**Problem:**

The initial implementation of the `sanityCheckDuplicates` function in `backend/services/database.ts` primarily focused on deleting imperfect duplicate rows only when a corresponding "perfect" row (i.e., a row with `folio_id`, `transaction_reference_id`, `user_attr1`, `user_attr2`, and `client_id` all populated) existed within the same `user_attr1` group. This left scenarios where groups of `user_attr1`s contained multiple "imperfect" duplicates but no "perfect" rows unaddressed, leading to an inflated count of imperfect data and hindering the finalization of accurate perfect and imperfect data counts.

**Solution:**

To provide a more comprehensive duplicate mitigation strategy, a new deletion rule has been introduced to handle groups of `user_attr1`s that consist solely of imperfect duplicates. This enhancement ensures that even in the absence of a perfect row, duplicate imperfect entries are reduced to a single, most recent record.

**Implementation Details:**

- **New Deletion Rule (Rule 3):** A new SQL query, `deleteImperfectDuplicatesSql`, was added to `backend/services/database.ts`. This query identifies groups of `aif_document_details` records that share the same `client_id` and `user_attr1` (normalized if specified), where:
  - The group contains more than one record.
  - None of the records in the group meet the criteria for a "perfect" row (i.e., all are imperfect).
  - Within such groups, all records except the most recent one (ordered by `creation_date` descending, then `id` descending) are marked for deletion.
- **Integration into `sanityCheckDuplicates`:**
  - **Dry Run:** The `dryRun` logic within `sanityCheckDuplicates` was updated to incorporate this new rule and the revised definition of a "perfect" row. When simulating deletions, rows that would be removed by `deleteImperfectDuplicatesSql` are now correctly identified and marked with a `wouldBeDeleted` flag and an appropriate `reason`. This provides a more accurate preview of the changes.
  - **Live Deletion:** The `deleteImperfectDuplicatesSql` query is now executed as part of the live deletion process, following the existing rules for deleting imperfects with perfect counterparts and older perfect duplicates.
  - **Total Deleted Count:** The `totalDeleted` count in the live deletion summary now includes the rows deleted by this new rule, providing an accurate total of mitigated duplicates.

**Benefit:**

This enhancement allows for a more robust and complete sanity check process. By addressing imperfect duplicate groups that lack perfect rows, the system can:

- **Finalize Accurate Counts:** Provide more precise "Perfect count" and "Imperfect count" metrics, reflecting the true state of data after duplicate mitigation.
- **Mitigate Duplicates:** Empower users to effectively reduce redundant imperfect data, streamlining the process of identifying and fixing remaining imperfect records.
- **Improved Data Quality:** Contribute to overall better data quality by systematically removing unnecessary duplicate entries, even in complex imperfect scenarios.

### 4.4. MongoDB Performance Optimization: Compound Indexing for `updateMongoTransactions`

**Problem:**

The `updateMongoTransactions` function in `backend/services/mongoDatabase.ts` currently performs `find` operations on the MongoDB collection using a combination of `clientId` and `transactionNo` within an `$or` query. Without a suitable index, these queries result in full collection scans, leading to significant performance bottlenecks, especially with large datasets (e.g., 50,000 documents or more). This severely impacts the speed of the `updateMongoTransactions` process.

The relevant query pattern is:

```typescript
const uniqueFilters = pgData.map((data) => ({
  clientId: data.client_code,
  transactionNo: data.user_attr1,
}));

const mongoDocs = await this.model
  .find({ $or: uniqueFilters })
  .lean();
```

**Solution:**

To drastically improve the performance of these MongoDB `find` operations, a compound index should be created on the `clientId` and `transactionNo` fields of the relevant MongoDB collection.

**Implementation Details:**

1.  **Identify the Target Collection:** Determine the MongoDB collection that corresponds to `this.model` in `mongoDatabase.ts`. This is typically the collection storing your transaction documents.

2.  **Create a Compound Index:**
    The recommended index is a compound index on `clientId` and `transactionNo`. The order of fields in a compound index matters for query efficiency. For queries that filter on both `clientId` and `transactionNo`, `{"clientId": 1, "transactionNo": 1}` is generally optimal.

    **Using MongoDB Shell:**
    Connect to your MongoDB instance and execute the following command:

    ```javascript
    db.your_collection_name.createIndex({ clientId: 1, transactionNo: 1 });
    ```
    Replace `your_collection_name` with the actual name of your MongoDB collection.

    **Using Mongoose (if applicable in your `mongoDatabase.ts` model definition):**
    If your `mongoDatabase.ts` uses Mongoose or a similar ODM, you can define the index directly in your schema:

    ```typescript
    import { Schema, model } from 'mongoose';

    interface ITransaction {
      clientId: string;
      transactionNo: string;
      // other fields
    }

    const transactionSchema = new Schema<ITransaction>({
      clientId: { type: String, required: true },
      transactionNo: { type: String, required: true },
      // other field definitions
    });

    // Add the compound index
    transactionSchema.index({ clientId: 1, transactionNo: 1 });

    const TransactionModel = model<ITransaction>('Transaction', transactionSchema);
    ```
    This approach ensures the index is created when your application connects to MongoDB and the model is defined.

**Benefit:**

Implementing this compound index will allow MongoDB to efficiently use the index to locate documents matching the `clientId` and `transactionNo` criteria, avoiding full collection scans. This will lead to a significant reduction in query execution time for the `updateMongoTransactions` process, improving overall application performance and responsiveness.

### 4.5. Granular MongoDB Transaction Updates

**Problem:**

The `updateMongoTransactions` function previously performed a global update, fetching all relevant PostgreSQL data and then attempting to match and update MongoDB documents. This approach lacked granularity, making it inefficient for scenarios where updates needed to be restricted to specific `clientId` values or to documents created by a particular source (e.g., 'system'). This could lead to unnecessary data processing and potential performance overhead when only a subset of data required synchronization.

**Solution:**

To enhance efficiency and control, the `updateMongoTransactions` process has been refined to allow for `clientId`-specific updates and to filter PostgreSQL data based on the `created_by = 'system'` field. This ensures that only relevant data is streamed from PostgreSQL and processed for MongoDB updates, aligning with the `sourceUser: 'system'` field in MongoDB.

**Implementation Details:**

1.  **`backend/services/database.ts` - `streamUpdateDetails` function:**
    *   **`clientId` Parameter:** An optional `clientId` parameter was added to the function signature.
    *   **SQL Query Filtering:** The PostgreSQL query within `streamUpdateDetails` was modified to include a `WHERE add.created_by = 'system'` clause. Additionally, if a `clientId` is provided, an `AND add.client_id = $X` clause is dynamically appended to the query, and the `clientId` is passed as a parameter to the `pg-cursor` for efficient filtering at the database level.

2.  **`backend/services/mongoDatabase.ts` - `updateMongoTransactions` function:**
    *   **`clientId` Parameter:** An optional `clientId` parameter was added to the function signature.
    *   **Stream Call Update:** The `database.streamUpdateDetails` call now passes the `clientId` parameter, ensuring that PostgreSQL streams only the data relevant to the specified client.
    *   **MongoDB Query Filtering:** The MongoDB `find` query was updated to include `sourceUser: 'system'` as a mandatory filter. If a `clientId` is provided, `clientId: clientId` is also added to the MongoDB query, ensuring that only MongoDB documents belonging to the specified client and created by 'system' are considered for updates.

**Benefit:**

These enhancements provide several key benefits:

-   **Improved Performance:** By filtering data at the source (both PostgreSQL and MongoDB) based on `created_by = 'system'` and `clientId`, the amount of data processed is significantly reduced, leading to faster execution times for `updateMongoTransactions`.
-   **Enhanced Granularity:** The ability to specify a `clientId` allows for targeted updates, which is crucial for managing large datasets and ensuring that only the intended data is modified.
-   **Data Consistency:** The explicit filtering by `created_by = 'system'` and `sourceUser: 'system'` ensures that the synchronization process between PostgreSQL and MongoDB is consistent for system-generated entries.
-   **Reduced Resource Consumption:** Less data transfer and processing lead to lower CPU, memory, and network resource utilization on both the database servers and the application backend.


**Problem:**

The original S3 Browser component (`S3BrowserTask.tsx`) was built using `useEffect` for data fetching and manual state management with multiple `useState` hooks. This approach led to several issues:

-   **Complex State Management:** Numerous state variables (`s3Files`, `s3Directories`, `nextContinuationToken`, `isSearching`, `searchResults`) were required to manage data, loading states, and pagination, making the component difficult to maintain.
-   **Manual Data Fetching:** Logic for fetching, refetching (after deletes), and pagination ("Load More") was handled by imperative functions (`fetchS3Objects`, `handleLoadMore`), leading to more complex code.
-   **Unnecessary API Calls:** The `useEffect`-based approach could trigger redundant API calls, especially during searching and initial component load.
-   **Poor User Experience:** Navigating between previously visited folders required re-fetching data every time, resulting in a slow and unresponsive UI.

**Solution:**

To address these issues, the component was refactored to use `@tanstack/react-query`, a powerful data-fetching and state management library. This change streamlines the component by replacing manual, imperative logic with a declarative, hook-based approach.

**Implementation Details:**

-   **Declarative Data Fetching:**
    -   The `useEffect` hook for fetching S3 objects was replaced with the `useInfiniteQuery` hook. The query is tied to a unique key `['s3Objects', currentPrefix]`, which automatically triggers a refetch whenever the `currentPrefix` (the current folder) changes.
    -   A separate `useInfiniteQuery` was implemented for handling debounced searching, which is only enabled when the user is in "filter mode" and has entered a search term.
-   **Simplified State Management:**
    -   `useInfiniteQuery` consolidates data, loading, and error states into a single object, which allowed for the removal of several `useState` variables.
    -   The hook manages pagination state internally, providing a `fetchNextPage` function and an `hasNextPage` boolean to simplify the "Load More" functionality.
-   **Efficient Mutations:**
    -   The file deletion logic was refactored to use the `useMutation` hook.
    -   Upon a successful deletion, the mutation invalidates the `['s3Objects', currentPrefix]` query. This automatically triggers a background refetch for the current folder, ensuring the UI is always synchronized with the server state without manual intervention.
-   **Improved User Experience with Caching:**
    -   TanStack Query provides out-of-the-box caching. When a user navigates to a folder, the data is fetched and cached. If the user navigates away and then returns, the cached data is displayed instantly, making the application feel significantly faster and more responsive.

**Benefit:**

This refactoring resulted in a more robust, maintainable, and performant S3 Browser. The code is now simpler and more declarative, and the user experience is greatly improved due to automatic caching and efficient, synchronized data fetching.

### 4.6. Batch Update Optimization for `updateFolioAndTransaction`

**Problem:**

The `updateFolioAndTransaction` function in `backend/services/database.ts` previously suffered from performance bottlenecks due to:
1.  **Redundant CSV Parsing:** It re-parsed the CSV file to generate transactions, even when this data was already available from a preceding `generateSql` call.
2.  **Inefficient `ANY` Clauses:** Update queries relied on `ANY($1::text[])` clauses with potentially large arrays of `processedFolioNumbers` and `uniqueClientCodes`. While better than individual updates, these could still become inefficient with very large datasets, leading to slower execution times for batch updates.

**Solution:**

To significantly improve the efficiency of `updateFolioAndTransaction`, the process was refactored to:
1.  **Reuse Parsed Data:** Accept `transactions` and `logs` directly as parameters, eliminating redundant CSV parsing and SQL generation.
2.  **Utilize Temporary Tables for Joins:** Introduce a temporary table (`temp_transaction_data`) to stage `id_ihno` and `id_acno` values, enabling more efficient join-based updates instead of large `ANY` clauses.

**Implementation Details:**

-   **`backend/services/database.ts` - `updateFolioAndTransaction` function:**
    -   The function signature was updated to accept `transactions` (an array of parsed transaction objects) and `logs` (an array of `SqlLog` entries) as parameters.
    -   A temporary table named `temp_transaction_data` is created at the beginning of the transaction. This table stores `id_ihno` and `id_acno` for all transactions relevant to the current update batch.
    -   Data from the `transactions` array is inserted into `temp_transaction_data` in chunks (e.g., 1000 rows per chunk) to optimize database writes.
    -   The `updateFolioQuery` (Query 3) and `updateTransactionQuery` (Query 4) were modified to join with `temp_transaction_data` on `d.user_attr1 = ttd.id_ihno AND d.user_attr2 = ttd.id_acno`. This replaces the less efficient `ANY` clause filtering for these specific conditions.
    -   The `processedFolioNumbers` array is now derived directly from the `id_acno` values within the provided `transactions` array when `updateAll` is false.
-   **`backend/controllers/fileController.ts` - `processSqlMongo` and `updateFolioAndTransaction` endpoints:**
    -   Both endpoints now call `database.generateSql()` once to obtain the `transactions` and `logs` data.
    -   These `transactions` and `logs` are then passed as arguments to `database.updateFolioAndTransaction`, ensuring that the data is processed only once.

**Benefit:**

These optimizations lead to a substantial improvement in the performance of batch updates within `updateFolioAndTransaction`:
-   **Reduced Processing Overhead:** Eliminating redundant CSV parsing saves significant CPU cycles and I/O operations.
-   **Faster Database Operations:** Using a temporary table for joins allows the PostgreSQL query planner to execute updates much more efficiently, especially with large numbers of records (e.g., 20,000 updates within 1 minute).
-   **Improved Scalability:** The chunked insertion into the temporary table and the optimized join queries make the update process more scalable for larger datasets.
-   **Consistent Data Flow:** Ensures that the `updateFolioAndTransaction` logic operates on the same, already-parsed transaction data as other SQL operations.

### 4.7. Streaming CSV Parsing for `generateSql`

**Problem:**

The original implementation of the `generateSql` function in `backend/services/database.ts` used `ExcelJS` to read entire CSV files into memory. For very large CSV files, this approach was inefficient, leading to high memory consumption and increased initial latency as the application had to wait for the entire file to be loaded and parsed before processing could begin.

**Solution:**

To address these inefficiencies, the `generateSql` function was refactored to use a streaming CSV parsing approach. This allows the application to process CSV data in chunks, significantly reducing memory footprint and improving responsiveness for large files.

**Implementation Details:**

-   **`backend/services/database.ts` - `generateSql` function:**
    -   The dependency on `ExcelJS` for CSV reading was replaced with `fs.createReadStream` and the `parse` function from the `csv-parse` library.
    -   A readable stream is created from the CSV file and piped directly to the `csv-parse` parser.
    -   The parser is configured to skip the header row (`from_line: 2`).
    -   As data chunks are parsed, individual rows are emitted via the 'data' event and collected into the `transactions` array.
    -   Error handling for parsing issues (e.g., invalid data in a row) and stream errors (e.g., file read errors) is maintained, logging details and pushing errors to the `logs` array.
    -   A `Promise` is used to await the completion of the streaming process before proceeding with SQL generation.

**Benefit:**

This streaming CSV parsing optimization provides several key benefits:
-   **Reduced Memory Consumption:** The application no longer needs to load the entire CSV file into memory, making it highly efficient for processing very large datasets without risking out-of-memory errors.
-   **Lower Initial Latency:** Processing of CSV data begins as soon as the first chunks are read, reducing the initial wait time and improving the responsiveness of the application.
-   **Improved Scalability:** The streaming approach allows the system to handle CSV files of virtually any size, enhancing the overall scalability and robustness of the data ingestion process.
-   **Consistent Performance:** Provides a more consistent performance profile, as processing occurs incrementally rather than in a large, upfront operation.

## 5. Conclusion

(Summary of the document and future considerations.)

# SQL Execution Summary Implementation Flow

## Objective

To display the "Total Inserts" count within the "SQL Execution Summary" section of the `DetailsDisplayUI` component in the frontend, utilizing the `successfulRows` value provided by the backend.

## Implementation Steps

1.  **Update `SqlExecutionLog` Interface (Previous Step)**

    - **File:** `frontend/src/types/index.ts`
    - **Change:** An optional `totalInserts?: number;` property was previously added to the `SqlExecutionLog` interface. While this property is not directly used for display in the current implementation, it remains for potential future direct backend provision.

2.  **Modify `DetailsDisplayUI` Component**
    - **File:** `frontend/src/components/ui/DetailsDisplayUI.tsx`
    - **Change:** Within the `SQL Execution Summary` conditional block (`log.successfulRows !== undefined && log.badRows !== undefined`), the display for "Total Inserts" was updated to use `log.successfulRows`. A conditional check (`log.successfulRows !== undefined ? log.successfulRows : 'N/A'`) is used to gracefully handle cases where `successfulRows` might not be present in the log object.

## Backend Considerations

- The backend is currently expected to provide `successfulRows` within the `SqlExecutionLog` object. This value is now directly used to represent "Total Inserts" on the frontend.

## Verification

To verify the changes, run the frontend application and trigger a process that generates a `SqlExecutionLog` with `successfulRows` data. The "Total Inserts" count should now be visible under the "SQL Execution Summary" in the UI, reflecting the `successfulRows` value.