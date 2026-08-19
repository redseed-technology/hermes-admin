"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentModal } from "@/components/agent-modal";
import { ChannelSettingsModal } from "@/components/channel-settings-modal";
import { ModelSettingsModal } from "@/components/model-settings-modal";
import { SshAccessModal } from "@/components/ssh-access-modal";
import { apiRequest, ApiError, errorMessage, session } from "@/lib/api";
import type {
  AgentInput,
  AgentProfile,
  CodexConnectionResult,
  CodexProgress,
  DigitalOceanConfiguration,
  ModelConfigurationInput,
  ModelStatus,
  TelegramConnectionResult,
  TelegramProgress,
  User,
  WhatsAppConnectionResult,
  WhatsAppProgress,
  WorkerCommand,
  WorkerNode,
} from "@/types";

const terminalCommandStatuses = new Set(["SUCCEEDED", "FAILED", "TIMED_OUT"]);
const numberFormatter = new Intl.NumberFormat("en-US");

const deploymentLabels: Record<AgentProfile["deploymentStatus"], string> = {
  not_deployed: "Not deployed",
  deploying: "Deploying",
  setup_required: "Setup required",
  deployed: "Deployed",
  failed: "Failed",
};

const modelStatusLabels: Record<ModelStatus, string> = {
  unconfigured: "Not configured",
  configuring: "Configuring",
  configured: "Configured",
  failed: "Needs attention",
};

function isCodexResult(
  result: WorkerCommand["result"],
): result is CodexConnectionResult {
  return Boolean(result && "connected" in result);
}

function isTelegramProgress(progress: WorkerCommand["progress"]): progress is TelegramProgress {
  return Boolean(
    progress &&
      ["verifying", "waiting_for_message", "checking_message", "restarting"].includes(
        progress.stage,
      ),
  );
}

function isWhatsAppProgress(progress: WorkerCommand["progress"]): progress is WhatsAppProgress {
  return Boolean(
    progress &&
      ["installing", "starting", "qr", "connected", "restarting"].includes(progress.stage),
  );
}

function isTelegramResult(
  result: WorkerCommand["result"],
): result is TelegramConnectionResult {
  return Boolean(result && "channel" in result && result.channel === "telegram");
}

function isWhatsAppResult(
  result: WorkerCommand["result"],
): result is WhatsAppConnectionResult {
  return Boolean(result && "channel" in result && result.channel === "whatsapp");
}

function deploymentButtonLabel(agent: AgentProfile) {
  if (agent.deploymentStatus === "deploying") return "Deploying...";
  if (agent.deploymentStatus === "setup_required") return "Container ready";
  if (agent.deploymentStatus === "failed") return "Retry deploy";
  if (agent.deploymentStatus === "deployed") return "Deployed";
  return "Deploy agent";
}

function formatTokens(value: number) {
  return numberFormatter.format(value);
}

function isDropletOnline(node: WorkerNode) {
  return (
    node.status === "active" &&
    node.connectionStatus === "online" &&
    node.runtime?.dockerAvailable !== false
  );
}

async function pollWorkerCommand(
  command: WorkerCommand,
  token: string,
  onProgress: (progress: WorkerCommand["progress"]) => void = () => {},
) {
  while (!terminalCommandStatuses.has(command.status)) {
    onProgress(command.progress);
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    ({ command } = await apiRequest<{ command: WorkerCommand }>(
      `/api/commands/${command.id}`,
      {},
      token,
    ));
  }
  onProgress(command.progress);
  if (command.status !== "SUCCEEDED") {
    throw new Error(command.error ?? "Hermes could not finish the command.");
  }
  return command;
}

