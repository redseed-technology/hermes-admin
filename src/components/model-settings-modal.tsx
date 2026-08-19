"use client";

import { FormEvent, useState } from "react";
import type {
  AgentProfile,
  CodexProgress,
  ModelConfigurationInput,
  ModelProvider,
} from "@/types";

type ModelSettingsModalProps = {
  agent: AgentProfile;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ModelConfigurationInput) => Promise<void>;
  onConnectCodex: (onProgress: (progress: CodexProgress | null) => void) => Promise<string[]>;
};

const providers: { value: ModelProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "openai-codex", label: "OpenAI Codex (ChatGPT subscription)" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "gemini", label: "Google Gemini" },
  { value: "custom", label: "Custom OpenAI-compatible endpoint" },
];

export function ModelSettingsModal({
  agent,
  saving,
  onClose,
  onSave,
  onConnectCodex,
}: ModelSettingsModalProps) {
  const [provider, setProvider] = useState<ModelProvider>(agent.modelProvider ?? "openai");
  const [model, setModel] = useState(agent.modelName ?? "");
  const [baseUrl, setBaseUrl] = useState(agent.modelBaseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [codexModels, setCodexModels] = useState<string[]>([]);
  const [codexProgress, setCodexProgress] = useState<CodexProgress | null>(null);
  const [codexError, setCodexError] = useState("");
  const [connectingCodex, setConnectingCodex] = useState(false);
  const custom = provider === "custom";
  const codex = provider === "openai-codex";

  function handleProviderChange(nextProvider: ModelProvider) {
    setProvider(nextProvider);
    setModel(nextProvider === agent.modelProvider ? (agent.modelName ?? "") : "");
    setBaseUrl(nextProvider === agent.modelProvider ? (agent.modelBaseUrl ?? "") : "");
    setApiKey("");
    setCodexModels([]);
    setCodexProgress(null);
    setCodexError("");
  }

  async function handleCodexConnection() {
    setConnectingCodex(true);
    setCodexError("");
    setCodexProgress({ stage: "checking" });
    try {
      const models = await onConnectCodex(setCodexProgress);
      if (models.length === 0) throw new Error("This Codex account did not return any models.");
      setCodexModels(models);
      setModel((current) => (models.includes(current) ? current : models[0]));
      setCodexProgress(null);
    } catch (error) {
      setCodexError(error instanceof Error ? error.message : "Codex connection failed.");
    } finally {
      setConnectingCodex(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      provider,
      model,
      baseUrl: custom ? baseUrl : "",
      apiKey: codex ? "" : apiKey,
    });
  }

  return (
    <dialog
      open
      className="modal modal-open bg-[#14231d]/50 p-4 backdrop-blur-sm"
      onCancel={onClose}
    >
      <div className="modal-box max-w-xl rounded-[1.75rem] border border-[#dfe5df] bg-white p-0 shadow-2xl">
        <div className="border-b border-[#e4e9e4] px-7 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#72860f]">
                AI model settings
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                Configure {agent.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#687a71]">
                Choose the inference provider and exact model this Hermes agent should use.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close AI model settings"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-7">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">AI provider</span>
            <select
              value={provider}
              onChange={(event) => handleProviderChange(event.target.value as ModelProvider)}
              className="select h-12 w-full rounded-xl border-[#ccd5ce] bg-white"
            >
              {providers.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {codex && (
            <div className="rounded-2xl border border-[#dce6d7] bg-[#f7f9f4] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Connect to Codex</p>
                  <p className="mt-1 text-xs leading-5 text-[#687a71]">
                    Sign in with ChatGPT, then choose from the models available to that Codex
                    account.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn shrink-0 rounded-xl border-[#b9c6ba] bg-white shadow-none"
                  onClick={handleCodexConnection}
                  disabled={connectingCodex}
                >
                  {connectingCodex && <span className="loading loading-spinner loading-sm" />}
                  {codexModels.length > 0 ? "Refresh models" : "Connect to Codex"}
                </button>
              </div>

              {codexProgress?.stage === "checking" && (
                <p className="mt-3 text-xs text-[#60736a]">Checking the agent&apos;s Codex session...</p>
              )}

              {codexProgress?.stage === "authorization_required" && (
                <div className="mt-4 rounded-xl border border-[#cfdbca] bg-white p-4">
                  <p className="text-sm font-semibold">Finish sign-in with OpenAI</p>
                  <p className="mt-2 text-sm text-[#60736a]">
                    Open the device page and enter this one-time code:
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <code className="rounded-lg bg-[#14231d] px-4 py-2 text-center text-base font-semibold tracking-[0.15em] text-[#d8ff5f]">
                      {codexProgress.userCode}
                    </code>
                    <a
                      href={codexProgress.verificationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn rounded-xl border-0 bg-[#14231d] text-white shadow-none hover:bg-[#254237]"
                    >
                      Open OpenAI sign-in
                    </a>
                  </div>
                </div>
              )}

              {codexModels.length > 0 && (
                <p className="mt-3 text-xs font-medium text-[#587019]">
                  Connected · {codexModels.length} model{codexModels.length === 1 ? "" : "s"}
                  available
                </p>
              )}

              {codexError && <p className="mt-3 text-sm text-[#b43737]">{codexError}</p>}
            </div>
          )}

          {codex ? (
            codexModels.length > 0 && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Codex model</span>
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="select h-12 w-full rounded-xl border-[#ccd5ce] bg-white"
                  required
                >
                  {codexModels.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
              </label>
            )
          ) : (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Model ID</span>
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="input h-12 w-full rounded-xl border-[#ccd5ce] bg-white"
                placeholder="Enter the exact model ID from your provider"
                required
                maxLength={160}
                autoFocus
              />
            </label>
          )}

          {custom && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">HTTPS endpoint</span>
              <input
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="input h-12 w-full rounded-xl border-[#ccd5ce] bg-white"
                placeholder="https://models.example.com/v1"
                required
                maxLength={2048}
              />
              <span className="mt-2 block text-xs text-[#7a8c82]">
                Use an OpenAI-compatible endpoint. HTTPS is required.
              </span>
            </label>
          )}

          {!codex && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                API token {custom && <span className="font-normal text-[#7a8c82]">(optional)</span>}
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="input h-12 w-full rounded-xl border-[#ccd5ce] bg-white"
                placeholder={custom ? "Leave blank if the endpoint needs no token" : "Paste your private token"}
                required={!custom}
                maxLength={8192}
                autoComplete="new-password"
                spellCheck={false}
              />
            </label>
          )}

          <div className="rounded-2xl border border-[#dce6d7] bg-[#f3f7ee] p-4 text-sm leading-6 text-[#52665c]">
            {codex
              ? "Hermes keeps a separate refreshable Codex session in this agent's private runtime volume. The portal stores only the selected model, never the OAuth tokens."
              : "Your token is sent over HTTPS and stored only in this agent's private runtime file. The portal database and command history never store or return it."}
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn rounded-xl border-[#ccd5ce] bg-white shadow-none"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn rounded-xl border-0 bg-[#14231d] px-7 text-white shadow-none hover:bg-[#254237]"
              disabled={saving || connectingCodex || (codex && codexModels.length === 0)}
            >
              {saving && <span className="loading loading-spinner loading-sm" />}
              {agent.modelStatus === "configured" ? "Update AI model" : "Configure AI model"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
