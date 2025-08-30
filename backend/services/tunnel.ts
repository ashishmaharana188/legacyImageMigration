import { createTunnel } from "tunnel-ssh";
import * as fs from "fs";
import * as path from "path";

export const startSshTunnel = async () => {
  const tunnelOptions: any = {
    autoClose: true,
    reconnectOnError: false,
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
      path.join(process.cwd(), "keys", "u2009226.pem")
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
  } catch (error) {
    console.error("SSH tunnel error:", error);
    throw error;
  }
};
