"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import QRCode from "qrcode";
import type {
  AgentProfile,
  TelegramConnectionResult,
  TelegramProgress,
  WhatsAppConnectionResult,
  WhatsAppProgress,
} from "@/types";

type ChannelSettingsModalProps = {
  agent: AgentProfile;
  onClose: () => void;
  onConnectTelegram: (
    botFatherText: string,
    onProgress: (progress: TelegramProgress | null) => void,
  ) => Promise<TelegramConnectionResult>;
  onPairTelegram: (
    onProgress: (progress: TelegramProgress | null) => void,
  ) => Promise<TelegramConnectionResult>;
  onConnectWhatsApp: (
    input: { mode: "bot" | "self-chat"; allowedUsers: string },
    onProgress: (progress: WhatsAppProgress | null) => void,
  ) => Promise<WhatsAppConnectionResult>;
};

const telegramTokenPattern = /\b\d{5,}:[A-Za-z0-9_-]{30,}\b/;

function progressMessage(progress: WhatsAppProgress | null) {
  if (!progress) return "Preparing the pairing session...";
  if (progress.stage === "installing") return "Preparing the WhatsApp bridge for first use...";
  if (progress.stage === "starting") return "Starting a secure WhatsApp pairing session...";
  if (progress.stage === "qr") return "Scan this QR code from WhatsApp on your phone.";
  if (progress.stage === "connected") return "WhatsApp linked. Applying the channel settings...";
  return "Restarting Hermes with the WhatsApp channel enabled...";
}

