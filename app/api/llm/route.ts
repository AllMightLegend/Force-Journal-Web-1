// app/api/llm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

// Interface for response structure
interface LLMResponse {
  text: string;
  model: string;
  error?: string;
}

// Interface for LLM options
interface LLMOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  includeWordCloud?: boolean;
  includeMoodDistribution?: boolean;
  includeGoals?: boolean;
  includeSocialInteractions?: boolean;
  includeFlowData?: boolean;
}

// LLM provider types
type LLMProvider = 'gemini' | 'openai' | 'claude';

// Configuration for each LLM provider
const LLM_CONFIG = {
  gemini: {
    modelName: 'gemini-2.0-flash',
    maxTokens: 8192,
  },
  openai: {
    modelName: 'gpt-3.5-turbo',
    maxTokens: 4096,
  },
  claude: {
    modelName: 'claude-3-haiku-20240307',
    maxTokens: 4096,
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { prompt, provider = process.env.DEFAULT_LLM_PROVIDER, options = {} } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    
    let response: LLMResponse;
    
    switch (provider as LLMProvider) {
      case 'gemini':
        response = await getGeminiResponse(prompt, options);
        break;
      case 'openai':
        response = await getOpenAIResponse(prompt, options);
        break;
      case 'claude':
        response = await getClaudeResponse(prompt, options);
        break;
      default:
        return NextResponse.json({ error: 'Invalid LLM provider' }, { status: 400 });
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('LLM API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Gemini implementation using the latest GoogleGenAI client
async function getGeminiResponse(prompt: string, options: LLMOptions): Promise<LLMResponse> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    
    const genAI = new GoogleGenAI({ apiKey });
    
    // Structure the prompt for journal analysis
    const structuredPrompt = formatJournalPromptForGemini(prompt, options);
    
    const response = await genAI.models.generateContent({
      model: LLM_CONFIG.gemini.modelName,
      contents: structuredPrompt,
      // @ts-expect-error - GoogleGenAI types are not fully up to date
      generationConfig: {
        maxOutputTokens: LLM_CONFIG.gemini.maxTokens,
        temperature: options.temperature || 0.7,
        topP: options.topP || 0.95,
        topK: options.topK || 40,
      }
    });
    console.log(response)
    return {
      // @ts-expect-error - GoogleGenAI types are not fully up to date
      text: response.text,
      model: LLM_CONFIG.gemini.modelName,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      text: '',
      model: LLM_CONFIG.gemini.modelName,
      error: (error as Error).message,
    };
  }
}

// Format prompt specifically for journal analysis with Gemini
function formatJournalPromptForGemini(prompt: string, options: LLMOptions): string {
  // Base analysis instructions
  const structuredPrompt = `
You are a professional journal analyzer. Analyze the following journal entries and provide insights:

${prompt}

Please provide the following analysis:
1. Extract keywords for a word cloud (array of strings, most important first)
2. For each entry, estimate energy (1-10) and productivity (1-10)
3. List top mood influencers (array of {influencer, impact})
4. For each entry, estimate emotion distribution (object with keys: joy, sadness, anger, fear, surprise, disgust, values 0-1)
5. List topic hierarchy (array of strings, most important first)
6. Flow data showing relationships between emotions and factors:
   - Extract positive and negative emotions
   - Identify external and internal factors
   - Create nodes for each emotion and factor
   - Create edges showing relationships between factors and emotions
7. For each entry, estimate health metrics: sentiment (0-100), physicalWellness (0-100), mentalResilience (0-100)
8. Progress metrics (object: health, resilience, academic, research, 0-100)

Format your response as JSON with the following structure:
{
  "keywords": string[],
  "metrics": {"energy": number, "productivity": number}[],
  "moodInfluencers": {"influencer": string, "impact": number}[],
  "emotionDistribution": Record<string, number>[],
  "topicHierarchy": string[],
  "flowData": {
    "nodes": [
      {
        "id": string,
        "label": string,
        "type": "emotion" | "factor",
        "data": {
          "category": "positive" | "negative" | "external" | "internal"
        }
      }
    ],
    "edges": [
      {
        "id": string,
        "source": string,
        "target": string,
        "label": string
      }
    ]
  },
  "healthMetrics": {"sentiment": number, "physicalWellness": number, "mentalResilience": number}[],
  "progressMetrics": {"health": number, "resilience": number, "academic": number, "research": number}
}
Return ONLY valid JSON.
`;
  return structuredPrompt;
}

// OpenAI implementation (placeholder for future implementation)
// OpenAI implementation
async function getOpenAIResponse(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not defined in environment variables');
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: LLM_CONFIG.openai.modelName,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional journal analyzer providing insights and analysis.'
                    },
                    {
                        role: 'user',
                        content: formatJournalPromptForOpenAI(prompt, options)
                    }
                ],
                max_tokens: LLM_CONFIG.openai.maxTokens,
                temperature: options.temperature || 0.7,
                top_p: options.topP || 0.95,
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
        }
        
        const data = await response.json();
        
        return {
            text: data.choices[0].message.content,
            model: LLM_CONFIG.openai.modelName,
        };
    } catch (error) {
        console.error('OpenAI API error:', error);
        return {
            text: '',
            model: LLM_CONFIG.openai.modelName,
            error: (error as Error).message,
        };
    }
}

