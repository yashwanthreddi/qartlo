import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function toString(value) {
  return String(value ?? "").trim();
}

export async function GET(request) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const storeId = toString(searchParams.get("storeId"));

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "storeId is required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("store_private").doc(storeId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Private store not found" },
        { status: 404 }
      );
    }

    const privateData = docSnap.data() || {};

    const safeData = {
      ...privateData,
    };

    delete safeData.razorpayKeySecret;
    delete safeData.razorpayWebhookSecret;

    return NextResponse.json({
      success: true,
      data: safeData,
    });
  } catch (error) {
    console.error("GET /api/get-store-private failed");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("Stack:", error?.stack);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error",
        code: error?.code || null,
      },
      { status: 500 }
    );
  }
}