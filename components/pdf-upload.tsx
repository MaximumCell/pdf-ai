'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface UploadedPDF {
    id: string;
    name: string;
    status: 'uploading' | 'processing' | 'ready' | 'error';
    size: number;
    uploadedAt: Date;
}

interface PDFUploadProps {
    onPDFReady: (pdf: UploadedPDF) => void;
}

export function PDFUpload({ onPDFReady }: PDFUploadProps) {
    const [files, setFiles] = useState<UploadedPDF[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;

        Array.from(selectedFiles).forEach(file => {
            if (file.type === 'application/pdf') {
                const newPDF: UploadedPDF = {
                    id: Date.now().toString() + Math.random(),
                    name: file.name,
                    status: 'uploading',
                    size: file.size,
                    uploadedAt: new Date(),
                };

                setFiles(prev => [...prev, newPDF]);
                processFile(file, newPDF.id);
            }
        });
    };

    const processFile = async (file: File, fileId: string) => {
        try {
            // Update status to processing
            setFiles(prev => prev.map(f =>
                f.id === fileId ? { ...f, status: 'processing' as const } : f
            ));

            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('fileId', fileId);

            const response = await fetch('/api/upload-pdf', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();

            // Update status to ready
            const updatedPDF = {
                id: fileId,
                name: file.name,
                status: 'ready' as const,
                size: file.size,
                uploadedAt: new Date(),
            };

            setFiles(prev => prev.map(f =>
                f.id === fileId ? updatedPDF : f
            ));

            onPDFReady(updatedPDF);

        } catch (error) {
            console.error('Error processing file:', error);
            setFiles(prev => prev.map(f =>
                f.id === fileId ? { ...f, status: 'error' as const } : f
            ));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusIcon = (status: UploadedPDF['status']) => {
        switch (status) {
            case 'uploading':
            case 'processing':
                return <Spinner />;
            case 'ready':
                return '✅';
            case 'error':
                return '❌';
        }
    };

    const getStatusText = (status: UploadedPDF['status']) => {
        switch (status) {
            case 'uploading':
                return 'Uploading...';
            case 'processing':
                return 'Processing & embedding...';
            case 'ready':
                return 'Ready for questions';
            case 'error':
                return 'Error occurred';
        }
    };

    return (
        <Card className="w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>
                    Upload PDF
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload Area */}
                <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="space-y-2">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                                Drop your PDF here
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                or click to browse files
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                Supports PDF files up to 10MB
                            </p>
                        </div>
                        <Input
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={(e) => handleFileSelect(e.target.files)}
                            className="hidden"
                            id="pdf-upload"
                        />
                        <Button
                            onClick={() => document.getElementById('pdf-upload')?.click()}
                            variant="outline"
                            className="mt-3 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-950"
                        >
                            Choose Files
                        </Button>
                    </div>
                </div>

                {/* File List */}
                {files.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Processing Files</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                                >
                                    <div className="flex-shrink-0">
                                        {getStatusIcon(file.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatFileSize(file.size)} • {getStatusText(file.status)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
