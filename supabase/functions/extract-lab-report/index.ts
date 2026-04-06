import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, mimeType, fileName } = await req.json();

    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (mimeType && !allowedMimes.includes(mimeType)) {
      return new Response(JSON.stringify({ error: `File type '${mimeType}' is not supported. Please upload a PDF or image file.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxBase64Size = 14 * 1024 * 1024;
    if (fileBase64.length > maxBase64Size) {
      return new Response(JSON.stringify({ error: "File size exceeds 10MB limit." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = `data:${mimeType || "application/pdf"};base64,${fileBase64}`;

    const userContent = [
      {
        type: "text",
        text: "Please analyze this lab report and extract the required patient and physician information along with all lab test results. Also provide a brief health summary based on the results.",
      },
      {
        type: "image_url",
        image_url: { url: dataUrl },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant specialized in extracting structured data from medical lab reports. 
You must extract the following fields from the provided lab report. If a field is not present in the document, return "not present" for that field.

Required fields to extract:
1. Patient Name - The full name of the patient
2. Patient Date of Birth - The patient's date of birth in any format found
3. Patient Address - The complete address of the patient
4. Patient Gender - 'M' for male, 'F' for female, or 'not present' if not found
5. Ordering Physician Name - The name of the ordering/referring physician

Additionally, extract any lab test results found in the report including:
- Test name
- Result value
- Reference range
- Status (normal, high, low, or abnormal)

IMPORTANT: After analyzing all lab results, provide a "healthSummary" field with a concise 1-2 line assessment of the person's overall health based on the lab values. For example: "Overall healthy with slightly elevated cholesterol. Consider dietary changes and follow up in 3 months." or "Multiple values outside normal range suggesting potential liver issues. Consult a specialist promptly." Base this strictly on the lab values you see.

Be thorough and accurate. Only extract information that is clearly visible in the document.`,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_lab_report",
              description: "Extract structured patient info, lab results, and health summary from a medical lab report",
              parameters: {
                type: "object",
                properties: {
                  patientName: { type: "string", description: "Patient's full name or 'not present'" },
                  patientDOB: { type: "string", description: "Patient's date of birth or 'not present'" },
                  patientAddress: { type: "string", description: "Patient's full address or 'not present'" },
                  patientGender: { type: "string", description: "'M', 'F', or 'not present'" },
                  orderingPhysician: { type: "string", description: "Ordering physician's name or 'not present'" },
                  labResults: {
                    type: "array",
                    description: "Array of lab test results found in the report",
                    items: {
                      type: "object",
                      properties: {
                        testName: { type: "string", description: "Name of the lab test" },
                        result: { type: "string", description: "Test result value" },
                        referenceRange: { type: "string", description: "Normal reference range" },
                        status: { type: "string", enum: ["normal", "high", "low", "abnormal"], description: "Whether result is normal, high, low, or abnormal" },
                      },
                      required: ["testName", "result", "referenceRange", "status"],
                    },
                  },
                  collectionDate: { type: "string", description: "Date the sample was collected or 'not present'" },
                  reportDate: { type: "string", description: "Date the report was generated or 'not present'" },
                  labName: { type: "string", description: "Name of the laboratory or 'not present'" },
                  notes: { type: "string", description: "Any additional notes or comments found in the report" },
                  healthSummary: { type: "string", description: "A concise 1-2 line overall health assessment based on the lab results" },
                },
                required: ["patientName", "patientDOB", "patientAddress", "patientGender", "orderingPhysician", "labResults", "healthSummary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_lab_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to analyze lab report" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const extracted = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textContent = result.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ error: "Could not extract data", notes: textContent }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-lab-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});