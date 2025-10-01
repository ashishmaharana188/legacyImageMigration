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

-   **Chunking:** The logic now processes the list of transactions in chunks (currently set to 500 rows per chunk).
-   **Dynamic Query Building:** For each chunk, a single, parameterized `INSERT` statement is constructed dynamically. The query is built to handle multiple rows at once, for example:
    `INSERT INTO ... VALUES ($1, $2, ...), ($32, $33, ...), ...;`
-   **Reduced Round-Trips:** Instead of sending thousands of individual queries, the system now sends only a handful of batch queries (e.g., 2 queries for 1000 rows instead of 1000 queries).

**Benefit:**

This change drastically reduces the number of network round-trips required to insert the data, resulting in a significant improvement in insertion speed and a reduction in the overall load on the database. The performance gain is most noticeable over remote or high-latency connections.
