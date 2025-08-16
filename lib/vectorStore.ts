import { MongoClient } from "mongodb";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { Document } from 'langchain/document';
import { env } from './config';

export async function embedAndStoreDocs(docs: Document<Record<string, any>>[], customCollectionName?: string) {
    const mongoUri = env.MONGODB_URI;
    const dbName = env.MONGODB_DB_NAME;
    const collectionName = customCollectionName || env.MONGODB_COLLECTION_NAME;
    const googleApiKey = env.GEMINI_API_KEY;
    const indexName = env.MONGODB_INDEX_NAME;

    const client = new MongoClient(mongoUri);

    try {
        console.log(`Connecting to MongoDB: ${mongoUri.split('@')[1]}`);
        await client.connect();
        console.log("✅ Connected to MongoDB!");

        const collection = client.db(dbName).collection(collectionName);
        console.log(`Using collection: ${collectionName} in database: ${dbName}`);

        const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: googleApiKey });
        console.log("✅ Google AI Embeddings initialized");

        // Check if documents with this fileId already exist
        const firstDoc = docs[0];
        const fileId = firstDoc?.metadata?.fileId;

        if (fileId) {
            const existingCount = await collection.countDocuments({ fileId: fileId });
            if (existingCount > 0) {
                console.log(`⚠️ Found ${existingCount} existing documents for fileId: ${fileId}`);
                console.log("Deleting existing documents before storing new ones...");
                await collection.deleteMany({ fileId: fileId });
                console.log("✅ Existing documents deleted");
            }
        }

        // This single method handles both embedding and storage
        console.log(`Storing ${docs.length} documents...`);
        await MongoDBAtlasVectorSearch.fromDocuments(
            docs,
            embeddings,
            {
                collection,
                indexName,
            }
        );

        console.log(`✅ Documents embedded and stored successfully in collection: ${collectionName}!`);
    } catch (error) {
        console.error("❌ Error embedding and storing documents:", error);
        throw error; // Re-throw to let the caller handle it
    } finally {
        await client.close();
        console.log("MongoDB connection closed");
    }
}

// Example function to retrieve the vector store for querying
export async function getVectorStore(customCollectionName?: string) {
    const mongoUri = env.MONGODB_URI;
    const dbName = env.MONGODB_DB_NAME;
    const collectionName = customCollectionName || env.MONGODB_COLLECTION_NAME;
    const googleApiKey = env.GEMINI_API_KEY;
    const indexName = env.MONGODB_INDEX_NAME;

    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        const collection = client.db(dbName).collection(collectionName);
        const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: googleApiKey });

        const vectorStore = new MongoDBAtlasVectorSearch(
            embeddings,
            {
                collection,
                indexName,
            }
        );

        // Don't close the client here - let the vector store manage the connection
        return vectorStore;
    } catch (error) {
        console.error('Something went wrong while getting the vector store:', error);
        await client.close();
        throw new Error('Failed to get vector store!');
    }
}