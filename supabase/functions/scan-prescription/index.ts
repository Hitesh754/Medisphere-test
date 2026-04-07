// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imageBase64.length > 5_000_000) {
      return new Response(JSON.stringify({ error: "Image too large" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MY_API_KEY = Deno.env.get("MY_API_KEY");

    if (!MY_API_KEY) {
      console.error("Missing MY_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ Timeout handling
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a medical prescription analyzer. Extract all medicines from the prescription image. For each medicine found, provide:
- name: The exact medicine name
- dosage: The dosage (e.g., 500mg, 10ml)
- frequency: How often to take it
- duration: How long to take it
- advisory: Important advice like "Take after food", "Avoid alcohol"

If unreadable, return empty medicines array with a note.

Also infer meal timing when possible. Add a mealTiming field for each medicine using one of:
- Before breakfast
- After breakfast
- Before lunch
- After lunch
- Before dinner
- After dinner
- Bedtime
- Unknown

Prefer the most specific timing mentioned in the prescription.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all medicine details from this prescription.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_medicines",
                parameters: {
                  type: "object",
                  properties: {
                    medicines: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          dosage: { type: "string" },
                          frequency: { type: "string" },
                          duration: { type: "string" },
                          advisory: { type: "string" },
                          mealTiming: { type: "string" },
                        },
                        required: ["name", "dosage", "frequency", "duration", "advisory", "mealTiming"],
                      },
                    },
                    generalAdvice: { type: "string" },
                  },
                  required: ["medicines", "generalAdvice"],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_medicines" },
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    // ✅ Handle API errors
    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errorText = await response.text();
      console.error("AI error:", errorText);

      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();

    // ✅ Safe access
    const choice = result?.choices?.[0];
    if (!choice) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolCall = choice.message?.tool_calls?.[0];

    // ✅ Safe JSON parsing
    if (toolCall?.function?.arguments) {
      try {
        const extracted = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(extracted), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Parse error:", err);
        return new Response(JSON.stringify({ error: "Invalid AI response format" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ✅ Fallback
    const textContent = choice.message?.content || "";

    return new Response(
      JSON.stringify({
        medicines: [],
        generalAdvice: textContent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("scan-prescription error:", e);

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});