// Format prompt specifically for journal analysis with OpenAI
function formatJournalPromptForOpenAI(prompt: string, options: LLMOptions): string {
    // Similar to Gemini but optimized for OpenAI
    let structuredPrompt = `
Analyze the following journal entries and provide detailed insights:

${prompt}

Please provide the following analysis as a JSON object:
1. Overall sentiment analysis (include a score from -10 to +10)
2. Key topics discussed with their frequency and context
3. Patterns and trends identified with their significance
4. Personalized insights based on the entries
5. Actionable suggestions for the journal writer
`;

    // Add optional analysis types
    if (options.includeWordCloud) {
        structuredPrompt += "\n6. Most frequently used words and their context";
    }
    
    if (options.includeMoodDistribution) {
        structuredPrompt += "\n7. Mood distribution and emotional patterns";
    }
    
    if (options.includeGoals) {
        structuredPrompt += "\n8. Goals mentioned and progress tracking";
    }
    
    if (options.includeSocialInteractions) {
        structuredPrompt += "\n9. People mentioned and relationship dynamics";
    }

    // JSON structure instruction
    structuredPrompt += `\n\nReturn ONLY a valid JSON object with the following structure:
{
    "sentiment": { "overall": "string description", "score": number },
    "topics": [{ "name": "string", "frequency": number, "context": "string" }],
    "patterns": [{ "pattern": "string", "significance": "string" }],
    "insights": ["string"],
    "suggestions": ["string"]
}`;

    return structuredPrompt;
}

// Claude implementation using Anthropic API
async function getClaudeResponse(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not defined in environment variables');
        }
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: LLM_CONFIG.claude.modelName,
                messages: [
                    {
                        role: 'user',
                        content: formatJournalPromptForClaude(prompt, options)
                    }
                ],
                max_tokens: LLM_CONFIG.claude.maxTokens,
                temperature: options.temperature || 0.7,
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Claude API error');
        }
        
        const data = await response.json();
        
        return {
            text: data.content?.[0]?.text || '',
            model: LLM_CONFIG.claude.modelName,
        };
    } catch (error) {
        console.error('Claude API error:', error);
        return {
            text: '',
            model: LLM_CONFIG.claude.modelName,
            error: (error as Error).message,
        };
    }
}

// Format prompt specifically for journal analysis with Claude
function formatJournalPromptForClaude(prompt: string, options: LLMOptions): string {
    let structuredPrompt = `
Analyze the following journal entries and provide comprehensive insights:

${prompt}

Please provide the following analysis in a JSON format:
1. Overall sentiment analysis with a score from -10 to +10
2. Key topics discussed with their frequency and context
3. Patterns and trends identified with their significance
4. Personalized insights based on the journal content
5. Actionable suggestions for the journal writer
`;

    // Add optional analysis sections
    if (options.includeWordCloud) {
        structuredPrompt += "\n6. Most frequently used words and their context";
    }
    
    if (options.includeMoodDistribution) {
        structuredPrompt += "\n7. Mood distribution and emotional patterns";
    }
    
    if (options.includeGoals) {
        structuredPrompt += "\n8. Goals mentioned and progress tracking";
    }
    
    if (options.includeSocialInteractions) {
        structuredPrompt += "\n9. People mentioned and relationship dynamics";
    }

    // JSON format instruction
    structuredPrompt += `\n\nReturn ONLY a valid JSON object with the following structure:
{
    "sentiment": { "overall": "string description", "score": number },
    "topics": [{ "name": "string", "frequency": number, "context": "string" }],
    "patterns": [{ "pattern": "string", "significance": "string" }],
    "insights": ["string"],
    "suggestions": ["string"]
}`;

    return structuredPrompt;
}