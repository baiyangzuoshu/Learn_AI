import { resolveProviderConfig } from "../../src/config/settings.ts";

export interface ProviderBalanceInfo {
  currency: "CNY" | "USD";
  totalBalance: string;
  grantedBalance: string;
  toppedUpBalance: string;
}

export interface ProviderBalanceResult {
  supported: boolean;
  providerId: string;
  isAvailable?: boolean;
  balanceInfos?: ProviderBalanceInfo[];
}

function isDeepSeek(config: { id: string; name: string; baseUrl: string }): boolean {
  return `${config.id} ${config.name} ${config.baseUrl}`.toLowerCase().includes("deepseek");
}

function asBalanceInfo(value: unknown): ProviderBalanceInfo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const currency = raw.currency === "CNY" || raw.currency === "USD" ? raw.currency : undefined;
  if (!currency) return undefined;
  const totalBalance = String(raw.total_balance ?? "").trim();
  const grantedBalance = String(raw.granted_balance ?? "").trim();
  const toppedUpBalance = String(raw.topped_up_balance ?? "").trim();
  if (!totalBalance || !Number.isFinite(Number(totalBalance))) return undefined;
  return { currency, totalBalance, grantedBalance, toppedUpBalance };
}

export async function readProviderBalance(providerId?: string): Promise<ProviderBalanceResult> {
  const config = await resolveProviderConfig(providerId);
  if (!isDeepSeek(config)) return { supported: false, providerId: config.id };
  const balanceBaseUrl = config.baseUrl.replace(/\/v1\/?$/, "");
  const response = await fetch(`${balanceBaseUrl}/user/balance`, {
    headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`余额查询失败（${response.status}）：${detail}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const rawBalances = Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
  return {
    supported: true,
    providerId: config.id,
    isAvailable: payload.is_available === true,
    balanceInfos: rawBalances.flatMap((item) => {
      const balance = asBalanceInfo(item);
      return balance ? [balance] : [];
    }),
  };
}
