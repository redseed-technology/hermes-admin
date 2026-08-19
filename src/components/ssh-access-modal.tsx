"use client";

import { useEffect, useRef, useState } from "react";
import type { IDisposable, Terminal as XtermTerminal } from "@xterm/xterm";
import { session } from "@/lib/api";
import type { WorkerNode } from "@/types";

type SshAccessModalProps = {
  node: WorkerNode;
  onClose: () => void;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const TERMINAL_WS_URL =
  process.env.NEXT_PUBLIC_TERMINAL_WS_URL ?? "ws://127.0.0.1:4001/terminal";

const statusLabels: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Connection failed",
};

export function SshAccessModal({ node, onClose }: SshAccessModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [message, setMessage] = useState("Opening a secure SSH session from this Mac...");

  useEffect(() => {
    let disposed = false;
    let terminal: XtermTerminal | null = null;
    let socket: WebSocket | null = null;
    let terminalInput: IDisposable | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let reportedError = false;

    async function connect() {
      const token = session.get();
      if (!token) {
        setStatus("error");
        setMessage("Your portal session has expired. Log in again.");
        return;
      }

      try {
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
        ]);
        if (disposed || !containerRef.current) return;

        terminal = new Terminal({
          cursorBlink: true,
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontSize: 13,
          lineHeight: 1.25,
          scrollback: 5000,
          theme: {
            background: "#0d1713",
            foreground: "#dce8df",
            cursor: "#d8ff5f",
            selectionBackground: "#385044",
          },
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(containerRef.current);
        fitAddon.fit();
        terminal.writeln("\x1b[38;2;216;255;95mConnecting to the Hermes worker...\x1b[0m");

        resizeObserver = new ResizeObserver(() => fitAddon.fit());
        resizeObserver.observe(containerRef.current);

        socket = new WebSocket(TERMINAL_WS_URL);
        socket.binaryType = "arraybuffer";
        socket.onopen = () => {
          socket?.send(JSON.stringify({ type: "AUTH", token, nodeId: node.id }));
        };
        socket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            terminal?.write(new Uint8Array(event.data));
            return;
          }

          try {
            const control = JSON.parse(String(event.data));
            if (control.type === "READY") {
              setStatus("connected");
              setMessage(`Root SSH session to ${node.publicIpv4}`);
              terminal?.writeln(
                "\r\n\x1b[32mConnected. Closing this window ends the session.\x1b[0m\r\n",
              );
              terminal?.focus();
              terminalInput =
                terminal?.onData((data) => {
                  if (socket?.readyState === WebSocket.OPEN) socket.send(data);
                }) ?? null;
            } else if (control.type === "ERROR") {
              reportedError = true;
              setStatus("error");
              setMessage(control.message ?? "The SSH session could not be opened.");
              terminal?.writeln(`\r\n\x1b[31m${control.message}\x1b[0m`);
            } else if (control.type === "EXIT") {
              setStatus("disconnected");
              setMessage(`SSH session ended with code ${control.code ?? "unknown"}.`);
            }
          } catch {
            reportedError = true;
            setStatus("error");
            setMessage("The terminal bridge returned an invalid message.");
          }
        };
        socket.onerror = () => {
          reportedError = true;
          setStatus("error");
          setMessage("The local terminal bridge is unavailable on port 4001.");
        };
        socket.onclose = () => {
          if (!disposed && !reportedError) {
            setStatus("disconnected");
            setMessage("The SSH session has ended.");
          }
        };
      } catch {
        if (!disposed) {
          setStatus("error");
          setMessage("The browser terminal could not be initialized.");
        }
      }
    }

    void connect();
    return () => {
      disposed = true;
      terminalInput?.dispose();
      resizeObserver?.disconnect();
      socket?.close(1000, "Terminal closed");
      terminal?.dispose();
    };
  }, [node.id, node.publicIpv4]);

  return (
    <dialog
      open
      className="modal modal-open bg-[#14231d]/60 p-4 backdrop-blur-sm"
      onCancel={onClose}
    >
      <div className="modal-box w-full max-w-5xl rounded-[1.75rem] border border-[#30433a] bg-[#14231d] p-0 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#d8ff5f]">
                Superadmin browser terminal
              </p>
              <span
                className={`badge border-0 text-xs ${
                  status === "connected"
                    ? "bg-[#dff6c6] text-[#426200]"
                    : status === "error"
                      ? "bg-[#ffe1e1] text-[#992f2f]"
                      : "bg-white/10 text-white"
                }`}
              >
                {status === "connecting" && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                {statusLabels[status]}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{node.name}</h2>
            <p aria-live="polite" className="mt-1 text-sm text-[#aabbb2]">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-circle btn-ghost btn-sm text-white hover:bg-white/10"
            aria-label="Close browser terminal"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div
            ref={containerRef}
            className="h-[58vh] min-h-96 overflow-hidden rounded-xl bg-[#0d1713] p-3"
            aria-label={`Root terminal for ${node.name}`}
          />
          <p className="mt-4 text-xs leading-5 text-[#9db0a6]">
            This localhost-only bridge validates your superadmin session, then uses the SSH key on
            this Mac. The private key is never sent to the browser or control plane. The session
            closes automatically after 30 minutes of inactivity.
          </p>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
