import { config } from "dotenv";

// Load environment variables first
config();

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { env } from "./config";

// Function to create streaming model
export function createStreamingModel() {
    return new ChatGoogleGenerativeAI({
        model: "gemini-1.5-flash",
        apiKey: env.GEMINI_API_KEY,
        streaming: true,
        temperature: 0.7,
    });
}

// Function to create non-streaming model
export function createNonStreamingModel() {
    return new ChatGoogleGenerativeAI({
        model: "gemini-1.5-flash",
        apiKey: env.GEMINI_API_KEY,
        streaming: false,
        temperature: 0.7,
    });
}

// Create singleton instances
export const streamingModel = createStreamingModel();
export const nonStreamingModel = createNonStreamingModel();

// Example functions for testing
export async function runStreaming() {
    const stream = await streamingModel.stream("Write a short poem about a cat.");
    for await (const chunk of stream) {
        // Process and display the chunks as they arrive
        console.log(chunk.content);
    }
}

export async function runNonStreaming() {
    const response = await nonStreamingModel.invoke("Write a short poem about a cat.");
    // The entire response is available here as a single object
    console.log(response.content);
}