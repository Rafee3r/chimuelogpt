import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is missing. Please configure DEEPSEEK_API_KEY in Vercel." },
        { status: 500 }
      );
    }

    // Use the exact model strings requested by the user
    // "deepseek-v4-pro" or "deepseek-v4-flash"
    const actualModel = model || "deepseek-v4-pro";

    // Format messages for DeepSeek API
    // Support multi-modal format if an image is provided
    const formattedMessages = messages.map((m: any) => {
      if (m.image) {
        return {
          role: m.role,
          content: [
            { type: "text", text: m.content || " " },
            { type: "image_url", image_url: { url: m.image } }
          ]
        };
      }
      return {
        role: m.role,
        content: m.content
      };
    });

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: "system", content: "You are ChimueloGPT, a helpful assistant created for a family. Always be helpful, friendly, and respectful. IMPORTANT: If the user asks you to generate, draw, or create an image/photo, you must respond ONLY with this exact markdown format: ![Generando imagen...](https://image.pollinations.ai/prompt/{english_translation_of_the_image_description}?width=1024&height=1024&nologo=true) replacing the `{english_translation_of_the_image_description}` with a highly detailed prompt in English based on what the user asked. DO NOT add any extra text or code blocks, just the raw markdown image syntax." },
          ...formattedMessages
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API Error:", errorText);
      return NextResponse.json(
        { error: "Failed to communicate with DeepSeek API." },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      reply: data.choices[0].message.content
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
