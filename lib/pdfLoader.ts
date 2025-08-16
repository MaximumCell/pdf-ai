import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { env } from "./config";

export async function getChunkedDocsFromPDF() {
    try {
        const pdfPath = env.PDF_PATH;
        if (!pdfPath) {
            throw new Error("PDF_PATH is not defined in environment variables");
        }

        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunkedDocs = await splitter.splitDocuments(docs);
        return chunkedDocs;
    } catch (error) {
        console.error("Error loading or processing PDF:", error);
        throw new Error("Failed to get chunked documents from PDF");
    }
}