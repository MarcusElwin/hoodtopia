import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";

const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey! });

// Using Gemini 3 Pro Image Preview for image generation
const IMAGE_MODEL = "gemini-3-pro-image-preview";

export interface GenerateCustomHoodieInput {
  type: "image" | "text";
  imageData?: string; // base64 encoded image
  description?: string;
  baseColor?: string;
  hoodieType?: string;
}

export interface GeneratedDesign {
  imageUrl: string;
  generationId: string;
  prompt: string;
}

/**
 * Generate a custom hoodie design using Google Gemini
 */
export async function generateCustomHoodie(
  input: GenerateCustomHoodieInput
): Promise<GeneratedDesign> {
  const baseColor = input.baseColor || "Black";
  const hoodieType = input.hoodieType || "pullover";
  const generationId = uuidv4();

  const hoodieTypeDescriptions: Record<string, string> = {
    pullover: "pullover hoodie with kangaroo pocket",
    "zip-up": "zip-up hoodie with full-zip front closure",
    sleeveless: "sleeveless hoodie vest-style with hood",
  };

  const hoodieDesc = hoodieTypeDescriptions[hoodieType] || hoodieTypeDescriptions.pullover;

  // Build the prompt for Gemini
  let prompt = "";

  if (input.type === "text" && input.description) {
    prompt = `Professional e-commerce product photograph of a ${baseColor} ${hoodieDesc} with the following custom design: ${input.description}

The hoodie should be:
- Displayed flat on a clean white to light gray gradient background
- Front view with slight 3/4 angle
- Professional soft-box lighting, even and flattering
- The custom design should be prominently visible on the chest area
- Sharp focus with visible fabric texture
- Photorealistic, high-end commercial quality
- No people, no faces, no brand logos
- Just the hoodie product shot with the custom design

Style reference: Premium e-commerce photography like Nike, Lululemon, or Everlane product pages.`;
  } else if (input.type === "image" && input.imageData) {
    prompt = `Professional e-commerce product photograph of a ${baseColor} ${hoodieDesc} with a custom design.

The uploaded image should be transformed into a printed/embroidered design on the chest area of the hoodie.

Requirements:
- Display the hoodie flat on clean white to light gray gradient background
- Front view with slight 3/4 angle
- Professional soft-box lighting
- Make the uploaded design look professionally printed or embroidered on the fabric
- Sharp focus with realistic fabric textures
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Professional e-commerce product photo with custom design.`;
  } else {
    throw new Error("Invalid input: must provide either description or imageData");
  }

  try {
    const response = await genAI.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "2K",
        },
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/png";
        const extension = mimeType.includes("jpeg") ? "jpg" : "png";

        const filename = `${generationId}.${extension}`;
        const imageUrl = await saveGeneratedImage(imageData!, filename);

        return {
          imageUrl,
          generationId,
          prompt,
        };
      }
    }

    throw new Error("No image data in response");
  } catch (error) {
    console.error("Error generating custom hoodie:", error);
    throw new Error("Failed to generate custom design");
  }
}

/**
 * Save generated image to file system
 */
async function saveGeneratedImage(
  base64Data: string,
  filename: string
): Promise<string> {
  const publicDir = path.join(process.cwd(), "public", "images", "custom");
  await fs.mkdir(publicDir, { recursive: true });

  const filepath = path.join(publicDir, filename);
  const buffer = Buffer.from(base64Data, "base64");

  await fs.writeFile(filepath, buffer);

  return `/images/custom/${filename}`;
}

/**
 * Refine an existing custom design based on user feedback
 */
export async function refineCustomDesign(
  originalPrompt: string,
  currentImageUrl: string,
  userFeedback: string
): Promise<GeneratedDesign> {
  const generationId = uuidv4();

  try {
    // Modify the original prompt based on user feedback
    const refinedPrompt = `${originalPrompt}

Additionally, incorporate this user feedback: ${userFeedback}

Make the necessary adjustments while maintaining the professional e-commerce photography style.`;

    const response = await genAI.models.generateContent({
      model: IMAGE_MODEL,
      contents: refinedPrompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "2K",
        },
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/png";
        const extension = mimeType.includes("jpeg") ? "jpg" : "png";

        const filename = `${generationId}.${extension}`;
        const imageUrl = await saveGeneratedImage(imageData!, filename);

        return {
          imageUrl,
          generationId,
          prompt: refinedPrompt,
        };
      }
    }

    throw new Error("No image data in response");
  } catch (error) {
    console.error("Error refining custom design:", error);
    throw new Error("Failed to refine custom design");
  }
}

/**
 * Save image data to file system (for demo purposes)
 * In production, use cloud storage like S3, Vercel Blob, etc.
 */
export async function saveImageToFile(
  base64Data: string,
  filename: string
): Promise<string> {
  const publicDir = path.join(process.cwd(), "public", "images", "custom");
  await fs.mkdir(publicDir, { recursive: true });

  const filepath = path.join(publicDir, filename);
  const buffer = Buffer.from(base64Data, "base64");

  await fs.writeFile(filepath, buffer);

  return `/images/custom/${filename}`;
}
