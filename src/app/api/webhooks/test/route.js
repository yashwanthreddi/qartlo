import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toString(value = "") {
  return String(value ?? "").trim();
}

function stripQuotes(value = "") {
  return toString(value).replace(/^['"]|['"]$/g, "");
}

function replacePlaceholders(input = "", payload = {}) {
  let output = String(input || "");

  Object.entries(payload || {}).forEach(([key, value]) => {
    const token = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    output = output.replace(token, String(value ?? ""));
  });

  return output;
}

function replacePlaceholdersInObject(obj = {}, payload = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};

  const output = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === "string") {
      output[key] = replacePlaceholders(value, payload);
    } else {
      output[key] = value;
    }
  });

  return output;
}

function isLikelyUrl(value = "") {
  return /^https?:\/\//i.test(toString(value));
}

function parseCurl(curlCommand = "") {
  const result = {
    method: "POST",
    url: "",
    headers: {},
    body: "",
  };

  const normalized = String(curlCommand || "")
    .replace(/\\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const methodMatch = normalized.match(/(?:-X|--request)\s+([A-Z]+)/i);
  if (methodMatch?.[1]) {
    result.method = methodMatch[1].toUpperCase();
  }

  const urlMatch =
    normalized.match(/(?:--url|curl)\s+'([^']+)'/i) ||
    normalized.match(/(?:--url|curl)\s+"([^"]+)"/i);

  if (urlMatch?.[1]) {
    result.url = urlMatch[1];
  } else {
    const fallbackUrlMatch = normalized.match(/https?:\/\/[^\s'"]+/i);
    if (fallbackUrlMatch?.[0]) {
      result.url = fallbackUrlMatch[0];
    }
  }

  const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const headerLine = headerMatch[2];
    const separatorIndex = headerLine.indexOf(":");

    if (separatorIndex > -1) {
      const key = headerLine.slice(0, separatorIndex).trim();
      const value = headerLine.slice(separatorIndex + 1).trim();
      result.headers[key] = value;
    }
  }

  const dataMatch =
    normalized.match(/(?:--data-raw|--data|--data-binary)\s+'([\s\S]*?)'/i) ||
    normalized.match(/(?:--data-raw|--data|--data-binary)\s+"([\s\S]*?)"/i);

  if (dataMatch?.[1]) {
    result.body = dataMatch[1];
  }

  return result;
}

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      webhookKey,
      curl,
      samplePayload = {},
    } = body || {};

    const safeWebhookKey = toString(webhookKey);
    const safeCurl = String(curl || "").trim();

    if (!safeWebhookKey) {
      return NextResponse.json(
        { success: false, error: "webhookKey is required" },
        { status: 400 }
      );
    }

    if (!safeCurl) {
      return NextResponse.json(
        { success: false, error: "Webhook URL or cURL is required" },
        { status: 400 }
      );
    }

    const payloadObject =
      samplePayload &&
      typeof samplePayload === "object" &&
      !Array.isArray(samplePayload)
        ? samplePayload
        : {};

    let method = "POST";
    let finalUrl = "";
    let headers = {};
    let finalBody = "";

    if (isLikelyUrl(safeCurl)) {
      finalUrl = replacePlaceholders(stripQuotes(safeCurl), payloadObject);
      headers = {
        "Content-Type": "application/json",
      };
      finalBody = JSON.stringify(payloadObject);
    } else {
      const parsed = parseCurl(safeCurl);

      if (!parsed.url) {
        return NextResponse.json(
          { success: false, error: "Could not detect webhook URL from input" },
          { status: 400 }
        );
      }

      method = parsed.method || "POST";
      finalUrl = replacePlaceholders(stripQuotes(parsed.url), payloadObject);
      headers = replacePlaceholdersInObject(parsed.headers || {}, payloadObject);

      if (parsed.body) {
        finalBody = replacePlaceholders(parsed.body, payloadObject);
      } else if (method !== "GET") {
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
        finalBody = JSON.stringify(payloadObject);
      }
    }

    const fetchOptions = {
      method,
      headers,
    };

    if (method !== "GET" && finalBody) {
      fetchOptions.body = finalBody;
    }

    const response = await fetch(finalUrl, fetchOptions);
    const responseText = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      message: response.ok
        ? "Webhook request sent successfully."
        : "Webhook endpoint returned a non-success response.",
      responseText,
      requestPreview: {
        webhookKey: safeWebhookKey,
        method,
        url: finalUrl,
        headers,
        body: finalBody || "",
      },
    });
  } catch (error) {
    console.error("Webhook test API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to test webhook",
      },
      { status: 500 }
    );
  }
}