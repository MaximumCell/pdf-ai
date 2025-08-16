'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ChatLine } from './chat-line';
import { scrollToBottom, initialMessages, getSources } from "@/lib/utils";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Array<{
        pageContent?: string;
        content?: string;
        metadata?: {
            source?: string;
            fileName?: string;
            pageNumber?: number;
        };
    }>;
}

interface ChatProps {
    selectedPDFId?: string;
}

export function Chat({ selectedPDFId }: ChatProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<Array<{ sources: string[] }>>([]);

    // Reset messages when a new PDF is selected
    useEffect(() => {
        if (selectedPDFId) {
            setMessages(initialMessages);
            setData([]);
        }
    }, [selectedPDFId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        setTimeout(() => {
            if (containerRef.current) {
                scrollToBottom(containerRef as React.RefObject<HTMLElement>);
            }
        }, 100);
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
        };

        setMessages([...messages, newMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [...messages, newMessage],
                    pdfId: selectedPDFId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.answer,
                sources: data.sources,
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Store sources data for getSources utility
            if (data.sources) {
                setData(prev => [...prev, { sources: data.sources.map((s: unknown) => String(s)) }]);
            }
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request.',
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto" ref={containerRef}>
                <div className="space-y-4">
                    {messages.map((message, index) => (
                        <ChatLine
                            key={message.id}
                            role={message.role}
                            content={message.content}
                            sources={data?.length ? getSources(data, message.role, index) : message.sources || []}
                        />
                    ))}
                    {isLoading && (
                        <div className="flex justify-center py-4">
                            <Spinner />
                        </div>
                    )}
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t bg-white/50 dark:bg-gray-800/50 p-4">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question about your PDF..."
                        disabled={isLoading}
                        className="flex-1 bg-white dark:bg-gray-900"
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isLoading ? <Spinner /> : "Send"}
                    </Button>
                </form>
            </div>
        </div>
    );
}