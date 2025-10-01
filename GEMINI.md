# Project: PDF Processor Backend

## 1. Project Purpose

This project is an internal tool created for migrating legacy images, likely involving PDF processing and interaction with S3 and databases.

## 2. Architecture Overview

The application consists of a frontend (React/Vite) and a backend (Node.js/TypeScript with some Python services).

- **Frontend:** A React application built with Vite, providing a user interface for interacting with the backend services.
- **Backend:** A Node.js/TypeScript Express application handling API requests, S3 interactions, database operations (MongoDB and potentially SQL), and PDF processing. It also leverages Python scripts for specific fallback processing tasks.

## 3. Key Technologies and Frameworks

- **Frontend:** React, Vite
- **Backend:** Node.js, TypeScript, Express.js
- **Database:** MongoDB (and potentially other SQL databases)
- **Cloud Storage:** AWS S3
- **PDF Processing:** Python (for fallback processing), TypeScript services
- **Code Quality:** ESLint
- **Dependency Management:** npm/pnpm (Node.js), pip/uv (Python)

## 4. Key Files and Directories

- `frontend/`: Contains the React application.
- `backend/`: Contains the Node.js/TypeScript backend services.
  - `backend/app.ts`: Main entry point for the backend application.
  - `backend/controllers/fileController.ts`: Handles file-related API endpoints.
  - `backend/services/`: Contains various service modules (database, S3, PDF processing, WebSocket).
  - `backend/services/fallback_processor.py`, `backend/services/fallBackSplit.py`: Python scripts for specific processing tasks.
- `package.json` (root, frontend, backend): Dependency management.
- `tsconfig.json` (root, frontend, backend): TypeScript configuration.

## 5. Local Setup and Running

(To be filled in with specific instructions for setting up and running the frontend and backend locally.)

## 6. Project-Specific Conventions

(To be filled in with any specific coding styles, architectural patterns, or other conventions unique to this project.)