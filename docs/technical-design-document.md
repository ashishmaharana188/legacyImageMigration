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
