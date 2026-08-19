"use client";

import { FormEvent, useState } from "react";
import type { AgentInput, AgentPersonality, AgentProfile, User } from "@/types";

type AgentModalProps = {
  agent?: AgentProfile;
  accounts: User[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: AgentInput) => Promise<void>;
};

const personalities: AgentPersonality[] = ["Professional", "Friendly", "Concise", "Creative"];

export function AgentModal({ agent, accounts, saving, onClose, onSave }: AgentModalProps) {
  const [name, setName] = useState(agent?.name ?? "");
  const [purpose, setPurpose] = useState(agent?.purpose ?? "");
  const [personality, setPersonality] = useState<AgentPersonality>(agent?.personality ?? "Professional");
  const [capabilities, setCapabilities] = useState(agent?.capabilities ?? "");
  const [responsibilities, setResponsibilities] = useState(agent?.responsibilities ?? "");
  const [workflow, setWorkflow] = useState(agent?.workflow ?? "");
  const [ownerId, setOwnerId] = useState(agent?.ownerId ?? accounts[0]?.id ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      name,
      purpose,
      personality,
      capabilities,
      responsibilities,
      workflow,
      ...(agent ? {} : { ownerId }),
    });
  }

  return (
    <dialog open className="modal modal-open bg-[#14231d]/50 p-4 backdrop-blur-sm" onCancel={onClose}>
      <div className="modal-box max-h-[92vh] max-w-2xl overflow-y-auto rounded-[1.75rem] border border-[#dfe5df] bg-white p-0 shadow-2xl">
        <div className="border-b border-[#e4e9e4] px-7 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#72860f]">Agent profile</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{agent ? "Edit Hermes agent" : "Create Hermes agent"}</h2>
              <p className="mt-2 text-sm leading-6 text-[#687a71]">This profile will map to a container when deployment is enabled.</p>
            </div>
            <button type="button" onClick={onClose} className="btn btn-circle btn-ghost btn-sm" aria-label="Close form">✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-7">
          {!agent && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Account</span>
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                className="select h-12 w-full rounded-xl border-[#ccd5ce] bg-white"
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.email}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-[#7a8c82]">
                Each account can own only one agent.
              </span>
            </label>
          )}
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Agent name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="input h-12 w-full rounded-xl border-[#ccd5ce] bg-white" placeholder="Customer Concierge" required minLength={2} maxLength={80} autoFocus />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Purpose</span>
            <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} className="textarea min-h-28 w-full resize-none rounded-xl border-[#ccd5ce] bg-white leading-6" placeholder="Describe what this agent should help people accomplish..." required minLength={10} maxLength={240} />
            <span className="mt-1 block text-right text-xs text-[#8a9891]">{purpose.length}/240</span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Personality</span>
            <select value={personality} onChange={(event) => setPersonality(event.target.value as AgentPersonality)} className="select h-12 w-full rounded-xl border-[#ccd5ce] bg-white">
              {personalities.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <div className="border-t border-[#e4e9e4] pt-5">
            <p className="text-sm font-semibold">Agent instructions</p>
            <p className="mt-1 text-xs leading-5 text-[#7a8c82]">
              These sections become the agent&apos;s persistent Hermes identity and working rules.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">What this agent can do</span>
            <textarea
              value={capabilities}
              onChange={(event) => setCapabilities(event.target.value)}
              className="textarea min-h-28 w-full rounded-xl border-[#ccd5ce] bg-white leading-6"
              placeholder="List its capabilities, tools, knowledge, and the requests it may handle."
              maxLength={4000}
            />
            <span className="mt-1 block text-right text-xs text-[#8a9891]">
              {capabilities.length}/4000
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">What this agent needs to do</span>
            <textarea
              value={responsibilities}
              onChange={(event) => setResponsibilities(event.target.value)}
              className="textarea min-h-28 w-full rounded-xl border-[#ccd5ce] bg-white leading-6"
              placeholder="Define responsibilities, required checks, boundaries, and expected outcomes."
              maxLength={4000}
            />
            <span className="mt-1 block text-right text-xs text-[#8a9891]">
              {responsibilities.length}/4000
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Working flow</span>
            <textarea
              value={workflow}
              onChange={(event) => setWorkflow(event.target.value)}
              className="textarea min-h-32 w-full rounded-xl border-[#ccd5ce] bg-white leading-6"
              placeholder="Describe the step-by-step flow: receive request, gather context, act, verify, and report."
              maxLength={4000}
            />
            <span className="mt-1 block text-right text-xs text-[#8a9891]">
              {workflow.length}/4000
            </span>
          </label>

          <div className="rounded-2xl bg-[#f3f5f0] p-4 text-sm text-[#5f7168]">
            {agent?.containerId
              ? "Saving restarts this Hermes container so the new instructions apply to future messages."
              : "The instructions will be applied to Hermes when this agent is deployed."}
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn rounded-xl border-[#ccd5ce] bg-white shadow-none" disabled={saving}>Cancel</button>
            <button type="submit" className="btn rounded-xl border-0 bg-[#14231d] px-7 text-white shadow-none hover:bg-[#254237]" disabled={saving}>
              {saving && <span className="loading loading-spinner loading-sm" />}
              {agent ? "Save changes" : "Create agent"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}
