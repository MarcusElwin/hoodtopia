import "server-only";
import type {
  CreateOrderPayload,
  CreateOrderResponse,
  ManagementOrder,
  ReadOrderResponse,
} from "./types";

const env = {
  baseUrl: process.env.KUSTOM_API_BASE_URL ?? "https://api.playground.kustom.co",
  username: process.env.KUSTOM_USERNAME ?? "",
  apiKey: process.env.KUSTOM_API_KEY ?? "",
};

function authHeader(): string {
  if (!env.apiKey) {
    throw new Error(
      "KUSTOM_API_KEY is not set. Get one from https://portal.playground.kustom.co"
    );
  }
  const userPart = env.username || "";
  return "Basic " + Buffer.from(`${userPart}:${env.apiKey}`).toString("base64");
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${env.baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: authHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Kustom ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`
    );
  }

  // Some endpoints (acknowledge) return 204 No Content
  if (res.status === 204) return undefined as T;
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export const kustom = {
  createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
    return request<CreateOrderResponse>("POST", "/checkout/v3/orders", payload);
  },
  readOrder(orderId: string): Promise<ReadOrderResponse> {
    return request<ReadOrderResponse>("GET", `/checkout/v3/orders/${orderId}`);
  },
  getManagementOrder(orderId: string): Promise<ManagementOrder> {
    return request<ManagementOrder>("GET", `/ordermanagement/v1/orders/${orderId}`);
  },
  acknowledgeOrder(orderId: string): Promise<void> {
    return request<void>(
      "POST",
      `/ordermanagement/v1/orders/${orderId}/acknowledge`
    );
  },
};
