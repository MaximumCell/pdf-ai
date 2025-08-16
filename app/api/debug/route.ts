import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { env } from "@/lib/config";

interface DebugResult {
    collections: Array<{
        name: string;
        documents: number;
    }>;
    totalDocuments: number;
}

export async function GET() {
    try {
        const client = new MongoClient(env.MONGODB_URI);
        await client.connect();

        const db = client.db(env.MONGODB_DB_NAME);

        // Get all collections
        const collections = await db.listCollections().toArray();

        const result: DebugResult = {
            collections: [],
            totalDocuments: 0
        };

        for (const col of collections) {
            const collection = db.collection(col.name);
            const count = await collection.countDocuments();
            result.collections.push({
                name: col.name,
                documents: count
            });
            result.totalDocuments += count;
        }

        await client.close();

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error checking database:", error);
        return NextResponse.json({ error: "Failed to check database" }, { status: 500 });
    }
}
