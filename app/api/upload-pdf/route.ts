import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { embedAndStoreDocs } from "@/lib/vectorStore";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('pdf') as File;
        const fileId = formData.get('fileId') as string;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!fileId) {
            return NextResponse.json({ error: "No file ID provided" }, { status: 400 });
        }

        // Validate file type
        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File size too large. Maximum 10MB allowed." }, { status: 400 });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), 'uploads');
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        // Save file temporarily
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = join(uploadsDir, `${fileId}-${file.name}`);
        await writeFile(filePath, buffer);

        // Process the PDF
        console.log(`Processing PDF: ${file.name}`);

        // Load and split the PDF
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const splitDocs = await textSplitter.splitDocuments(docs);

        console.log(`Split PDF into ${splitDocs.length} chunks`);

        // Debug: Check the content of the split documents
        if (splitDocs.length > 0) {
            console.log("Sample split document:", {
                pageContent: splitDocs[0]?.pageContent?.substring(0, 100),
                contentLength: splitDocs[0]?.pageContent?.length,
                metadata: splitDocs[0]?.metadata
            });
        }

        // Add metadata to identify this specific PDF with unique IDs
        const docsWithMetadata = splitDocs.map((doc, index) => ({
            ...doc,
            metadata: {
                ...doc.metadata,
                fileId: fileId,
                fileName: file.name,
                uploadedAt: new Date().toISOString(),
                chunkIndex: index, // Add unique index for each chunk
                documentId: `${fileId}_chunk_${index}` // Unique identifier
            }
        }));

        // Debug: Check the documents with metadata
        if (docsWithMetadata.length > 0) {
            console.log("Sample document with metadata:", {
                pageContent: docsWithMetadata[0]?.pageContent?.substring(0, 100),
                contentLength: docsWithMetadata[0]?.pageContent?.length,
                metadata: docsWithMetadata[0]?.metadata
            });
        }

        console.log(`Split PDF into ${splitDocs.length} chunks`);

        // Store in the main vectors collection (where the vector index exists)
        console.log(`Attempting to store in main vectors collection with fileId: ${fileId}`);
        try {
            await embedAndStoreDocs(docsWithMetadata); // Store in main collection, not custom per-PDF collection
            console.log(`✅ Successfully embedded and stored PDF: ${file.name}`);
        } catch (embedError) {
            console.error("❌ Error during embedding in custom collection:", embedError);
            console.log("Attempting to store in default collection as fallback...");

            try {
                // Fallback to default collection
                await embedAndStoreDocs(docsWithMetadata);
                console.log(`✅ Successfully stored PDF in default collection: ${file.name}`);
            } catch (fallbackError) {
                console.error("❌ Fallback to default collection also failed:", fallbackError);
                const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                throw new Error(`Failed to embed documents: ${errorMessage}`);
            }
        }

        // Clean up temporary file
        // You might want to keep it or move it to a permanent storage

        return NextResponse.json({
            success: true,
            fileId,
            fileName: file.name,
            chunks: splitDocs.length,
            message: "PDF processed successfully"
        });

    } catch (error) {
        console.error("Error processing PDF:", error);
        return NextResponse.json(
            { error: "Failed to process PDF" },
            { status: 500 }
        );
    }
}
