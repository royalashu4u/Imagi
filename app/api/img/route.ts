import { NextRequest, NextResponse } from "next/server";
import type { ImageEditRequest, ErrorResponse } from "./types";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const POLLINATIONS_BASE_URL = "https://enter.pollinations.ai/api/generate/image/edit";

const VALID_TEXT_POSITIONS = ["top", "bottom", "center", "left", "right"] as const;

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function validateRequest(body: unknown): body is ImageEditRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const request = body as Partial<ImageEditRequest>;

  if (!request.Text || typeof request.Text !== "string" || request.Text.trim().length === 0) {
    return false;
  }

  if (!request.Image || typeof request.Image !== "string" || !isValidUrl(request.Image)) {
    return false;
  }

  if (
    !request["Text Position"] ||
    !VALID_TEXT_POSITIONS.includes(request["Text Position"] as typeof VALID_TEXT_POSITIONS[number])
  ) {
    return false;
  }

  return true;
}

function buildPollinationsUrl(request: ImageEditRequest): string {
  // Build the prompt text exactly as in the n8n workflow
  // Note: The prompt text goes in the URL path, not as a query parameter
  // The prompt starts with a space after /edit
  const prompt = ` edit this image by removing all existing text and adding the following new text:\n\n"${request.Text}" Rules:\n- never erase or modify the watermark\n- the new text must be formatted into a maximum of **2 lines only** (STRICT REQUIREMENT)\n- absolutely NEVER generate more than 2 lines under any circumstance\n- keep the rest of the image unchanged\n- place the text at the ${request["Text Position"]} of the image\n- match the exact style of the original text in the reference image:\n    * same font family\n    * same text color and shades\n    * same stroke/outline or shadow (if present)\n    * same font weight and thickness\n    * same letter spacing and line spacing\n    * same alignment and text layout\n    * same proportional size relative to the image\n- the new text must blend seamlessly as if it was originally part of the image\n- do NOT introduce any new styles, colors, effects, or design changes`;

  // URL encode the prompt (spaces -> %20, newlines -> %0A, quotes -> %22, etc.)
  const encodedPrompt = encodeURIComponent(prompt);

  // Build URL exactly as n8n workflow: base path + encoded prompt + query parameters
  // Format: https://enter.pollinations.ai/api/generate/image/edit{encodedPrompt}?image={url}&model=nanobanana&nologo=true
  // The encoded prompt will have %20 at the start (encoded space)
  const url = `${POLLINATIONS_BASE_URL}${encodedPrompt}?image=${encodeURIComponent(request.Image)}&model=nanobanana&nologo=true`;

  return url;
}

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!POLLINATIONS_API_KEY) {
      return NextResponse.json<ErrorResponse>(
        {
          error: "Server configuration error",
          message: "Pollinations API key is not configured",
        },
        { status: 500 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json<ErrorResponse>(
        {
          error: "Invalid request",
          message: "Request body must be valid JSON",
        },
        { status: 400 }
      );
    }

    // Validate request body
    if (!validateRequest(body)) {
      return NextResponse.json<ErrorResponse>(
        {
          error: "Validation error",
          message:
            "Invalid request body. Required fields: Text (string), Image (valid URL), Text Position (top|bottom|center|left|right)",
        },
        { status: 400 }
      );
    }

    // Build Pollinations.ai API URL
    const pollinationsUrl = buildPollinationsUrl(body);

    // Make request to Pollinations.ai API
    let pollinationsResponse: Response;
    try {
      pollinationsResponse = await fetch(pollinationsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${POLLINATIONS_API_KEY}`,
          Accept: "image/*",
        },
      });
    } catch (error) {
      return NextResponse.json<ErrorResponse>(
        {
          error: "External API error",
          message: "Failed to connect to Pollinations.ai API",
        },
        { status: 502 }
      );
    }

    // Check if response is successful
    if (!pollinationsResponse.ok) {
      const errorText = await pollinationsResponse.text().catch(() => "Unknown error");
      return NextResponse.json<ErrorResponse>(
        {
          error: "Pollinations API error",
          message: `API returned status ${pollinationsResponse.status}: ${errorText}`,
        },
        { status: pollinationsResponse.status >= 500 ? 502 : pollinationsResponse.status }
      );
    }

    // Get image data
    const imageBuffer = await pollinationsResponse.arrayBuffer();
    const contentType = pollinationsResponse.headers.get("content-type") || "image/jpeg";

    // Return image as binary response
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Unexpected error in /api/img:", error);
    return NextResponse.json<ErrorResponse>(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

// Reject non-POST methods
export async function GET() {
  return NextResponse.json<ErrorResponse>(
    { error: "Method not allowed", message: "Only POST method is supported" },
    { status: 405 }
  );
}

