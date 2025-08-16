import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { env } from "@/lib/config";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { question, pdfId } = body;

        console.log(`Searching for: "${question}" in PDF: ${pdfId || 'default'}`);

        const client = new MongoClient(env.MONGODB_URI);
        await client.connect();

        const db = client.db(env.MONGODB_DB_NAME);
        const collectionName = pdfId ? `pdf_${pdfId}` : env.MONGODB_COLLECTION_NAME;
        const collection = db.collection(collectionName);

        // Check if collection exists and has documents
        const docCount = await collection.countDocuments();
        console.log(`Collection ${collectionName} has ${docCount} documents`);

        if (docCount === 0) {
            await client.close();
            return NextResponse.json({
                answer: "I don't have any documents to search through. Please upload a PDF first.",
                sources: [],
                debug: { collectionName, docCount }
            });
        }

        // Get all documents (for now, as a fallback)
        const allDocs = await collection.find({}).limit(10).toArray();
        console.log(`Retrieved ${allDocs.length} documents for text search`);

        // Simple text search through document content
        const relevantDocs = allDocs.filter(doc =>
            doc.pageContent &&
            doc.pageContent.toLowerCase().includes(question.toLowerCase().split(' ')[0])
        );

        console.log(`Found ${relevantDocs.length} potentially relevant documents`);

        // Create context from relevant documents
        const context = relevantDocs.length > 0
            ? relevantDocs.map(doc => doc.pageContent).join('\n\n')
            : allDocs.slice(0, 3).map(doc => doc.pageContent).join('\n\n');

        console.log(`Context length: ${context.length} characters`);

        await client.close();

        // Simple response for now
        const answer = relevantDocs.length > 0
            ? `Based on the uploaded PDF, I found relevant information. Here's what I can tell you: ${context.substring(0, 500)}...`
            : `I found ${docCount} documents in your PDF but couldn't find specific matches. Here's some content from your PDF: ${context.substring(0, 500)}...`;

        return NextResponse.json({
            answer,
            sources: relevantDocs.map(doc => ({
                content: doc.pageContent,
                metadata: doc.metadata
            })),
            debug: {
                collectionName,
                docCount,
                relevantDocs: relevantDocs.length,
                contextLength: context.length
            }
        });

    } catch (error) {
        console.error("Error in simple search:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: "Search failed",
            details: errorMessage
        }, { status: 500 });
    }
}
