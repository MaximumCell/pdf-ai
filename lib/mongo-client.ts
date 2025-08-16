import mongoose from "mongoose";
import { env } from "./config";

let mongoClientInstance: mongoose.Connection | null = null;

// Define vector document schema
const VectorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    vector: { type: [Number], required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Create index for vector search (you might want to use MongoDB Atlas Vector Search for better performance)
VectorSchema.index({ id: 1 });
VectorSchema.index({ "metadata.source": 1 });

const VectorModel = mongoose.models.Vector || mongoose.model('Vector', VectorSchema);

// Initialize MongoDB connection
async function initMongoClient() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(env.MONGODB_URI);
            console.log("MongoDB connected successfully!");
        }
        return mongoose.connection;
    } catch (error) {
        console.error("MongoDB connection error:", error);
        throw new Error("Failed to initialize MongoDB Client");
    }
}

export async function getMongoClient() {
    if (!mongoClientInstance) {
        mongoClientInstance = await initMongoClient();
    }
    return mongoClientInstance;
}

interface VectorDocument {
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
    text: string;
    createdAt?: Date;
    score?: number;
}

// Insert vectors into MongoDB
export async function insertVectors(vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, unknown>;
    text: string;
}>) {
    await getMongoClient();
    const docs = vectors.map(v => ({
        id: v.id,
        vector: v.values,
        metadata: v.metadata,
        text: v.text
    }));

    return await VectorModel.insertMany(docs);
}

// Query vectors using MongoDB Atlas Vector Search
export async function queryVectors(
    vector: number[],
    topK: number = 5,
    filter?: Record<string, unknown>
) {
    await getMongoClient();

    // Use MongoDB Atlas Vector Search aggregation pipeline
    const pipeline = [
        {
            $vectorSearch: {
                index: "vector_index", // Name of your vector search index
                path: "vector",
                queryVector: vector,
                numCandidates: topK * 10, // Should be 10-20x topK for better results
                limit: topK,
                ...(filter && { filter })
            }
        },
        {
            $project: {
                _id: 0,
                id: 1,
                text: 1,
                metadata: 1,
                score: { $meta: "vectorSearchScore" }
            }
        }
    ];

    const results = await VectorModel.aggregate(pipeline);
    return results;
}

// Fallback function for basic cosine similarity (if Atlas Vector Search is not available)
export async function queryVectorsBasic(
    vector: number[],
    topK: number = 5,
    filter?: Record<string, unknown>
) {
    await getMongoClient();

    // This is a basic implementation for development/testing
    const query = filter ? { ...filter } : {};
    const results = await VectorModel.find(query).limit(topK * 5).lean(); // Get more docs to sort

    // Calculate cosine similarity
    const resultsWithScore = results.map((doc) => {
        const similarity = cosineSimilarity(vector, doc.vector);
        return {
            id: doc.id,
            score: similarity,
            metadata: doc.metadata,
            text: doc.text
        };
    });

    // Sort by similarity score and return top K
    return resultsWithScore
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, topK);
}

// Helper function for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

// Delete vectors by filter
export async function deleteVectors(filter: Record<string, unknown>) {
    await getMongoClient();
    return await VectorModel.deleteMany(filter);
}