export function ChannelSettingsModal({
  agent,
  onClose,
  onConnectTelegram,
  onPairTelegram,
  onConnectWhatsApp,
}: ChannelSettingsModalProps) {
  const [tab, setTab] = useState<"telegram" | "whatsapp">("telegram");
  const [botFatherText, setBotFatherText] = useState("");
  const [telegramStatus, setTelegramStatus] = useState(agent.telegramChannelStatus);
  const [telegramBotUsername, setTelegramBotUsername] = useState(agent.telegramBotUsername);
  const [telegramProgress, setTelegramProgress] = useState<TelegramProgress | null>(null);
  const [telegramError, setTelegramError] = useState(agent.telegramChannelError ?? "");
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [whatsappMode, setWhatsAppMode] = useState<"bot" | "self-chat">(
    agent.whatsappMode ?? "bot",
  );
  const [allowedUsers, setAllowedUsers] = useState("");
  const [whatsappStatus, setWhatsAppStatus] = useState(agent.whatsappChannelStatus);
  const [whatsappProgress, setWhatsAppProgress] = useState<WhatsAppProgress | null>(null);
  const [whatsappAccountName, setWhatsAppAccountName] = useState(agent.whatsappAccountName);
  const [whatsappAccountLabel, setWhatsAppAccountLabel] = useState(agent.whatsappAccountLabel);
  const [whatsappQr, setWhatsAppQr] = useState("");
  const [whatsappError, setWhatsAppError] = useState(agent.whatsappChannelError ?? "");
  const [whatsappBusy, setWhatsAppBusy] = useState(false);
  const detectedToken = botFatherText.match(telegramTokenPattern)?.[0] ?? "";

  async function connectTelegram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTelegramBusy(true);
    setTelegramStatus("configuring");
    setTelegramError("");
    try {
      const result = await onConnectTelegram(botFatherText, setTelegramProgress);
      setTelegramStatus(result.status);
      setTelegramBotUsername(result.botUsername);
      setBotFatherText("");
    } catch (error) {
      setTelegramStatus("failed");
      setTelegramError(error instanceof Error ? error.message : "Telegram setup failed.");
    } finally {
      setTelegramBusy(false);
    }
  }

  async function pairTelegram() {
    setTelegramBusy(true);
    setTelegramStatus("pairing");
    setTelegramError("");
    try {
      const result = await onPairTelegram(setTelegramProgress);
      setTelegramStatus(result.status);
      setTelegramBotUsername(result.botUsername);
    } catch (error) {
      setTelegramStatus("awaiting_message");
      setTelegramError(error instanceof Error ? error.message : "Telegram pairing failed.");
    } finally {
      setTelegramBusy(false);
    }
  }

  function updateWhatsAppProgress(progress: WhatsAppProgress | null) {
    setWhatsAppProgress(progress);
    if (progress?.stage !== "qr") {
      if (progress?.stage === "connected" || progress?.stage === "restarting") setWhatsAppQr("");
      return;
    }
    void QRCode.toDataURL(progress.qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
    }).then(setWhatsAppQr);
  }

  async function connectWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWhatsAppBusy(true);
    setWhatsAppStatus("pairing");
    setWhatsAppError("");
    setWhatsAppQr("");
    try {
      const result = await onConnectWhatsApp(
        { mode: whatsappMode, allowedUsers },
        updateWhatsAppProgress,
      );
      setWhatsAppStatus(result.status);
      setWhatsAppAccountName(result.accountName);
      setWhatsAppAccountLabel(result.accountLabel);
      setAllowedUsers("");
    } catch (error) {
      setWhatsAppStatus("failed");
      setWhatsAppError(error instanceof Error ? error.message : "WhatsApp setup failed.");
    } finally {
      setWhatsAppBusy(false);
    }
  }

  return (
    <dialog
      open
      className="modal modal-open bg-[#14231d]/50 p-4 backdrop-blur-sm"
      onCancel={onClose}
    >
      <div className="modal-box max-h-[92vh] max-w-2xl overflow-y-auto rounded-[1.75rem] border border-[#dfe5df] bg-white p-0 shadow-2xl">
        <div className="border-b border-[#e4e9e4] px-7 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#72860f]">
                Message channels
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                Connect {agent.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#687a71]">
                Connect Telegram or link WhatsApp directly to this Hermes container.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close message channel settings"
            >
              ✕
            </button>
          </div>
          <div role="tablist" className="tabs tabs-box mt-5 bg-[#f1f4ef] p-1">
            <button
              type="button"
              role="tab"
              className={`tab flex-1 rounded-lg ${tab === "telegram" ? "tab-active bg-white font-semibold" : ""}`}
              onClick={() => setTab("telegram")}
            >
              Telegram
            </button>
            <button
              type="button"
              role="tab"
              className={`tab flex-1 rounded-lg ${tab === "whatsapp" ? "tab-active bg-white font-semibold" : ""}`}
              onClick={() => setTab("whatsapp")}
            >
              WhatsApp
            </button>
          </div>
        </div>

        {tab === "telegram" ? (
          <div className="space-y-5 p-7">
            {telegramStatus === "configured" && (
              <div className="rounded-2xl border border-[#d8e5cf] bg-[#f3f9eb] p-4 text-sm">
                <p className="font-semibold text-[#4f6d08]">Telegram is connected</p>
                <p className="mt-1 text-[#60736a]">
                  {telegramBotUsername ? `@${telegramBotUsername}` : "Your Telegram bot"} is ready
                  to receive messages.
                </p>
              </div>
            )}

            {telegramStatus === "awaiting_message" || telegramStatus === "pairing" ? (
              <div className="rounded-2xl border border-[#d7e0d2] bg-[#f7f9f4] p-5">
                <p className="text-sm font-semibold">Finish Telegram setup</p>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#60736a]">
                  <li>
                    Open {telegramBotUsername ? `@${telegramBotUsername}` : "your new bot"} in
                    Telegram.
                  </li>
                  <li>Tap Start or send the message /start.</li>
                  <li>Return here and select the button below.</li>
                </ol>
                <button
                  type="button"
                  className="btn mt-5 w-full rounded-xl border-0 bg-[#14231d] text-white shadow-none hover:bg-[#254237]"
                  onClick={pairTelegram}
                  disabled={telegramBusy}
                >
                  {telegramBusy && <span className="loading loading-spinner loading-sm" />}
                  I sent /start — finish setup
                </button>
              </div>
            ) : (
              <form onSubmit={connectTelegram} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Complete BotFather text</span>
                  <textarea
                    value={botFatherText}
                    onChange={(event) => setBotFatherText(event.target.value)}
                    className="textarea min-h-44 w-full rounded-xl border-[#ccd5ce] bg-white leading-6"
                    placeholder="Paste the whole message BotFather gave you, including the bot token."
                    required
                    maxLength={12000}
                    spellCheck={false}
                  />
                </label>
                {detectedToken && (
                  <p className="text-xs font-medium text-[#587019]">
                    Bot token found · {detectedToken.slice(0, 6)}••••{detectedToken.slice(-4)}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn w-full rounded-xl border-0 bg-[#14231d] text-white shadow-none hover:bg-[#254237]"
                  disabled={telegramBusy || !detectedToken}
                >
                  {telegramBusy && <span className="loading loading-spinner loading-sm" />}
                  Verify Telegram bot
                </button>
              </form>
            )}

            {telegramProgress?.stage === "verifying" && (
              <p className="text-sm text-[#60736a]">Checking this bot directly with Telegram...</p>
            )}
            {telegramProgress?.stage === "checking_message" && (
              <p className="text-sm text-[#60736a]">Looking for your new private /start message...</p>
            )}
            {telegramError && <p className="text-sm text-[#b43737]">{telegramError}</p>}
            <p className="rounded-2xl border border-[#dce6d7] bg-[#f3f7ee] p-4 text-sm leading-6 text-[#52665c]">
              The full text and bot token are sent only to the Hermes machine. The portal does not
              store them. Your private /start message becomes the bot&apos;s allowed Telegram account.
            </p>
          </div>
        ) : (
          <form onSubmit={connectWhatsApp} className="space-y-5 p-7">
            {whatsappStatus === "configured" && !whatsappBusy && (
              <div className="rounded-2xl border border-[#d8e5cf] bg-[#f3f9eb] p-4 text-sm">
                <p className="font-semibold text-[#4f6d08]">WhatsApp is connected</p>
                <p className="mt-1 text-[#60736a]">
                  {[whatsappAccountName, whatsappAccountLabel].filter(Boolean).join(" · ") ||
                    "Linked account"}
                </p>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">How Hermes should respond</span>
              <select
                value={whatsappMode}
                onChange={(event) =>
                  setWhatsAppMode(event.target.value as "bot" | "self-chat")
                }
                className="select h-12 w-full rounded-xl border-[#ccd5ce] bg-white"
                disabled={whatsappBusy}
              >
                <option value="bot">Bot — reply to allowed people</option>
                <option value="self-chat">Self-chat — use my own chat with myself</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Allowed WhatsApp number{whatsappMode === "self-chat" ? " (optional)" : ""}
              </span>
              <textarea
                value={allowedUsers}
                onChange={(event) => setAllowedUsers(event.target.value)}
                className="textarea min-h-24 w-full rounded-xl border-[#ccd5ce] bg-white leading-6"
                placeholder="Include country code, for example +60 12 345 6789. Separate multiple numbers with commas."
                required={whatsappMode === "bot"}
                maxLength={512}
                disabled={whatsappBusy}
              />
            </label>

            {whatsappBusy && (
              <div aria-live="polite" className="rounded-2xl border border-[#d7e0d2] bg-[#f7f9f4] p-5 text-center">
                {whatsappQr ? (
                  <Image
                    src={whatsappQr}
                    alt="WhatsApp linked-device pairing QR code"
                    width={320}
                    height={320}
                    unoptimized
                    className="mx-auto rounded-xl bg-white"
                  />
                ) : (
                  <span className="loading loading-spinner loading-lg text-[#668400]" />
                )}
                <p className="mt-4 text-sm font-semibold">{progressMessage(whatsappProgress)}</p>
                {whatsappQr && (
                  <p className="mt-2 text-xs leading-5 text-[#687a71]">
                    In WhatsApp, open Settings → Linked Devices → Link a Device, then scan this code.
                  </p>
                )}
              </div>
            )}

            {whatsappError && <p className="text-sm text-[#b43737]">{whatsappError}</p>}

            <button
              type="submit"
              className="btn w-full rounded-xl border-0 bg-[#14231d] text-white shadow-none hover:bg-[#254237]"
              disabled={whatsappBusy}
            >
              {whatsappBusy && <span className="loading loading-spinner loading-sm" />}
              {whatsappStatus === "configured" ? "Relink WhatsApp" : "Generate WhatsApp QR"}
            </button>

            <p className="rounded-2xl border border-[#dce6d7] bg-[#f3f7ee] p-4 text-sm leading-6 text-[#52665c]">
              Hermes stores the linked-device session only in this agent&apos;s private droplet volume.
              Full phone numbers and QR contents are not stored by the portal.
            </p>
          </form>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
