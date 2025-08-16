'use client';

import { useState } from 'react';
import { PDFUpload } from '@/components/pdf-upload';
import { Chat } from '@/components/chat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, MessageCircle, Plus, X } from 'lucide-react';

interface UploadedPDF {
    id: string;
    name: string;
    status: 'uploading' | 'processing' | 'ready' | 'error';
    size: number;
    uploadedAt: Date;
}

export function PDFChatApp() {
    const [pdfs, setPdfs] = useState<UploadedPDF[]>([]);
    const [selectedPDF, setSelectedPDF] = useState<string | null>(null);
    const [showUpload, setShowUpload] = useState(true);

    const handlePDFReady = (pdf: UploadedPDF) => {
        setPdfs(prev => {
            const updated = prev.map(p => p.id === pdf.id ? pdf : p);
            if (!updated.find(p => p.id === pdf.id)) {
                updated.push(pdf);
            }
            return updated;
        });

        // Auto-select the first ready PDF
        if (!selectedPDF) {
            setSelectedPDF(pdf.id);
            setShowUpload(false);
        }
    };

    const readyPDFs = pdfs.filter(pdf => pdf.status === 'ready');

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="p-3 bg-blue-600 rounded-xl text-white">
                        <FileText className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        AI PDF Assistant
                    </h1>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Upload your PDFs and have intelligent conversations with your documents using advanced AI
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-300px)]">
                {/* Left Sidebar - PDF Management */}
                <div className="lg:col-span-1 space-y-4 overflow-y-auto">
                    {/* Upload Section */}
                    {showUpload && (
                        <div className="sticky top-0 z-10">
                            <PDFUpload onPDFReady={handlePDFReady} />
                        </div>
                    )}

                    {/* PDF Library */}
                    {readyPDFs.length > 0 && (
                        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        Your PDFs ({readyPDFs.length})
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowUpload(!showUpload)}
                                        className="h-8 w-8 p-0"
                                    >
                                        {showUpload ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                                {readyPDFs.map((pdf) => (
                                    <div
                                        key={pdf.id}
                                        className={`group p-3 border rounded-lg cursor-pointer transition-all duration-200 ${selectedPDF === pdf.id
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md'
                                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        onClick={() => setSelectedPDF(pdf.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${selectedPDF === pdf.id
                                                ? 'bg-blue-100 dark:bg-blue-900'
                                                : 'bg-gray-100 dark:bg-gray-600 group-hover:bg-blue-100 dark:group-hover:bg-blue-900'
                                                }`}>
                                                <FileText className={`w-4 h-4 ${selectedPDF === pdf.id ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'
                                                    }`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
                                                    {pdf.name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatFileSize(pdf.size)} • Ready
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Main Chat Area */}
                <div className="lg:col-span-3 flex flex-col">
                    {selectedPDF ? (
                        <Card className="flex-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 flex flex-col">
                            <CardHeader className="border-b bg-white/50 dark:bg-gray-800/50 rounded-t-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                                        <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                                            Chat with PDF
                                        </CardTitle>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-md">
                                            {readyPDFs.find(p => p.id === selectedPDF)?.name}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 flex flex-col min-h-0">
                                <Chat selectedPDFId={selectedPDF} />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="flex-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 flex items-center justify-center">
                            <CardContent className="text-center space-y-6 p-8">
                                <div className="space-y-4">
                                    <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                        <FileText className="w-12 h-12 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                            Ready to Chat!
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                                            {readyPDFs.length === 0
                                                ? "Upload your first PDF to start having intelligent conversations with your documents"
                                                : "Select a PDF from your library to start chatting"
                                            }
                                        </p>
                                    </div>
                                    {readyPDFs.length === 0 && !showUpload && (
                                        <Button
                                            onClick={() => setShowUpload(true)}
                                            className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Upload PDF
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
