Layer,File Example,Purpose
Trigger (UI),SanityCheckUI.tsx,"Captures user input (dates, checkboxes) and calls the hook function."
Logic (Hook),sanityCheckHook.tsx,"Manages loading states, formats dates (e.g., cutoffTms), and handles the asynchronous ""wait""."
Network (Service),sanityCheckService.tsx,The actual axios.post call. This is where the URL and Request Body are defined.
Entry (App/Router),dataCleanApp.ts,"The backend ""Gatekeeper"" that routes the URL to the correct Controller."
Bridge (Controller),dataCleanController.ts,Extracts data from req.body and prepares it for the core utility.
Execution (Util),dataCleanSqlUtil.ts,Connects to the database and runs the SQL queries.
