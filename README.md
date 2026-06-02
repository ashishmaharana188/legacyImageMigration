<h1>Legacy Image Migration Architecture</h1>

<h2>System Architecture Diagram</h2>
<pre><code>
=============================================================================
                     LEGACY IMAGE MIGRATION ARCHITECTURE
=============================================================================

+---------------------------------------------------------------------------+
|                          FRONTEND (React / Vite / TS)                     |
|                                                                           |
|  +--------------------+  +--------------------+  +---------------------+  |
|  |     UI Routing     |  |   Core Components  |  |   State & Context   |  |
|  | - dataCleanRouter  |  | - Sidebar          |  | - TaskLogContext    |  |
|  | - s3ManagerRouter  |  | - ProgressTracking |  | - WebSocketProvider |  |
|  | - splitProcessor...|  | - SummaryDisplay   |  |                     |  |
|  +---------+----------+  +---------+----------+  +----------+----------+  |
|            |                       |                        |             |
|  +---------v-----------------------v------------------------v----------+  |
|  |                 Services (apiClient, webSocketService)              |  |
+--+---------------------------------+-----------------------------------+--+
                                     | HTTP / REST
                                     | WebSockets
+------------------------------------+--------------------------------------+
|                           BACKEND (TypeScript / Node.js)                  |
|                                                                           |
|  +---------------------------------------------------------------------+  |
|  |                     API Controllers & Core Logic                    |  |
|  |  [ dataClean ] [ imageDataTransfer ] [ s3Processor ] [ upload ]     |  |
|  +---------------------------------+-----------------------------------+  |
|                                    |                                      |
|  +---------------------------------v-----------------------------------+  |
|  |                         Split Processor Module                      |  |
|  |  - splitProcessor.ts                                                |  |
|  |  - Python Sub-processes: mupdf_splitter.py, fallBackSplit.py        |  |
|  +---------------------------------+-----------------------------------+  |
|                                    |                                      |
|  +---------------------------------v-----------------------------------+  |
|  |                         Utility & Integration Layer                 |  |
|  |  - dbConnect.ts         - s3Config.ts          - tunnel.ts          |  |
|  |  - postgresStagingUtil  - athenaService.ts     - webSocketService   |  |
|  +-------+-------------------------+------------------------+----------+  |
+----------|-------------------------|------------------------|-------------+
           |                         |                        |
+----------v---------+     +---------v----------+    +--------v-----------+
|     Databases      |     |    Cloud Storage   |    |  Cloud Analytics   |
| - PostgreSQL (SQL) |     | - AWS S3           |    | - AWS Athena       |
| - MongoDB          |     |                    |    |                    |
+--------------------+     +--------------------+    +--------------------+
</code></pre>

<h2>Project Overview</h2>
<p>The Legacy Image Migration project is a full-stack application designed to orchestrate and track the migration, cleaning, and processing of legacy data and images<!--[cite: 4]-->. The system utilizes a modular TypeScript backend integrated with Python scripts, alongside a React frontend that provides real-time progress tracking via WebSockets<!--[cite: 4]-->.</p>

<h2>1. Frontend Architecture</h2>
<p>The frontend is a Single Page Application built using React, TypeScript, and Vite<!--[cite: 4]-->. It uses a file-based routing system, indicated by <code>routeTree.gen.ts</code>, to separate distinct migration workflows<!--[cite: 4]-->.</p>

<h3>Core Frontend Modules</h3>
<ul>
  <li><strong>Routing and Views:</strong> Dedicated routes govern specific tasks, including <code>dataCleanRouter.tsx</code>, <code>imageDataTransferRouter</code>, <code>s3ManagerRouter.tsx</code>, <code>splitProcessorRouter.tsx</code>, and <code>uploadProcessorRouter.tsx</code><!--[cite: 4]-->.</li>
  <li><strong>UI Components:</strong> Reusable interface elements like <code>Sidebar.tsx</code>, <code>ProgressTrackingUI.tsx</code>, and <code>SummaryDisplay.tsx</code> manage user interaction and task visualization<!--[cite: 4]-->.</li>
  <li><strong>Real-Time Communication:</strong> The frontend maintains live backend connections using <code>webSocketService.ts</code> and <code>webSocketMessageProcessor.ts</code><!--[cite: 4]-->. Global contexts such as <code>WebSocketProvider.tsx</code> and <code>TaskLogContext.tsx</code> broadcast task statuses<!--[cite: 4]-->.</li>
</ul>

<h2>2. Backend Architecture</h2>
<p>The backend is built in TypeScript and Node.js. It functions as the primary orchestrator for data transformation, cloud interaction, and database staging<!--[cite: 4]-->.</p>

<h3>Core Backend Modules</h3>
<ul>
  <li><strong>Data Clean (<code>src/api/dataClean/</code>):</strong> Manages data validation and sanitization using MongoDB (<code>dataCleanMongoUtil.ts</code>) and PostgreSQL (<code>dataCleanSqlUtil.ts</code>) utilities<!--[cite: 4]-->.</li>
  <li><strong>Image Data Transfer (<code>src/api/imageDataTransfer/</code>):</strong> Contains the core migration logic for image records between legacy SQL databases and modern Mongo document stores<!--[cite: 4]-->.</li>
  <li><strong>S3 Processor (<code>src/api/s3Processor/</code>):</strong> Integrates with AWS via <code>s3Manager.ts</code> and <code>s3Uploader.ts</code> to manage cloud storage assets<!--[cite: 4]-->.</li>
  <li><strong>Upload Processor (<code>src/api/uploadProcessor/</code>):</strong> Processes bulk data ingests, handling Excel files via <code>uploadExcelProcessor.ts</code><!--[cite: 4]-->.</li>
  <li><strong>Hybrid Split Processor (<code>src/api/splitProcessor/</code>):</strong> Combines TypeScript orchestration with Python automation<!--[cite: 4]-->. It uses <code>mupdf_splitter.py</code> and <code>fallBackSplit.py</code> to execute document or image splitting tasks<!--[cite: 4]-->.</li>
</ul>

<h2>3. Data and Utility Layer</h2>
<p>The backend features a utility layer (<code>src/utils/</code>) designed to interact with external data stores and infrastructure components<!--[cite: 4]-->:</p>
<ul>
  <li><strong>Databases:</strong> Connections are managed through <code>dbConnect.ts</code>, with staging operations handled by <code>postgresStagingUtil.ts</code><!--[cite: 4]-->.</li>
  <li><strong>Cloud Services:</strong> Interacts with AWS S3 (<code>s3Config.ts</code>) for object storage and AWS Athena (<code>athenaService.ts</code>) for querying data logs<!--[cite: 4]-->.</li>
  <li><strong>Network and Infrastructure:</strong> Implements secure routing via <code>tunnel.ts</code> and manages live client updates via <code>webSocketService.ts</code><!--[cite: 4]-->.</li>
</ul>

<img width="1434" height="998" alt="image" src="https://github.com/user-attachments/assets/f08fbaab-7741-463d-b691-42e02da00c4c" />

