export type User = {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "user";
};

export type AgentPersonality = "Professional" | "Friendly" | "Concise" | "Creative";
export type ModelProvider =
  | "openai"
  | "openai-codex"
  | "anthropic"
  | "openrouter"
  | "gemini"
  | "custom";
export type ModelStatus = "unconfigured" | "configuring" | "configured" | "failed";
export type ChannelStatus =
  | "not_configured"
  | "configuring"
  | "awaiting_message"
  | "pairing"
  | "configured"
  | "failed";

export type AgentUsage = {
  sessions: number;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  lastActiveAt: string | null;
  models: {
    model: string;
    sessions: number;
    apiCalls: number;
    inputTokens: number;
    outputTokens: number;
  }[];
};

export type AgentProfile = {
  id: string;
  ownerId: string;
  name: string;
  purpose: string;
  personality: AgentPersonality;
  capabilities: string;
  responsibilities: string;
  workflow: string;
  status: "draft" | "active";
  runtimeType: "SHARED_CONTAINER";
  deploymentStatus: "not_deployed" | "deploying" | "setup_required" | "deployed" | "failed";
  containerId: string | null;
  containerName: string | null;
  nodeId: string | null;
  deploymentError: string | null;
  modelProvider: ModelProvider | null;
  modelName: string | null;
  modelBaseUrl: string | null;
  modelStatus: ModelStatus;
  modelConfigurationError: string | null;
  telegramChannelStatus: ChannelStatus;
  telegramBotUsername: string | null;
  telegramChannelError: string | null;
  whatsappChannelStatus: ChannelStatus;
  whatsappMode: "bot" | "self-chat" | null;
  whatsappAccountName: string | null;
  whatsappAccountLabel: string | null;
  whatsappChannelError: string | null;
  instructionsStatus: "pending" | "syncing" | "synced";
  instructionsError: string | null;
  runtimeStatus: "unknown" | "checking" | "online" | "offline";
  containerStatus: string | null;
  containerHealth: string | null;
  runtimeStartedAt: string | null;
  lastRuntimeCheckAt: string | null;
  usageStatus: "not_collected" | "refreshing" | "collected" | "empty" | "failed";
  usage: AgentUsage | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentInput = Pick<
  AgentProfile,
  "name" | "purpose" | "personality" | "capabilities" | "responsibilities" | "workflow"
> & {
  ownerId?: string;
};

export type ModelConfigurationInput = {
  provider: ModelProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type CodexProgress =
  | { stage: "checking" }
  | {
      stage: "authorization_required";
      verificationUrl: string;
      userCode: string;
    };

export type CodexConnectionResult = {
  connected: boolean;
  models: string[];
};

export type TelegramProgress =
  | { stage: "verifying" | "restarting" }
  | {
      stage: "waiting_for_message" | "checking_message";
      botUsername: string;
    };

export type TelegramConnectionResult = {
  channel: "telegram";
  status: "awaiting_message" | "configured";
  botUsername: string | null;
};

export type WhatsAppProgress =
  | { stage: "installing" | "connected" | "restarting" }
  | { stage: "starting"; expiresAt: string | null }
  | { stage: "qr"; qrPayload: string; expiresAt: string | null };

export type WhatsAppConnectionResult = {
  channel: "whatsapp";
  status: "configured" | "failed";
  mode: "bot" | "self-chat";
  accountName: string | null;
  accountLabel: string | null;
};

export type WorkerCommand = {
  id: string;
  status:
    | "QUEUED"
    | "SENT"
    | "ACKNOWLEDGED"
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "TIMED_OUT";
  progress: CodexProgress | TelegramProgress | WhatsAppProgress | null;
  result: CodexConnectionResult | TelegramConnectionResult | WhatsAppConnectionResult | null;
  error: string | null;
};

export type DropletPlan = {
  slug: string;
  vcpus: number;
  memoryMb: number;
  diskGb: number;
  transferTb: number;
  priceMonthlyUsd: number;
  priceHourlyUsd: number;
};

export type DigitalOceanConfiguration = {
  provider: "digitalocean";
  configured: boolean;
  missing: string[];
  connectionError: string | null;
  region: string;
  size: string;
  image: string;
  plan: DropletPlan | null;
};

export type WorkerNode = {
  id: string;
  ownerId: string;
  name: string;
  provider: "digitalocean";
  providerInstanceId: string | null;
  providerStatus: string | null;
  region: string;
  size: string;
  image: string;
  status: "provisioning" | "active" | "off" | "failed";
  connectionStatus: "online" | "offline";
  publicIpv4: string | null;
  hostAgentVersion?: string;
  runtime?: { dockerAvailable?: boolean; version?: string } | null;
  lastSeenAt: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
