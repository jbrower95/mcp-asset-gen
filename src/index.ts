#!/usr/bin/env -S node --no-deprecation
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import OpenAI from 'openai';
import { writeFileSync } from 'fs';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Error: API_KEY environment variable is not set");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKey,
});

async function main() {
  try {
    const server = new McpServer({
      name: 'image-generator',
      version: '1.0.0'
    });

    server.tool(
      'generateImage',
      {
        outputPathAbsolute: z.string().describe('The absolute path where the image should be written out.'),
        prompt: z.string().describe("Text description of the desired image content"),
        quality: z.enum(["auto", "low", "medium", "high"]).optional().describe("The quality of the image."),
        size: z.enum(['1024x1024', '1024x1536', '1536x1024', 'auto']).optional().describe("Size of the generated image"),
      },
      async ({ prompt, size = "1024x1024", quality="low", outputPathAbsolute}) => {
        try {
          const response = await openai.images.generate({
            model: "gpt-image-1",
            prompt,
            n: 1,
            size: size,
            quality: quality,
          });

          if (!response.data) {
            throw new Error(`API did not return any data.`);
          }

          if (!response.data[0]?.b64_json) {
            throw new Error('API did not return image data');
          }
          
          const imageData = response.data[0].b64_json;
          const bytes = Buffer.from(imageData, 'base64');

          writeFileSync(outputPathAbsolute, bytes)

          return {
            content: [
                {
                    type: 'text',
                    text: `The image is now available at ${outputPathAbsolute}.`
                }
            ],
            message: "Image generated successfully!"
          };
        } catch (error) {
          throw new Error(`Error generating image: ${JSON.stringify(error, null, 2)}`, {cause: error});
        }
      }
    );

    // Connect using stdio transport (for CLI usage)
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();