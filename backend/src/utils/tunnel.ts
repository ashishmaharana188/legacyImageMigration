import { createTunnel, TunnelOptions, ServerOptions, SshOptions, ForwardOptions } from "tunnel-ssh";
import fs from "fs";
import path from "path";
import os from "os";
import logger from "../utils/logger"; // Import the logger

export const startSshTunnel = async () => {
  const tunnelOptions: TunnelOptions = {
    autoClose: false,
    reconnectOnError: true,
  };

  const serverOptions: ServerOptions = {
    host: process.env.REMOTE_HOST as string,
    port: parseInt(process.env.DB_PORT as string, 10),
  };

  const sshOptions: SshOptions = {
    host: process.env.SSH_HOST as string,
    port: parseInt(process.env.SSH_PORT as string, 10),
    username: process.env.SSH_USER as string,
    privateKey: fs.readFileSync(
      path.join(os.homedir(), ".appConfig", "u2009226.pem")
    ),
  };

  const forwardOptions: ForwardOptions = {
    srcAddr: process.env.REMOTE_HOST as string,
    srcPort: parseInt(process.env.DB_PORT as string, 10),
    dstAddr: process.env.REMOTE_DB_HOST as string,
    dstPort: parseInt(process.env.REMOTE_DB_PORT as string, 10),
  };

  try {
    const [server] = await createTunnel(
      tunnelOptions,

      serverOptions,
      sshOptions,
      forwardOptions
    );
    console.log("SSH tunnel created");
    return server;
  } catch (error: unknown) {
    let errorMessage = "Unknown error";
    let errorStack: string | undefined;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    }
    console.error("SSH tunnel error:", errorMessage);
    logger.error({
      function: "startSshTunnel",
      message: "SSH tunnel error during creation.",
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
};

export const startMongoSshTunnel = async () => {
  if (process.env.USE_MONGO_SSH_TUNNEL !== "true") {
    console.log("MongoDB SSH tunnel is disabled. Skipping tunnel creation.");
    return null;
  }

  const tunnelOptions: TunnelOptions = {
    autoClose: false,
    reconnectOnError: true,
  };

  const localPort = parseInt(process.env.MONGO_SSH_LOCAL_PORT || "27017", 10);

  const serverOptions: ServerOptions = {
    host: "127.0.0.1",
    port: localPort,
  };

  const sshOptions: SshOptions = {
    host: process.env.SSH_HOST as string,
    port: parseInt(process.env.SSH_PORT || "22", 10),
    username: process.env.SSH_USER as string,
    privateKey: fs.readFileSync(
      path.join(os.homedir(), ".appConfig", "u2009226.pem")
    ),
  };

  const forwardOptions: ForwardOptions = {
    srcAddr: "127.0.0.1",
    srcPort: localPort,
    dstAddr: process.env.MONGO_SSH_REMOTE_HOST as string,
    dstPort: parseInt(process.env.MONGO_SSH_REMOTE_PORT || "27017", 10),
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
    return { server, localPort };
  } catch (error: unknown) {
    let errorMessage = "Unknown error";
    let errorStack: string | undefined;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    }
    console.error("MongoDB SSH tunnel error during creation:", errorMessage);
    logger.error({
      function: "startMongoSshTunnel",
      message: "MongoDB SSH tunnel error during creation.",
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
};