async function inspectAgent(agentId: string, token: string) {
  const { command } = await apiRequest<{ command: WorkerCommand }>(
    `/api/agents/${agentId}/inspect`,
    { method: "POST" },
    token,
  );
  await pollWorkerCommand(command, token);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [nodes, setNodes] = useState<WorkerNode[]>([]);
  const [infrastructure, setInfrastructure] = useState<DigitalOceanConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [refreshingNodeId, setRefreshingNodeId] = useState<string | null>(null);
  const [deployingAgentId, setDeployingAgentId] = useState<string | null>(null);
  const [modelAgent, setModelAgent] = useState<AgentProfile | null>(null);
  const [channelAgent, setChannelAgent] = useState<AgentProfile | null>(null);
  const [sshNode, setSshNode] = useState<WorkerNode | null>(null);
  const [configuringModelId, setConfiguringModelId] = useState<string | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState("all");
  const [refreshingMonitoring, setRefreshingMonitoring] = useState(false);
  const [error, setError] = useState("");
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null | undefined>(undefined);
  const isSuperadmin = user?.role === "superadmin";
  const deployedAgentIds = agents
    .filter((agent) => agent.containerId && agent.nodeId)
    .map((agent) => agent.id)
    .sort()
    .join(",");

  useEffect(() => {
    const token = session.get();
    if (!token) {
      router.replace("/login");
      return;
    }

    let active = true;
    const loadDashboard = async () => {
      try {
        const [profileResponse, agentResponse, nodeResponse, infrastructureResponse] =
          await Promise.all([
            apiRequest<{ user: User }>("/api/auth/me", {}, token),
            apiRequest<{ agents: AgentProfile[] }>("/api/agents", {}, token),
            apiRequest<{ nodes: WorkerNode[] }>("/api/nodes", {}, token),
            apiRequest<DigitalOceanConfiguration>(
              "/api/infrastructure/digitalocean",
              {},
              token,
            ),
          ]);
        const accountResponse =
          profileResponse.user.role === "superadmin"
            ? await apiRequest<{ users: User[] }>("/api/users", {}, token)
            : { users: [] };
        if (!active) return;
        setUser(profileResponse.user);
        setAgents(agentResponse.agents);
        setNodes(nodeResponse.nodes);
        setInfrastructure(infrastructureResponse);
        setAccounts(accountResponse.users);
      } catch (requestError) {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          session.clear();
          router.replace("/login");
          return;
        }
        setError(errorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    let polling = false;

    const interval = window.setInterval(async () => {
      if (polling) return;
      const token = session.get();
      if (!token) return;
      polling = true;
      try {
        const [agentResponse, nodeResponse, accountResponse] = await Promise.all([
          apiRequest<{ agents: AgentProfile[] }>("/api/agents", {}, token),
          apiRequest<{ nodes: WorkerNode[] }>("/api/nodes", {}, token),
          user.role === "superadmin"
            ? apiRequest<{ users: User[] }>("/api/users", {}, token)
            : Promise.resolve({ users: [] }),
        ]);
        if (!active) return;
        setAgents(agentResponse.agents);
        setNodes(nodeResponse.nodes);
        setAccounts(accountResponse.users);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          session.clear();
          router.replace("/login");
        }
      } finally {
        polling = false;
      }
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loading, router, user]);

  useEffect(() => {
    if (loading || !deployedAgentIds) return;
    let active = true;
    let refreshing = false;

    const refreshUsage = async () => {
      if (refreshing) return;
      const token = session.get();
      if (!token) return;
      refreshing = true;
      try {
        await Promise.allSettled(
          deployedAgentIds.split(",").map((agentId) => inspectAgent(agentId, token)),
        );
        const response = await apiRequest<{ agents: AgentProfile[] }>("/api/agents", {}, token);
        if (active) setAgents(response.agents);
      } catch {
        // Keep the last successful monitoring snapshot and retry on the next interval.
      } finally {
        refreshing = false;
      }
    };

    void refreshUsage();
    const interval = window.setInterval(() => void refreshUsage(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [deployedAgentIds, loading]);

  const provisioningNodeIds = nodes
    .filter((node) => node.status === "provisioning" && node.providerInstanceId)
    .map((node) => node.id)
    .join(",");

  useEffect(() => {
    if (!isSuperadmin || !provisioningNodeIds) return;
    let refreshing = false;

    const interval = window.setInterval(async () => {
      if (refreshing) return;
      refreshing = true;
      const token = session.get();
      if (!token) {
        refreshing = false;
        return;
      }

      try {
        const refreshedNodes = await Promise.all(
          provisioningNodeIds.split(",").map((nodeId) =>
            apiRequest<{ node: WorkerNode }>(
              `/api/nodes/${nodeId}/refresh`,
              { method: "POST" },
              token,
            ),
          ),
        );
        setNodes((current) =>
          current.map(
            (node) => refreshedNodes.find((item) => item.node.id === node.id)?.node ?? node,
          ),
        );
      } catch (requestError) {
        setError(errorMessage(requestError));
      } finally {
        refreshing = false;
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isSuperadmin, provisioningNodeIds]);

  const assignedAccountIds = new Set(agents.map((agent) => agent.ownerId));
  const availableAccounts = accounts.filter((account) => !assignedAccountIds.has(account.id));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const visibleAgents =
    isSuperadmin && projectOwnerId !== "all"
      ? agents.filter((agent) => agent.ownerId === projectOwnerId)
      : agents;
  const projectAccounts = accounts.filter((account) => assignedAccountIds.has(account.id));
  const hasOnlineWorker = nodes.some(
    (node) => node.status === "active" && node.connectionStatus === "online",
  );

  function logout() {
    session.clear();
    router.push("/login");
  }

  async function saveAgent(input: AgentInput) {
    if (!editingAgent && !isSuperadmin) {
      setError("Only a superadmin can create an agent.");
      return;
    }
    const token = session.get();
    if (!token) return logout();

    setSaving(true);
    setError("");
    try {
      const isEditing = Boolean(editingAgent);
      const response = await apiRequest<{ agent: AgentProfile }>(
        isEditing ? `/api/agents/${editingAgent?.id}` : "/api/agents",
        { method: isEditing ? "PUT" : "POST", body: JSON.stringify(input) },
        token,
      );

      setAgents((current) =>
        isEditing
          ? current.map((agent) => (agent.id === response.agent.id ? response.agent : agent))
          : [response.agent, ...current],
      );
      setEditingAgent(undefined);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent(agent: AgentProfile) {
    if (!isSuperadmin) {
      setError("Only a superadmin can delete an agent.");
      return;
    }
    if (!window.confirm(`Delete ${agent.name}? This cannot be undone.`)) return;
    const token = session.get();
    if (!token) return logout();

    setError("");
    try {
      await apiRequest<void>(`/api/agents/${agent.id}`, { method: "DELETE" }, token);
      setAgents((current) => current.filter((item) => item.id !== agent.id));
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function createWorker() {
    if (!isSuperadmin) {
      setError("Only a superadmin can create a worker VM.");
      return;
    }
    if (!infrastructure?.configured) {
      setError(
        infrastructure?.connectionError ??
          `Backend setup is missing: ${infrastructure?.missing.join(", ") || "DigitalOcean configuration"}.`,
      );
      return;
    }

    const plan = infrastructure.plan;
    const price = plan ? `US$${plan.priceMonthlyUsd}/month` : infrastructure.size;
    const confirmed = window.confirm(
      `Create a Hermes worker in ${infrastructure.region.toUpperCase()} for ${price}? DigitalOcean billing starts immediately.`,
    );
    if (!confirmed) return;

    const token = session.get();
    if (!token) return logout();
    setProvisioning(true);
    setError("");

    try {
      const response = await apiRequest<{ node: WorkerNode }>(
        "/api/nodes",
        { method: "POST", body: JSON.stringify({}) },
        token,
      );
      setNodes((current) => [response.node, ...current]);
    } catch (requestError) {
      setError(errorMessage(requestError));
      try {
        const response = await apiRequest<{ nodes: WorkerNode[] }>("/api/nodes", {}, token);
        setNodes(response.nodes);
      } catch {
        // Keep the original provisioning error visible.
      }
    } finally {
      setProvisioning(false);
    }
  }

  async function refreshWorker(node: WorkerNode) {
    if (!isSuperadmin) {
      setError("Only a superadmin can refresh worker VMs.");
      return;
    }
    const token = session.get();
    if (!token) return logout();
    setRefreshingNodeId(node.id);
    setError("");

    try {
      const response = await apiRequest<{ node: WorkerNode }>(
        `/api/nodes/${node.id}/refresh`,
        { method: "POST" },
        token,
      );
      setNodes((current) =>
        current.map((item) => (item.id === response.node.id ? response.node : item)),
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRefreshingNodeId(null);
    }
  }

  async function refreshMonitoring() {
    const token = session.get();
    if (!token) return logout();
    setRefreshingMonitoring(true);
    setError("");
    try {
      const candidates = agents.filter((agent) => agent.containerId && agent.nodeId);
      await Promise.allSettled(candidates.map((agent) => inspectAgent(agent.id, token)));
      const [agentResponse, nodeResponse] = await Promise.all([
        apiRequest<{ agents: AgentProfile[] }>("/api/agents", {}, token),
        apiRequest<{ nodes: WorkerNode[] }>("/api/nodes", {}, token),
      ]);
      setAgents(agentResponse.agents);
      setNodes(nodeResponse.nodes);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRefreshingMonitoring(false);
    }
  }

  async function deployAgent(agent: AgentProfile) {
    if (!isSuperadmin) {
      setError("Only a superadmin can deploy an agent.");
      return;
    }
    if (!hasOnlineWorker) {
      setError("No worker Host Agent is online over WSS yet.");
      return;
    }

    if (
      agent.deploymentStatus === "not_deployed" &&
      !window.confirm(
        `Deploy ${agent.name} to the online worker? This pulls the official Hermes image and reserves up to 1 GB RAM.`,
      )
    ) {
      return;
    }

    const token = session.get();
    if (!token) return logout();
    setDeployingAgentId(agent.id);
    setError("");

    try {
      const response = await apiRequest<{ agent: AgentProfile }>(
        `/api/agents/${agent.id}/deploy`,
        { method: "POST" },
        token,
      );
      setAgents((current) =>
        current.map((item) => (item.id === response.agent.id ? response.agent : item)),
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setDeployingAgentId(null);
    }
  }

  async function configureModel(input: ModelConfigurationInput) {
    if (!modelAgent) return;
    const token = session.get();
    if (!token) return logout();

    setConfiguringModelId(modelAgent.id);
    setError("");
    try {
      const response = await apiRequest<{ agent: AgentProfile }>(
        `/api/agents/${modelAgent.id}/model`,
        { method: "POST", body: JSON.stringify(input) },
        token,
      );
      setAgents((current) =>
        current.map((agent) => (agent.id === response.agent.id ? response.agent : agent)),
      );
      setModelAgent(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setConfiguringModelId(null);
    }
  }

  async function refreshAgents(token: string) {
    const response = await apiRequest<{ agents: AgentProfile[] }>("/api/agents", {}, token);
    setAgents(response.agents);
    if (channelAgent) {
      setChannelAgent(response.agents.find((agent) => agent.id === channelAgent.id) ?? null);
    }
  }

  async function connectCodex(
    onProgress: (progress: CodexProgress | null) => void,
  ): Promise<string[]> {
    if (!modelAgent) throw new Error("Choose a Hermes agent first.");
    const token = session.get();
    if (!token) {
      logout();
      throw new Error("Your session has expired.");
    }

    const response = await apiRequest<{ command: WorkerCommand }>(
      `/api/agents/${modelAgent.id}/codex`,
      { method: "POST" },
      token,
    );
    const command = await pollWorkerCommand(response.command, token, (progress) =>
      onProgress(progress?.stage === "checking" || progress?.stage === "authorization_required" ? progress : null),
    );
    if (!isCodexResult(command.result) || !command.result.connected) {
      throw new Error(command.error ?? "Codex connection failed.");
    }
    return command.result.models;
  }

  async function connectTelegram(
    botFatherText: string,
    onProgress: (progress: TelegramProgress | null) => void,
  ): Promise<TelegramConnectionResult> {
    if (!channelAgent) throw new Error("Choose a Hermes agent first.");
    const token = session.get();
    if (!token) {
      logout();
      throw new Error("Your session has expired.");
    }
    const response = await apiRequest<{ agent: AgentProfile; command: WorkerCommand }>(
      `/api/agents/${channelAgent.id}/channels/telegram`,
      { method: "POST", body: JSON.stringify({ botFatherText }) },
      token,
    );
    setAgents((current) =>
      current.map((agent) => (agent.id === response.agent.id ? response.agent : agent)),
    );
    const command = await pollWorkerCommand(response.command, token, (progress) =>
      onProgress(isTelegramProgress(progress) ? progress : null),
    );
    await refreshAgents(token);
    if (!isTelegramResult(command.result)) throw new Error("Telegram setup returned no result.");
    return command.result;
  }

  async function pairTelegram(
    onProgress: (progress: TelegramProgress | null) => void,
  ): Promise<TelegramConnectionResult> {
    if (!channelAgent) throw new Error("Choose a Hermes agent first.");
    const token = session.get();
    if (!token) {
      logout();
      throw new Error("Your session has expired.");
    }
    const response = await apiRequest<{ agent: AgentProfile; command: WorkerCommand }>(
      `/api/agents/${channelAgent.id}/channels/telegram/pair`,
      { method: "POST" },
      token,
    );
    const command = await pollWorkerCommand(response.command, token, (progress) =>
      onProgress(isTelegramProgress(progress) ? progress : null),
    );
    await refreshAgents(token);
    if (!isTelegramResult(command.result)) throw new Error("Telegram pairing returned no result.");
    return command.result;
  }

  async function connectWhatsApp(
    input: { mode: "bot" | "self-chat"; allowedUsers: string },
    onProgress: (progress: WhatsAppProgress | null) => void,
  ): Promise<WhatsAppConnectionResult> {
    if (!channelAgent) throw new Error("Choose a Hermes agent first.");
    const token = session.get();
    if (!token) {
      logout();
      throw new Error("Your session has expired.");
    }
    const response = await apiRequest<{ agent: AgentProfile; command: WorkerCommand }>(
      `/api/agents/${channelAgent.id}/channels/whatsapp`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    );
    setAgents((current) =>
      current.map((agent) => (agent.id === response.agent.id ? response.agent : agent)),
    );
    const command = await pollWorkerCommand(response.command, token, (progress) =>
      onProgress(isWhatsAppProgress(progress) ? progress : null),
    );
    await refreshAgents(token);
    if (!isWhatsAppResult(command.result)) throw new Error("WhatsApp setup returned no result.");
    return command.result;
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5f0]">
        <div className="flex items-center gap-3 text-[#4f655b]">
          <span className="loading loading-spinner text-[#6e8e00]" /> Loading workspace...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f0] text-[#14231d]">
      <header className="sticky top-0 z-20 border-b border-[#dce3dc] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 font-semibold tracking-[-0.02em]">
            <span className="grid size-9 place-items-center rounded-xl bg-[#14231d] text-sm font-bold text-[#d8ff5f]">H</span>
            <span className="hidden sm:inline">Hermes Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">
                {user?.name}
                {isSuperadmin && (
                  <span className="ml-2 rounded-full bg-[#e9f6d5] px-2 py-1 text-[10px] uppercase tracking-wide text-[#587500]">
                    Superadmin
                  </span>
                )}
              </p>
              <p className="text-xs text-[#7a8c83]">{user?.email}</p>
            </div>
            <div className="dropdown dropdown-end">
              <button tabIndex={0} className="btn btn-circle border-0 bg-[#e8eddf] text-[#32483e] shadow-none" aria-label="Open account menu">
                {user?.name.charAt(0).toUpperCase()}
              </button>
              <ul tabIndex={0} className="menu dropdown-content z-30 mt-3 w-44 rounded-2xl border border-[#e0e5df] bg-white p-2 shadow-xl">
                <li><button onClick={logout}>Log out</button></li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="badge rounded-full border-[#ced8ca] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#617414]">DigitalOcean control plane</div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your Hermes agents</h1>
            <p className="mt-3 max-w-xl text-lg text-[#687b72]">Create shared worker capacity and prepare each agent for isolated container deployment.</p>
          </div>
          {isSuperadmin ? (
            <button
              onClick={() => setEditingAgent(null)}
              className="btn h-12 rounded-full border-0 bg-[#14231d] px-6 text-white shadow-none hover:bg-[#254237]"
              disabled={availableAccounts.length === 0}
              title={
                availableAccounts.length === 0
                  ? "Every account already has its one allowed agent"
                  : undefined
              }
            >
              <span className="text-xl font-light">＋</span> New agent
            </button>
          ) : (
            <span className="rounded-full border border-[#d6ded6] bg-white px-5 py-3 text-sm text-[#66786f]">
              Creation is managed by a superadmin
            </span>
          )}
        </section>

        {isSuperadmin && (
          <section className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border border-[#dce3dc] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Active project</p>
              <p className="mt-1 text-xs text-[#71847a]">
                Switch between account-owned agents or monitor every project together.
              </p>
            </div>
            <select
              value={projectOwnerId}
              onChange={(event) => setProjectOwnerId(event.target.value)}
              className="select h-11 w-full rounded-xl border-[#ccd5ce] bg-white sm:w-80"
              aria-label="Select project account"
            >
              <option value="all">All projects · {agents.length} agents</option>
              {projectAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.email}
                </option>
              ))}
            </select>
          </section>
        )}

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="stats border border-[#dce3dc] bg-white shadow-none">
            <div className="stat"><div className="stat-title text-[#71847a]">Visible agents</div><div className="stat-value text-3xl text-[#14231d]">{visibleAgents.length}</div><div className="stat-desc mt-1">{projectOwnerId === "all" ? "Across all projects" : "In the selected project"}</div></div>
          </div>
          <div className="stats border border-[#dce3dc] bg-white shadow-none">
            <div className="stat"><div className="stat-title text-[#71847a]">Worker droplets</div><div className="stat-value text-3xl text-[#14231d]">{nodes.filter((node) => node.status === "active").length}<span className="text-base font-medium text-[#89968f]"> / {nodes.length}</span></div><div className="stat-desc mt-1">Active in DigitalOcean</div></div>
          </div>
          <div className="stats border border-[#dce3dc] bg-white shadow-none">
            <div className="stat"><div className="stat-title text-[#71847a]">Droplets online</div><div className={`stat-value text-3xl ${nodes.some(isDropletOnline) ? "text-[#668400]" : "text-[#a36b24]"}`}>{nodes.filter(isDropletOnline).length}<span className="text-base font-medium text-[#89968f]"> / {nodes.length}</span></div><div className="stat-desc mt-1">Live Host Agent and Docker heartbeat</div></div>
          </div>
        </section>

        {error && (
          <div role="alert" className="alert alert-error mt-8 rounded-2xl">
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <section className="mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71830e]">Infrastructure</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Worker droplets</h2>
              <p className="mt-2 text-[#6b7d74]">Each worker can host multiple isolated Hermes containers.</p>
            </div>
            {isSuperadmin ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={refreshMonitoring}
                  className="btn h-11 rounded-full border-[#ccd5ce] bg-white px-5 shadow-none"
                  disabled={refreshingMonitoring}
                >
                  {refreshingMonitoring && <span className="loading loading-spinner loading-sm" />}
                  Refresh monitoring
                </button>
                <button
                  onClick={createWorker}
                  className="btn h-11 rounded-full border-0 bg-[#d8ff5f] px-6 text-[#14231d] shadow-none hover:bg-[#c9f044]"
                  disabled={provisioning || !infrastructure?.configured}
                  title={!infrastructure?.configured ? "Complete the backend DigitalOcean setup first" : undefined}
                >
                  {provisioning && <span className="loading loading-spinner loading-sm" />}
                  {provisioning ? "Creating droplet..." : "Create droplet"}
                </button>
              </div>
            ) : (
              <span className="text-sm text-[#74857c]">Superadmin only</span>
            )}
          </div>

          {infrastructure && (
            <div className={`mt-5 rounded-2xl border p-4 text-sm ${infrastructure.configured ? "border-[#d8e2d3] bg-white" : "border-[#ead7b9] bg-[#fffaf1]"}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">
                  {infrastructure.region.toUpperCase()} · {infrastructure.plan ? `${infrastructure.plan.vcpus} vCPU · ${infrastructure.plan.memoryMb / 1024} GB RAM · ${infrastructure.plan.diskGb} GB disk` : infrastructure.size}
                </span>
                <span className="text-[#697a71]">
                  {infrastructure.plan ? `US$${infrastructure.plan.priceMonthlyUsd}/month` : infrastructure.image}
                </span>
              </div>
              {!infrastructure.configured && (
                <p className="mt-2 text-[#8b5d22]">
                  {infrastructure.connectionError ?? `Backend setup is missing: ${infrastructure.missing.join(", ")}.`}
                </p>
              )}
            </div>
          )}

          {nodes.length === 0 ? (
            <div className="mt-5 rounded-[1.6rem] border border-dashed border-[#bfcbbf] bg-white px-6 py-10 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e9f0d2] font-bold text-[#5e7800]">DO</div>
              <h3 className="mt-4 text-lg font-semibold">No worker droplets yet</h3>
              <p className="mt-2 text-sm text-[#6c7e75]">Creating one installs Docker, enables key-only SSH, and blocks other inbound ports.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {nodes.map((node) => (
                <article key={node.id} className="rounded-[1.4rem] border border-[#dbe2db] bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{node.name}</h3>
                      <p className="mt-1 text-xs text-[#7a8c82]">DigitalOcean #{node.providerInstanceId ?? "pending"}</p>
                    </div>
                    <span className={`badge border-0 text-xs capitalize ${isDropletOnline(node) ? "bg-[#e9f6d5] text-[#4e6d00]" : node.status === "failed" ? "bg-[#fff0f0] text-[#a33b3b]" : "bg-[#fff4d6] text-[#8b6500]"}`}>
                      {node.status === "provisioning" && <span className="loading loading-spinner loading-xs" />}
                      {node.status === "provisioning"
                        ? "Provisioning"
                        : isDropletOnline(node)
                          ? "Online"
                          : "Offline"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-[#f5f7f3] p-3"><span className="block text-[#849188]">Region</span><strong className="mt-1 block uppercase">{node.region}</strong></div>
                    <div className="rounded-xl bg-[#f5f7f3] p-3"><span className="block text-[#849188]">Plan</span><strong className="mt-1 block">{node.size}</strong></div>
                  </div>
                  <div className="mt-2 rounded-xl bg-[#f5f7f3] p-3 text-xs">
                    <span className="block text-[#849188]">Public IPv4</span>
                    <strong className="mt-1 block font-mono font-semibold">{node.publicIpv4 ?? "Waiting for address"}</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-[#f5f7f3] p-3 text-xs">
                    <span className="text-[#849188]">Host Agent</span>
                    <strong
                      className={
                        node.connectionStatus === "online" ? "text-[#587500]" : "text-[#9a5d28]"
                      }
                    >
                      {node.connectionStatus === "online" ? "Online via WSS" : "Offline"}
                    </strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-[#f5f7f3] p-3 text-xs">
                    <span className="text-[#849188]">Docker runtime</span>
                    <strong className={node.runtime?.dockerAvailable === false ? "text-[#a33b3b]" : "text-[#587500]"}>
                      {node.runtime?.dockerAvailable === undefined
                        ? "Checking"
                        : node.runtime.dockerAvailable
                          ? "Available"
                          : "Unavailable"}
                    </strong>
                  </div>
                  {node.lastSeenAt && (
                    <p className="mt-3 text-xs text-[#7a8c82]">
                      Last heartbeat {new Date(node.lastSeenAt).toLocaleString()}
                    </p>
                  )}
                  {node.lastError && <p className="mt-3 text-sm text-[#a33b3b]">{node.lastError}</p>}
                  {isSuperadmin && (
                    <div className="mt-4 flex gap-2">
                      {node.status === "active" && node.publicIpv4 && (
                        <button
                          onClick={() => setSshNode(node)}
                          className="btn btn-sm flex-1 rounded-xl border-0 bg-[#14231d] text-white shadow-none hover:bg-[#254237]"
                        >
                          Browser terminal
                        </button>
                      )}
                      <button
                        onClick={() => refreshWorker(node)}
                        className="btn btn-sm flex-1 rounded-xl border-[#d4dbd4] bg-white shadow-none"
                        disabled={!node.providerInstanceId || refreshingNodeId === node.id}
                      >
                        {refreshingNodeId === node.id && (
                          <span className="loading loading-spinner loading-xs" />
                        )}
                        Refresh status
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71830e]">Agents</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Agent profiles</h2>
          </div>
          {visibleAgents.length === 0 ? (
            <div className="mt-5 rounded-[2rem] border border-dashed border-[#bfcbbf] bg-white px-6 py-16 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e9f0d2] text-2xl font-bold text-[#5e7800]">H</div>
              <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">
                {isSuperadmin ? "Create the first Hermes agent" : "No agent assigned yet"}
              </h2>
              <p className="mx-auto mt-3 max-w-md leading-7 text-[#6c7e75]">
                {isSuperadmin
                  ? "Choose an account, then define its one allowed agent profile."
                  : "A superadmin can create and assign one Hermes agent to this account."}
              </p>
              {isSuperadmin && availableAccounts.length > 0 && (
                <button onClick={() => setEditingAgent(null)} className="btn mt-7 rounded-full border-0 bg-[#d8ff5f] px-7 text-[#14231d] shadow-none hover:bg-[#c9f044]">Create an agent</button>
              )}
            </div>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleAgents.map((agent) => (
                <article key={agent.id} className="card rounded-[1.6rem] border border-[#dbe2db] bg-white shadow-none transition hover:-translate-y-1 hover:shadow-[0_20px_45px_-32px_rgba(20,35,29,0.45)]">
                  <div className="card-body p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-11 place-items-center rounded-2xl bg-[#d8ff5f] font-bold">{agent.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <h2 className="font-semibold">{agent.name}</h2>
                          <p className="mt-1 text-xs text-[#7a8c82]">{agent.personality}</p>
                          {isSuperadmin && (
                            <p className="mt-1 text-xs text-[#7a8c82]">
                              {accountById.get(agent.ownerId)?.email ?? agent.ownerId}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="badge border-[#d9e2d5] bg-[#f3f6ef] text-xs capitalize text-[#5f735f]">{agent.status}</span>
                    </div>
                    <p className="mt-4 min-h-20 leading-7 text-[#5e7268]">{agent.purpose}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-[#f5f7f3] p-3"><span className="block text-[#849188]">Runtime</span><strong className="mt-1 block font-semibold">Shared container</strong></div>
                      <div className="rounded-xl bg-[#f5f7f3] p-3"><span className="block text-[#849188]">Deployment</span><strong className="mt-1 block font-semibold">{deploymentLabels[agent.deploymentStatus]}</strong></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-[#f5f7f3] p-3 text-xs">
                      <span className="text-[#849188]">Configured model</span>
                      <strong className="text-right font-semibold">
                        {agent.modelName ?? modelStatusLabels[agent.modelStatus ?? "unconfigured"]}
                        {agent.modelStatus === "configuring" && (
                          <span className="loading loading-spinner loading-xs ml-2" />
                        )}
                      </strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-[#f5f7f3] p-3 text-xs">
                      <span className="text-[#849188]">Container status</span>
                      <strong
                        className={
                          agent.runtimeStatus === "online"
                            ? "text-[#587500]"
                            : agent.runtimeStatus === "offline"
                              ? "text-[#a33b3b]"
                              : "text-[#78691f]"
                        }
                      >
                        {agent.usageStatus === "refreshing" && (
                          <span className="loading loading-spinner loading-xs mr-2" />
                        )}
                        {agent.runtimeStatus === "online"
                          ? "Online"
                          : agent.runtimeStatus === "offline"
                            ? "Offline"
                            : agent.runtimeStatus === "checking"
                              ? "Checking"
                              : agent.containerId
                                ? "Not checked"
                                : "Not deployed"}
                      </strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-[#f5f7f3] p-3 text-xs">
                      <span className="text-[#849188]">Channels</span>
                      <strong className="text-right font-semibold">
                        {[
                          agent.telegramChannelStatus === "configured" ? "Telegram" : null,
                          agent.whatsappChannelStatus === "configured" ? "WhatsApp" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Not connected"}
                      </strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-[#f5f7f3] p-3 text-xs">
                      <span className="text-[#849188]">Agent instructions</span>
                      <strong
                        className={
                          agent.instructionsStatus === "synced"
                            ? "text-[#587500]"
                            : "text-[#8b6500]"
                        }
                      >
                        {agent.instructionsStatus === "syncing" && (
                          <span className="loading loading-spinner loading-xs mr-2" />
                        )}
                        {agent.instructionsStatus === "synced"
                          ? "Applied to Hermes"
                          : agent.instructionsStatus === "syncing"
                            ? "Applying"
                            : "Pending"}
                      </strong>
                    </div>
                    {agent.containerId && (
                      <div className="mt-3 rounded-2xl border border-[#dce6d7] bg-[#f7f9f4] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">Usage</p>
                          {agent.usage?.lastActiveAt && (
                            <span className="text-[10px] text-[#7a8c82]">
                              Active {new Date(agent.usage.lastActiveAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {agent.usage ? (
                          <>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="block text-[#849188]">Total tokens</span>
                                <strong className="mt-1 block text-sm">
                                  {formatTokens(agent.usage.inputTokens + agent.usage.outputTokens)}
                                </strong>
                              </div>
                              <div>
                                <span className="block text-[#849188]">Input</span>
                                <strong className="mt-1 block text-sm">
                                  {formatTokens(agent.usage.inputTokens)}
                                </strong>
                              </div>
                              <div>
                                <span className="block text-[#849188]">Output</span>
                                <strong className="mt-1 block text-sm">
                                  {formatTokens(agent.usage.outputTokens)}
                                </strong>
                              </div>
                            </div>
                            <div className="mt-3 border-t border-[#dfe5df] pt-3 text-xs leading-5 text-[#687a71]">
                              <p>
                                Model used: {agent.usage.models.map((item) => item.model).join(", ") || agent.modelName || "Unknown"}
                              </p>
                              <p>
                                {formatTokens(agent.usage.sessions)} sessions · {formatTokens(agent.usage.apiCalls)} model calls · {formatTokens(agent.usage.cacheReadTokens)} cached tokens
                              </p>
                            </div>
                          </>
                        ) : (
                          <p className="mt-2 text-xs leading-5 text-[#71847a]">
                            {agent.usageStatus === "refreshing"
                              ? "Reading the Hermes session database..."
                              : "No recorded model usage yet."}
                          </p>
                        )}
                      </div>
                    )}
                    {agent.deploymentStatus === "setup_required" && (
                      <p className="mt-3 rounded-xl bg-[#fff8df] p-3 text-xs leading-5 text-[#765b0a]">
                        The Hermes container is ready. Select <strong>Configure AI</strong>, choose
                        your model, and enter your provider token. Nous Portal is not required.
                      </p>
                    )}
                    {agent.deploymentError && (
                      <p className="mt-3 text-xs leading-5 text-[#a33b3b]">{agent.deploymentError}</p>
                    )}
                    {agent.modelConfigurationError && (
                      <p className="mt-3 text-xs leading-5 text-[#a33b3b]">
                        {agent.modelConfigurationError}
                      </p>
                    )}
                    {agent.instructionsError && (
                      <p className="mt-3 text-xs leading-5 text-[#a33b3b]">
                        {agent.instructionsError}
                      </p>
                    )}
                    <div className="card-actions mt-4 flex flex-wrap">
                      {agent.containerId && agent.nodeId && (
                        <button
                          onClick={() => setChannelAgent(agent)}
                          className="btn btn-sm flex-1 rounded-xl border-[#d4dbd4] bg-white shadow-none"
                        >
                          Channels
                        </button>
                      )}
                      {agent.containerId && agent.nodeId && (
                        <button
                          onClick={() => setModelAgent(agent)}
                          className="btn btn-sm flex-1 rounded-xl border-0 bg-[#d8ff5f] text-[#14231d] shadow-none hover:bg-[#c9f044]"
                          disabled={
                            agent.modelStatus === "configuring" ||
                            configuringModelId === agent.id
                          }
                        >
                          {(agent.modelStatus === "configuring" ||
                            configuringModelId === agent.id) && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          {agent.modelStatus === "configured" ? "Change AI model" : "Configure AI"}
                        </button>
                      )}
                      {isSuperadmin && (
                        <button
                          onClick={() => deployAgent(agent)}
                          className="btn btn-sm flex-1 rounded-xl border-[#d4dbd4] bg-white shadow-none"
                          disabled={
                            agent.deploymentStatus === "deploying" ||
                            agent.deploymentStatus === "setup_required" ||
                            agent.deploymentStatus === "deployed" ||
                            deployingAgentId === agent.id ||
                            !hasOnlineWorker
                          }
                          title={
                            hasOnlineWorker
                              ? undefined
                              : "Wait for a worker Host Agent to connect over WSS"
                          }
                        >
                          {(agent.deploymentStatus === "deploying" ||
                            deployingAgentId === agent.id) && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          {deploymentButtonLabel(agent)}
                        </button>
                      )}
                      <button onClick={() => setEditingAgent(agent)} className="btn btn-sm rounded-xl border-[#d4dbd4] bg-white shadow-none">Edit instructions</button>
                      {isSuperadmin && (
                        <button onClick={() => deleteAgent(agent)} className="btn btn-sm rounded-xl border-[#f0d5d5] bg-[#fff8f8] text-[#a33b3b] shadow-none">Delete</button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {editingAgent !== undefined && (
        <AgentModal
          key={editingAgent?.id ?? "new-agent"}
          agent={editingAgent ?? undefined}
          accounts={availableAccounts}
          saving={saving}
          onClose={() => setEditingAgent(undefined)}
          onSave={saveAgent}
        />
      )}
      {modelAgent && (
        <ModelSettingsModal
          key={modelAgent.id}
          agent={modelAgent}
          saving={configuringModelId === modelAgent.id}
          onClose={() => setModelAgent(null)}
          onSave={configureModel}
          onConnectCodex={connectCodex}
        />
      )}
      {channelAgent && (
        <ChannelSettingsModal
          key={channelAgent.id}
          agent={channelAgent}
          onClose={() => setChannelAgent(null)}
          onConnectTelegram={connectTelegram}
          onPairTelegram={pairTelegram}
          onConnectWhatsApp={connectWhatsApp}
        />
      )}
      {isSuperadmin && sshNode && (
        <SshAccessModal
          key={sshNode.id}
          node={sshNode}
          onClose={() => setSshNode(null)}
        />
      )}
    </main>
  );
}
