import { connection, NextResponse } from "next/server";
import { sandboxExecutor } from "@/lib/sandbox";

export async function GET() {
  await connection();
  const health = await sandboxExecutor.checkHealth();
  return NextResponse.json({
    status: health.socketActive ? "healthy" : "degraded",
    daemon_socket: health.socketPath,
    socket_active: health.socketActive,
    daemon_binary_exists: health.daemonBinaryExists,
    workspaces_root: health.workspacesRoot,
    engine: "Linux Landlock LSM + POSIX Fork-Server (Samarth-Pai/rootless-code-sandbox)",
    supported_languages: ["c", "cpp", "java", "python"],
    security: {
      rootless: true,
      filesystem_isolation: "Landlock LSM (Read-only host runtimes, Read-write /tmp/workspaces)",
      privilege_escalation: "PR_SET_NO_NEW_PRIVS Enforced",
      cpu_limit: "3 seconds hard limit (SIGKILL via RLIMIT_CPU)",
      ram_limit: "512 MB AS limit (4096 MB virtual / 256 MB heap for OpenJDK HotSpot)",
    },
  });
}
