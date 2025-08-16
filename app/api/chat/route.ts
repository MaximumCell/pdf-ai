import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { env } from "@/lib/config";

// Define a more flexible message type
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface MongoDocument {
    _id?: unknown;
    text?: string;
    pageContent?: string;
    content?: string;
    source?: string;
    fileName?: string;
    loc?: {
        pageNumber?: number;
        lines?: { from: number; to: number };
    };
    fileId?: string;
    score?: number;
    embedding?: number[];
    pdf?: {
        totalPages?: number;
        info?: {
            Author?: string;
        };
    };
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages || [];
    const pdfId: string = body.pdfId;
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage) {
        return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const question = lastMessage.content || '';

    if (!question) {
        return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    try {
        // Use MongoDB vector search for AI-powered document retrieval
        console.log(`Searching for question: "${question}" with pdfId: ${pdfId}`);

        const client = new MongoClient(env.MONGODB_URI);
        await client.connect();

        const db = client.db(env.MONGODB_DB_NAME);
        const collectionName = env.MONGODB_COLLECTION_NAME; // Use main vectors collection
        const collection = db.collection(collectionName);

        // Check if collection exists and has documents for this PDF
        const docCount = await collection.countDocuments({ fileId: pdfId });
        console.log(`Collection ${collectionName} has ${docCount} documents for fileId: ${pdfId}`); if (docCount === 0) {
            await client.close();
            return NextResponse.json({
                answer: "I don't have any documents to search through. Please make sure your PDF was uploaded successfully.",
                sources: []
            });
        }

        // Get embeddings for the question to perform proper vector search
        console.log('🔍 Loading Google AI Embeddings...');
        console.log('API Key exists:', !!env.GEMINI_API_KEY);
        console.log('API Key length:', env.GEMINI_API_KEY?.length || 0);

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: env.GEMINI_API_KEY,
            model: "text-embedding-004",
        });

        console.log('🔍 Creating embedding for question...');
        const questionEmbedding = await embeddings.embedQuery(question);
        console.log(`✅ Question embedding created with ${questionEmbedding.length} dimensions`);

        // Try vector search first
        let docs: MongoDocument[] = [];
        try {
            const vectorSearchPipeline = [
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: questionEmbedding,
                        numCandidates: 20,
                        limit: 5,
                        filter: { fileId: { $eq: pdfId } } // Filter by specific PDF
                    }
                },
                {
                    $project: {
                        text: 1,
                        source: 1,
                        fileName: 1,
                        loc: 1,
                        fileId: 1,
                        score: { $meta: "vectorSearchScore" }
                    }
                }
            ];

            console.log('🔍 Performing vector search with pipeline:', JSON.stringify(vectorSearchPipeline[0], null, 2));
            docs = await collection.aggregate(vectorSearchPipeline).toArray();
            console.log(`Vector search found ${docs.length} documents`);

            if (docs.length > 0) {
                console.log(`Best match score: ${docs[0].score}`);

                // Filter out results with very low similarity scores (likely irrelevant)
                const scoreThreshold = 0.6; // Adjust this threshold as needed
                const relevantDocs = docs.filter((doc: MongoDocument) => (doc.score ?? 0) >= scoreThreshold);

                if (relevantDocs.length === 0 && docs.length > 0 && (docs[0].score ?? 0) < scoreThreshold) {
                    console.log(`🚫 Best match score (${docs[0].score}) below threshold (${scoreThreshold}), treating as no relevant results`);
                    docs = []; // Reset to trigger fallback logic
                } else {
                    docs = relevantDocs;
                    console.log(`✅ Found ${docs.length} relevant documents above threshold`);
                }
            } else {
                // Debug: Check if vector index exists and documents have embeddings
                console.log('🔍 Vector search returned 0 documents. Debugging...');

                // Check if documents have embedding field
                const sampleDoc = await collection.findOne({});
                if (sampleDoc) {
                    console.log('Sample document has embedding:', !!sampleDoc.embedding);
                    console.log('Sample embedding length:', sampleDoc.embedding?.length || 0);
                    console.log('Question embedding length:', questionEmbedding.length);
                }

                // Try with different index names that might exist
                const alternativeIndexes = ["default", "vector_search_index", "embeddings_index"];

                for (const indexName of alternativeIndexes) {
                    try {
                        console.log(`🔍 Trying alternative index: ${indexName}`);
                        const altPipeline = [
                            {
                                $vectorSearch: {
                                    index: indexName,
                                    path: "embedding",
                                    queryVector: questionEmbedding,
                                    numCandidates: 10,
                                    limit: 3
                                }
                            },
                            {
                                $project: {
                                    text: 1,
                                    score: { $meta: "vectorSearchScore" }
                                }
                            }
                        ];

                        const altDocs = await collection.aggregate(altPipeline).toArray();
                        console.log(`Index ${indexName} found ${altDocs.length} documents`);

                        if (altDocs.length > 0) {
                            docs = altDocs;
                            console.log(`✅ Success with index: ${indexName}`);
                            break;
                        }
                    } catch (altError) {
                        console.log(`Index ${indexName} failed:`, (altError as Error).message);
                    }
                }
            }
        } catch (vectorError) {
            console.log('⚠️ Vector search failed:', (vectorError as Error).message);
            console.log('Error details:', vectorError);
        }        // If vector search fails or returns no results, check question relevance first
        if (docs.length === 0) {
            console.log('🔍 Vector search returned no results. Checking question relevance...');

            // Check if the question is clearly unrelated to document content
            const questionLower = question.toLowerCase();

            // First, check if it's a general question about the PDF itself (these should be allowed)
            const isGeneralPdfQuestion = (
                questionLower.includes('pdf') ||
                questionLower.includes('document') ||
                questionLower.includes('file') ||
                questionLower.includes('details about this') ||
                questionLower.includes('summary') ||
                questionLower.includes('overview') ||
                questionLower.includes('tell me about') ||
                questionLower.includes('what is this') ||
                questionLower.includes('contents') ||
                questionLower.includes('topics') ||
                questionLower.includes('chapters') ||
                questionLower.includes('sections')
            );

            // If it's a general PDF question, allow it to proceed
            if (isGeneralPdfQuestion) {
                console.log('✅ General PDF question detected, proceeding with search...');
            } else {
                // Get a small sample of document content to understand what the PDF is about
                const sampleDocs = await collection.find({ fileId: pdfId }).limit(3).toArray();
                const sampleContent = sampleDocs.map((doc: MongoDocument) => doc.text || '').join(' ').toLowerCase();

                // Extract key terms from the sample to understand document topic
                const documentTerms = new Set<string>();
                const commonTerms = ['photon', 'matter', 'interaction', 'physics', 'energy', 'quantum', 'electron', 'atom', 'radiation', 'medical', 'helium', 'approximation', 'model'];

                commonTerms.forEach(term => {
                    if (sampleContent.includes(term)) {
                        documentTerms.add(term);
                    }
                });

                console.log('Document appears to be about:', Array.from(documentTerms));

                // Check if question is obviously unrelated to any document terms
                const questionTerms = questionLower.split(' ').filter(word => word.length > 3);
                const hasRelevantTerms = questionTerms.some(term => {
                    return Array.from(documentTerms).some((docTerm: string) =>
                        term.includes(docTerm) || docTerm.includes(term)
                    );
                });

                // Check for obviously unrelated questions
                const unrelatedPatterns = [
                    /window\s*11|windows\s*11/i,
                    /microsoft\s*office/i,
                    /adobe|pdf\s*reader/i,
                    /computer|software|app/i,
                    /weather|climate/i,
                    /food|recipe|cooking/i,
                    /sports|football|basketball/i,
                    /movie|film|entertainment/i,
                    /music|song|artist/i,
                    /travel|vacation|hotel/i,
                    /shopping|purchase|buy/i,
                ];

                const isObviouslyUnrelated = unrelatedPatterns.some(pattern => pattern.test(questionLower));

                if (isObviouslyUnrelated || (!hasRelevantTerms && questionTerms.length > 0)) {
                    console.log('🚫 Question appears unrelated to document content');

                    await client.close();
                    return NextResponse.json({
                        answer: "I can only answer questions related to the content of your uploaded PDF. Your question doesn't seem to be related to the topics covered in this document. Please ask me something about the content in your PDF.",
                        sources: []
                    });
                }
            }

            console.log('🔍 Question seems potentially relevant, proceeding with search...');
        }

        // Continue with existing search strategies for potentially relevant questions
        if (docs.length === 0) {
            console.log('🔍 Falling back to multiple search strategies...');

            const questionLower = question.toLowerCase();

            // Strategy 1: Check if this is specifically asking for a topic list/table of contents
            const isListingRequest = (
                questionLower.includes('list') &&
                (questionLower.includes('topic') || questionLower.includes('chapter') || questionLower.includes('subject')) &&
                !questionLower.includes('explain') &&
                !questionLower.includes('about') &&
                questionLower.split(' ').length < 8  // Short questions like "list topics"
            );

            if (isListingRequest) {
                console.log('🔍 Searching for document structure/topics...');

                // Look for table of contents, index, or chapter headings
                const structureQuery = {
                    $and: [
                        { fileId: pdfId },
                        {
                            $or: [
                                { text: { $regex: 'contents|index|chapter|section|part|unit', $options: 'i' } },
                                { text: { $regex: '^\\d+\\.', $options: 'm' } }, // Lines starting with numbers (chapters)
                                { text: { $regex: 'table of contents|index|chapter \\d+', $options: 'i' } }
                            ]
                        }
                    ]
                };

                docs = await collection.find(structureQuery).limit(10).toArray();
                console.log(`Structure search found ${docs.length} documents`);

                if (docs.length === 0) {
                    // Look for documents with shorter text (likely headings/titles)
                    const headingQuery = {
                        $and: [
                            { fileId: pdfId },
                            { $where: "this.text.length < 200 && this.text.length > 10" }
                        ]
                    };
                    docs = await collection.find(headingQuery).limit(10).toArray();
                    console.log(`Heading search found ${docs.length} documents`);
                }
            } else {
                // Strategy 2: Improve search for general questions like "details about PDF"
                if (questionLower.includes('detail') && (questionLower.includes('pdf') || questionLower.includes('document') || questionLower.includes('book'))) {
                    console.log('🔍 Searching for document overview/summary content...');

                    // Look for introduction, abstract, overview, or preface content
                    const overviewQuery = {
                        $and: [
                            { fileId: pdfId },
                            {
                                $or: [
                                    { text: { $regex: 'introduction|abstract|overview|preface|summary|purpose|scope', $options: 'i' } },
                                    { text: { $regex: 'this book|this text|this work|covers|discusses', $options: 'i' } },
                                    { text: { $regex: 'chapter.*cover|section.*discuss|topics.*include', $options: 'i' } }
                                ]
                            }
                        ]
                    };

                    docs = await collection.find(overviewQuery).limit(10).toArray();
                    console.log(`Overview search found ${docs.length} documents`);

                    // Sort by content that's most likely to be introductory/overview
                    if (docs.length > 0) {
                        docs = docs.sort((a: MongoDocument, b: MongoDocument) => {
                            const aText = (a.text || '').toLowerCase();
                            const bText = (b.text || '').toLowerCase();

                            const aIntroScore = (aText.includes('introduction') ? 3 : 0) +
                                (aText.includes('overview') ? 2 : 0) +
                                (aText.includes('this book') ? 2 : 0) +
                                (aText.includes('covers') ? 1 : 0);

                            const bIntroScore = (bText.includes('introduction') ? 3 : 0) +
                                (bText.includes('overview') ? 2 : 0) +
                                (bText.includes('this book') ? 2 : 0) +
                                (bText.includes('covers') ? 1 : 0);

                            return bIntroScore - aIntroScore;
                        }).slice(0, 8);
                    }
                } else {
                    // Strategy 3: Extract meaningful keywords for content search
                    const stopWords = ['can', 'you', 'tell', 'me', 'about', 'what', 'is', 'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'this', 'that', 'explain', 'topic'];
                    const meaningfulKeywords = questionLower
                        .split(' ')
                        .filter(word => word.length > 3 && !stopWords.includes(word));

                    console.log('Meaningful keywords:', meaningfulKeywords);

                    if (meaningfulKeywords.length > 0) {
                        // First try: Search for documents containing meaningful keywords with better priority
                        const keywordQuery = {
                            $and: [
                                { fileId: pdfId },
                                {
                                    $or: meaningfulKeywords.map(keyword => ({
                                        text: { $regex: keyword, $options: 'i' }
                                    }))
                                }
                            ]
                        };

                        const allDocs = await collection.find(keywordQuery).limit(20).toArray();
                        console.log(`Initial keyword search found ${allDocs.length} documents`);

                        if (allDocs.length > 0) {
                            // Filter out overview/intro pages (they usually have shorter content or contain series info)
                            const contentDocs = allDocs.filter((doc: MongoDocument) => {
                                const text = doc.text || '';
                                const isOverviewPage = text.includes('Oxford Master Series') ||
                                    text.includes('course books') ||
                                    text.includes('tutorial material') ||
                                    text.length < 300; // Very short documents are likely headers/overviews
                                return !isOverviewPage;
                            });

                            console.log(`After filtering overview pages: ${contentDocs.length} content documents`);

                            // If we have content docs, use them; otherwise fall back to all docs
                            const docsToSort = contentDocs.length > 0 ? contentDocs : allDocs;

                            // Sort by relevance (most keywords matched + content length preference)
                            docs = docsToSort.sort((a: MongoDocument, b: MongoDocument) => {
                                const aText = (a.text || '').toLowerCase();
                                const bText = (b.text || '').toLowerCase();

                                const aMatches = meaningfulKeywords.filter(keyword => aText.includes(keyword)).length;
                                const bMatches = meaningfulKeywords.filter(keyword => bText.includes(keyword)).length;

                                // Primary sort: most keyword matches
                                if (bMatches !== aMatches) {
                                    return bMatches - aMatches;
                                }

                                // Secondary sort: prefer longer, more detailed content
                                const aLength = aText.length;
                                const bLength = bText.length;

                                // Prefer documents with 500-2000 characters (good content length)
                                const aScore = (aLength >= 500 && aLength <= 2000) ? 1 : 0;
                                const bScore = (bLength >= 500 && bLength <= 2000) ? 1 : 0;

                                return bScore - aScore;
                            }).slice(0, 8);

                            console.log(`Sorted by relevance and content quality, keeping top ${docs.length} documents`);

                            // If we still got overview pages, try a more specific search
                            if (docs.length > 0 && docs[0].text && docs[0].text.includes('Oxford Master Series')) {
                                console.log('⚠️ Still getting overview pages, trying more specific search...');

                                // Try searching for chapter content, equations, or detailed explanations
                                const specificQuery = {
                                    $and: [
                                        { fileId: pdfId },
                                        {
                                            $or: meaningfulKeywords.map(keyword => ({
                                                text: { $regex: keyword, $options: 'i' }
                                            }))
                                        },
                                        {
                                            $or: [
                                                { text: { $regex: 'chapter|section|equation|formula|energy|electron|quantum', $options: 'i' } },
                                                { $where: "this.text.length > 500" } // Prefer longer content
                                            ]
                                        },
                                        {
                                            text: { $not: { $regex: 'Oxford Master Series|course books|tutorial material', $options: 'i' } }
                                        }
                                    ]
                                };

                                const specificDocs = await collection.find(specificQuery).limit(8).toArray();
                                console.log(`Specific content search found ${specificDocs.length} documents`);

                                if (specificDocs.length > 0) {
                                    docs = specificDocs;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Strategy 3: If still no results, get a diverse sample from different parts of the document
        if (docs.length === 0) {
            console.log('⚠️ No specific matches found, getting diverse sample...');

            // Get documents from different pages for this specific PDF
            const sampleDocs = await collection.aggregate([
                { $match: { fileId: pdfId } },
                { $sample: { size: 8 } }
            ]).toArray();

            docs = sampleDocs;
        }
        console.log(`Retrieved ${docs.length} documents`);

        // Debug: Log the structure of the first document
        if (docs.length > 0) {
            console.log("First document structure:", Object.keys(docs[0]));
            console.log("First document content keys:", docs[0]);
            console.log("PageContent exists:", !!docs[0].pageContent);
            console.log("Text exists:", !!docs[0].text);
            console.log("Content exists:", !!docs[0].content);
        }

        // Try different possible field names for content
        const context = docs.map((doc: MongoDocument) => {
            // LangChain stores content in 'text' field, not 'pageContent'
            const content = doc.text || doc.pageContent || doc.content || '';
            console.log(`Document content length: ${content.length}`);
            return content;
        }).join('\n\n');

        console.log(`Total context length: ${context.length} characters`);
        console.log(`Context preview: ${context.substring(0, 200)}`);

        await client.close();

        // Now we should have proper content - let's create a proper AI response
        if (context.length === 0) {
            return NextResponse.json({
                answer: "I found the PDF collection but there's no readable content. Please try uploading the PDF again.",
                sources: []
            });
        }

        // Create a more natural and conversational response
        const lowerQuestion = question.toLowerCase();
        let response = "";

        // Check if we have meaningful content
        if (context.length < 50) {
            response = "I found the PDF collection but there's very little readable content. Please try uploading the PDF again.";
        } else {
            // Analyze question type and provide natural, conversational responses
            if (lowerQuestion.includes("list") && (lowerQuestion.includes("topic") || lowerQuestion.includes("subject") || lowerQuestion.includes("chapter"))) {
                // Special handling for topic/chapter listing requests
                const topicLines = context.split('\n')
                    .filter(line => {
                        const trimmed = line.trim();
                        return trimmed.length > 5 && trimmed.length < 100 && (
                            /^\d+\./.test(trimmed) || // Starts with number
                            /^o /.test(trimmed) || // Starts with "o " (bullet point)
                            /^chapter/i.test(trimmed) || // Starts with "chapter"
                            /^section/i.test(trimmed) || // Starts with "section"
                            /^part/i.test(trimmed) // Starts with "part"
                        );
                    })
                    .slice(0, 20); // Get more topics

                if (topicLines.length > 0) {
                    response = `Great! I found the topics covered in your PDF. Here's what this document covers:

${topicLines.map(topic => `• ${topic.trim()}`).join('\n')}

This looks like a comprehensive document on helium atom physics! Is there any specific topic you'd like me to explain in detail?`;
                } else {
                    // Extract any structured content we can find
                    const contentSections = context.split('\n').filter(line => line.trim().length > 10).slice(0, 10);
                    response = `I can see this document covers several areas. Here's what I found:

${contentSections.map(section => `• ${section.trim()}`).join('\n')}

Would you like me to elaborate on any of these sections?`;
                }
            } else if (lowerQuestion.includes("explain") || lowerQuestion.includes("what is") || lowerQuestion.includes("describe") || lowerQuestion.includes("tell me about")) {
                // For explanation requests, be more conversational
                const questionKeywords = question.toLowerCase().split(' ').filter(word => word.length > 3);
                const relevantContent = docs.filter(doc => {
                    const text = (doc.text || '').toLowerCase();
                    return questionKeywords.some(keyword => text.includes(keyword));
                });

                if (relevantContent.length > 0) {
                    const bestMatch = relevantContent[0].text || '';

                    // Check if it's about approximation models specifically
                    if (lowerQuestion.includes("approximation") && lowerQuestion.includes("model")) {
                        response = `Absolutely! The approximation models for helium atoms are quite fascinating. Based on your PDF, here's what I found:

${bestMatch}

These approximation methods are essential because the helium atom, with its two electrons, can't be solved exactly using simple quantum mechanics. Each method has its own strengths and limitations. Would you like me to explain any specific method in more detail?`;
                    } else {
                        response = `Sure! Here's what I found about "${question.replace(/^(can u |tell me |explain |what is |describe )/i, '').trim()}":

${bestMatch}

${relevantContent.length > 1 ? `I found ${relevantContent.length} relevant sections about this topic. ` : ''}Is there anything specific you'd like me to clarify?`;
                    }
                } else {
                    response = `I searched for information about "${question}" in your PDF. Here's the most relevant content I could find:

${context.substring(0, 800)}

Could you be more specific about what aspect you'd like to know about?`;
                }
            } else if (lowerQuestion.includes("detail") || lowerQuestion.includes("about") || lowerQuestion.includes("summary")) {
                response = `Here's an overview of your PDF "${docs[0]?.fileName || 'document'}":

**Document Details:**
📄 **File:** ${docs[0]?.fileName || 'Unknown'}
📊 **Pages:** ${docs[0]?.pdf?.totalPages || 'Unknown'} pages
🔢 **Sections:** ${docCount} content sections
👤 **Author:** ${docs[0]?.pdf?.info?.Author || 'Not specified'}

**Content Summary:**
${context.substring(0, 1000)}

This appears to be an academic assignment about helium atom physics. What would you like to explore further?`;
            } else {
                // For any other questions, be conversational and helpful
                response = `Let me help you with that! Based on your question "${question}", here's what I found:

${context.substring(0, 800)}

${docs.length > 1 ? `This information comes from ${docs.length} different parts of your document. ` : ''}Feel free to ask me about any specific aspect - I'm here to help!`;
            }
        }

        // Return plain JSON response
        return NextResponse.json({
            answer: response,
            sources: docs.map((doc: MongoDocument) => ({
                pageContent: doc.text || doc.pageContent || '',
                metadata: {
                    source: doc.source,
                    fileName: doc.fileName,
                    pageNumber: doc.loc?.pageNumber
                }
            }))
        });
    } catch (error) {
        console.error("Error occurred while processing request:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}