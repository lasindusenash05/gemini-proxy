// Cloudflare Worker for Gemini API Proxy
export default {
  async fetch(request: Request, env: Env) {
    const apiKey = "AIzaSyDusmRAhk1DBxmmzUmUmmOzV78nrs0KQ1U";
    // use apiKey with fetch or wherever needed
  },
};

interface Env {
  GEMINI_API_KEY: string;
}
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    try {
      const requestData = await request.json();
      const { prompt, image, apiKey } = requestData;

      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Prepare the request body for Gemini API
      let parts = [];
      
      if (prompt) {
        parts.push({ text: prompt });
      }

      if (image) {
        // Handle base64 image data
        const imageData = image.replace(/^data:image\/[^;]+;base64,/, '');
        parts.push({
          inline_data: {
            mime_type: image.includes('jpeg') || image.includes('jpg') ? 'image/jpeg' : 
                       image.includes('png') ? 'image/png' : 
                       image.includes('gif') ? 'image/gif' : 
                       image.includes('webp') ? 'image/webp' : 'image/jpeg',
            data: imageData
          }
        });
      }

      const geminiRequestBody = {
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      // Make request to Gemini API
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiRequestBody),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('Gemini API Error:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Gemini API request failed',
          details: errorText 
        }), {
          status: geminiResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const geminiData = await geminiResponse.json();
      
      // Extract the response text
      let responseText = '';
      if (geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content) {
        responseText = geminiData.candidates[0].content.parts[0].text;
      } else {
        responseText = 'No response generated';
      }

      return new Response(JSON.stringify({ 
        response: responseText,
        fullResponse: geminiData 
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Proxy Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
