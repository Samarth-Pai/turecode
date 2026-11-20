import { spawn } from "node:child_process";
import os from "node:os";

const mode = process.argv[2] === "dev" ? "dev" : "start";
const extraArgs = process.argv.slice(3);

function resolvePort(args: string[]): string {
  const portFlagIdx = args.findIndex((a) => a === "-p" || a === "--port");
  if (portFlagIdx >= 0 && args[portFlagIdx + 1]) {
    return args[portFlagIdx + 1];
  }
  return process.env.PORT || "3000";
}

function getLanIpv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const addresses: string[] = [];
  for (const ifaceList of Object.values(nets)) {
    if (!ifaceList) continue;
    for (const net of ifaceList) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

const port = resolvePort(extraArgs);
const lanIps = getLanIpv4Addresses();

if (lanIps.length > 0) {
  console.log("\n🌐 LAN / Wi-Fi Access URLs:");
  for (const ip of lanIps) {
    console.log(`   → http://${ip}:${port}`);
  }
  console.log("");
} else {
  console.log(`\n🌐 No external LAN IPv4 interface detected (listening on 0.0.0.0:${port})\n`);
}

const child = spawn("bunx", ["next", mode, "-H", "0.0.0.0", ...extraArgs], {
  stdio: "inherit",
  env: process.env,
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    child.kill(sig);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

