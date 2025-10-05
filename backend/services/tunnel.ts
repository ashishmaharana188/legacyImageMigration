import { createTunnel } from "tunnel-ssh";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import logger from "../utils/logger"; // Import the logger

export const startSshTunnel = async () => {
  const tunnelOptions: any = {
    autoClose: false,
    reconnectOnError: true,
  };

  const serverOptions: any = {
    host: process.env.REMOTE_HOST,
    port: process.env.DB_PORT,
  };

  const sshOptions: any = {
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT,
    username: process.env.SSH_USER,
    privateKey: fs.readFileSync(
      path.join(os.homedir(), ".appConfig", "u2009226.pem")
    ),
  };

  const forwardOptions: any = {
    srcAddr: process.env.REMOTE_HOST,
    srcPort: process.env.DB_PORT,
    dstAddr: process.env.REMOTE_DB_HOST,
    dstPort: process.env.REMOTE_DB_PORT,
  };

  try {
    const [server, conn] = await createTunnel(
      tunnelOptions,

      serverOptions,
      sshOptions,
      forwardOptions
    );
    console.log("SSH tunnel created");
    return server;
  } catch (error: any) {
    console.error("SSH tunnel error:", error);
    logger.error({
      function: "startSshTunnel",
      message: "SSH tunnel error during creation.",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export const startMongoSshTunnel = async () => {
  if (process.env.USE_MONGO_SSH_TUNNEL !== "true") {
    console.log("MongoDB SSH tunnel is disabled. Skipping tunnel creation.");
    return null;
  }

  const tunnelOptions: any = {
    autoClose: false,
    reconnectOnError: true,
  };

  const localPort = parseInt(process.env.MONGO_SSH_LOCAL_PORT || "27017", 10);

  const serverOptions: any = {
    host: "127.0.0.1", // Localhost for the tunnel's listening port
    port: localPort,
  };

  const sshOptions: any = {
    host: process.env.SSH_HOST, // Reusing SSH_HOST from general config
    port: parseInt(process.env.SSH_PORT || "22", 10), // Reusing SSH_PORT
    username: process.env.SSH_USER, // Reusing SSH_USER
    privateKey: fs.readFileSync(
      path.join(os.homedir(), ".appConfig", "u2009226.pem")
    ),
    // passphrase: process.env.SSH_PASSPHRASE, // Uncomment if your key has a passphrase
  };

  const forwardOptions: any = {
    srcAddr: "127.0.0.1", // Source address for the tunnel (local)
    srcPort: localPort, // Local port to listen on
    dstAddr: process.env.MONGO_SSH_REMOTE_HOST, // Remote MongoDB host
    dstPort: parseInt(process.env.MONGO_SSH_REMOTE_PORT || "27017", 10), // Remote MongoDB port
  };

  try {
    console.log("Calling createTunnel to establish MongoDB SSH tunnel.");
    const [server, conn] = await createTunnel(
      tunnelOptions,
      serverOptions,
      sshOptions,
      forwardOptions
    );

    server.on("error", (err: Error) => {
      console.error("MongoDB SSH tunnel server error:", err.message);
      logger.error({
        function: "startMongoSshTunnel",
        message: "MongoDB SSH tunnel server error.",
        error: err.message,
        stack: err.stack,
      });
    });

    server.on("close", () => {
      console.warn("MongoDB SSH tunnel server closed.");
      logger.warn({
        function: "startMongoSshTunnel",
        message: "MongoDB SSH tunnel server closed.",
      });
    });

    conn.on("error", (err: Error) => {
      console.error("MongoDB SSH connection error:", err.message);
      logger.error({
        function: "startMongoSshTunnel",
        message: "MongoDB SSH connection error.",
        error: err.message,
        stack: err.stack,
      });
    });

    conn.on("end", () => {
      console.warn("MongoDB SSH connection ended.");
      logger.warn({
        function: "startMongoSshTunnel",
        message: "MongoDB SSH connection ended.",
      });
    });

    console.log(`MongoDB SSH tunnel created successfully and listening on localhost:${localPort}.`);
    return { server, localPort }; // Return the local port
  } catch (error: any) {
    console.error("MongoDB SSH tunnel error during creation:", error.message);
    logger.error({
      function: "startMongoSshTunnel",
      message: "MongoDB SSH tunnel error during creation.",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};
