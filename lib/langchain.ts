import {
    ChatPromptTemplate,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { getVectorStore } from "./vectorStore";
import { streamingModel, nonStreamingModel } from "./llm";
import { QA_TEMPLATE } from "./promptTemplates";
type callChainArgs = {
    question: string;
    chatHistory: string;
    pdfId?: string;
};

// Helper function to convert chat history string to BaseMessage array
function parseChatHistory(chatHistory: string): BaseMessage[] {
    if (!chatHistory || chatHistory.trim() === '') {
        return [];
    }

    const messages: BaseMessage[] = [];
    const lines = chatHistory.split('\n');

    for (const line of lines) {
        if (line.startsWith('User: ')) {
            messages.push(new HumanMessage(line.substring(6)));
        } else if (line.startsWith('Assistant: ')) {
            messages.push(new AIMessage(line.substring(11)));
        }
    }

    return messages;
}

export async function callChain({ question, chatHistory, pdfId }: callChainArgs) {
    try {
        const sanitizedQuestion = question.trim().replace("\n", " ");

        // Parse chat history into BaseMessage array
        const parsedChatHistory = parseChatHistory(chatHistory);

        // Get the vector store for retrieval - use specific PDF collection if provided
        let vectorStore;
        if (pdfId) {
            try {
                const collectionName = `pdf_${pdfId}`;
                vectorStore = await getVectorStore(collectionName);
                console.log(`Using PDF-specific collection: ${collectionName}`);
            } catch {
                console.log(`PDF collection not found, falling back to default collection`);
                vectorStore = await getVectorStore();
            }
        } else {
            vectorStore = await getVectorStore();
        }

        const retriever = vectorStore.asRetriever({
            searchType: "similarity",
            k: 6  // Increased for better coverage
        });

        // Test the retriever before using it in the chain
        console.log(`Testing retriever with question: "${sanitizedQuestion}"`);
        try {
            const testDocs = await retriever.invoke(sanitizedQuestion);
            console.log(`Retrieved ${testDocs.length} documents:`, testDocs.map(doc => ({
                content: doc.pageContent.substring(0, 100),
                metadata: doc.metadata
            })));
        } catch (retrievalError) {
            console.error("Error during document retrieval:", retrievalError);
            throw new Error(`Document retrieval failed: ${retrievalError}`);
        }

        // Use a corrected version of STANDALONE_QUESTION_TEMPLATE with proper variable names
        const correctedStandaloneTemplate = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {input}
Standalone question:`;

        const contextualizeQPrompt = ChatPromptTemplate.fromTemplate(correctedStandaloneTemplate);

        // Create history aware retriever
        const historyAwareRetriever = await createHistoryAwareRetriever({
            llm: nonStreamingModel,
            retriever,
            rephrasePrompt: contextualizeQPrompt,
        });

        // Use the QA_TEMPLATE for the main QA prompt
        const correctedQATemplate = `You are an enthusiastic AI assistant. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.

{context}

Question: {input}
Helpful answer in markdown:`;

        const qaPrompt = ChatPromptTemplate.fromTemplate(correctedQATemplate);

        // Create question answer chain
        const questionAnswerChain = await createStuffDocumentsChain({
            llm: streamingModel,
            prompt: qaPrompt,
        });

        // Create the RAG chain
        const ragChain = await createRetrievalChain({
            retriever: historyAwareRetriever,
            combineDocsChain: questionAnswerChain,
        });

        // Execute the chain with proper BaseMessage array
        const result = await ragChain.invoke({
            input: sanitizedQuestion,
            chat_history: parsedChatHistory,
        });

        return {
            output: result.answer,
            sourceDocuments: result.context || [],
        };

    } catch (error) {
        console.error("Error in callChain:", error);
        throw new Error("Failed to process the question");
    }
}

// Simple function for basic question answering without complex chains
export async function simpleQA(question: string) {
    try {
        const vectorStore = await getVectorStore();
        // Increase k for better retrieval coverage
        const retriever = vectorStore.asRetriever({
            k: 8,
            searchType: "similarity"
        });

        // Get relevant documents
        const docs = await retriever.invoke(question);

        // Create context from documents with more detail
        const context = docs.map((doc, index) =>
            `Document ${index + 1}:\n${doc.pageContent}`
        ).join("\n\n");

        // Use the better QA_TEMPLATE from promptTemplates.ts
        const prompt = QA_TEMPLATE
            .replace("{context}", context)
            .replace("{question}", question);

        console.log("Retrieved documents:", docs.length);
        console.log("Context preview:", context.substring(0, 200) + "...");

        // Get response from model
        const response = await nonStreamingModel.invoke(prompt);

        return {
            output: response.content,
            sourceDocuments: docs,
        };

    } catch (error) {
        console.error("Error in simpleQA:", error);
        throw new Error("Failed to process the question");
    }
}