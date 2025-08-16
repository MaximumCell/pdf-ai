import { config } from "dotenv";

// Load environment variables first, before importing other modules
config();

import { getChunkedDocsFromPDF } from "./pdfLoader";
import { embedAndStoreDocs } from "./vectorStore";
import { getMongoClient } from "./mongo-client";
import { Document } from "langchain/document";

// This function orchestrates the entire process of
// loading a PDF, chunking it, embedding the chunks,
// and storing them in MongoDB Atlas Vector Search.
async function ingestAndStorePDF() {
    let client;

    try {
        // 1. Establish the database connection
        // Note: getMongoClient() is assumed to return a MongoClient instance
        // that is a wrapper around mongoose or a direct client connection.
        client = await getMongoClient();

        console.log("PDF loader process started.");

        // 2. Load and chunk the PDF document
        console.log("Preparing chunks from the PDF file...");
        const docs = await getChunkedDocsFromPDF();

        // Check if documents were successfully loaded
        if (!docs || docs.length === 0) {
            console.error("No documents found in the PDF. Exiting.");
            return;
        }

        console.log(`Loading ${docs.length} chunks into MongoDB...`);

        // 3. Embed the documents and store them
        // The embedAndStoreDocs function will handle calling the Gemini API
        // and saving the vectors to the specified MongoDB collection.
        // It is designed to work with LangChain's Document format.
        await embedAndStoreDocs(docs);

        console.log("Data embedded and stored in MongoDB Atlas.");

    } catch (error) {
        console.error("An error occurred during the ingestion process: ", error);
    }
}

// Execute the main function
(async () => {
    await ingestAndStorePDF();
})();