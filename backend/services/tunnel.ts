import { createTunnel } from "tunnel-ssh";
import * as fs from "fs";
import * as path from "path";

export const startSshTunnel = async () => {
  const tunnelOptions: any = {
    autoClose: true,
    reconnectOnError: false,
  };

  const serverOptions: any = {
    host: "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5433", 10),
  };

  const sshOptions: any = {
    host: process.env.SSH_HOST,
    port: 22,
    username: process.env.SSH_USER,
    privateKey: fs.readFileSync(
      path.join(process.cwd(), "keys", "u2009226.pem")
    ),
  };

  const forwardOptions: any = {
    srcAddr: "127.0.0.1",
    srcPort: parseInt(process.env.DB_PORT || "5433", 10),
    dstAddr: process.env.REMOTE_DB_HOST,
    dstPort: parseInt(process.env.REMOTE_DB_PORT || "24888", 10),
  };

  console.log("SSH Tunnel Options:", {
    tunnelOptions,
    serverOptions,
    sshOptions,
    forwardOptions,
  });

  try {
    const [server, conn] = await createTunnel(
      tunnelOptions,
      serverOptions,
      sshOptions,
      forwardOptions
    );
    console.log("SSH tunnel created");
    return server;
  } catch (error) {
    console.error("SSH tunnel error:", error);
    throw error;
  }
};
