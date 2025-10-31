import { listFiles, deleteFiles, listAllFoldersAndFileCounts } from "./services/s3Manager";
import * as readline from "readline";
import "dotenv/config";
import * as fs from "fs/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: ts-node s3-tool.ts <list|report> <prefix>");
    process.exit(1);
  }

  const command = args[0];
  const prefix = args[1];

  if (command === "list") {
    const { directories, files } = await listFiles(prefix);

    if (directories.length > 0) {
      console.log("Directories found:");
      directories.forEach((dir) => console.log(dir));
    }

    if (files.length > 0) {
      console.log("Files found:");
      files.forEach((file) => console.log(file.key));
    }

    if (directories.length === 0 && files.length === 0) {
      console.log("No files or directories found at that prefix.");
    }

    rl.close();
  } else if (command === "report") {
    console.log(`Generating report for prefix: ${prefix}`);
    const folderFileCounts = await listAllFoldersAndFileCounts(prefix);

    let csvContent = "Folder,File Count\n";
    folderFileCounts.forEach((count, folder) => {
      csvContent += `${folder},${count}\n`;
    });

    const reportFileName = `s3_report_${prefix.replace(/\//g, "_") || "root"}.csv`;
    const reportFilePath = `./${reportFileName}`;

    // Using fs.promises.writeFile for writing the file
    const fs = require('fs').promises;
    await fs.writeFile(reportFilePath, csvContent);
    console.log(`Report successfully generated at ${reportFilePath}`);
    rl.close();
  } else {
    console.log(`Unknown command: ${command}`);
    console.log("Usage: ts-node s3-tool.ts <list|report> <prefix>");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("An error occurred:", err);
  process.exit(1);
});
