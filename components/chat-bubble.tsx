import Balancer from "react-wrap-balancer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import ReactMarkdown from "react-markdown";
import { formattedText } from "@/lib/utils";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
}

const wrappedText = (text: string) =>
    text.split('\n').map((line, index) => (
        <span key={index}>
            {line}
            <br />
        </span>
    ));

interface ChatBubbleProps extends Partial<Message> {
    sources: string[];
}

export function ChatBubble({ role, content, sources }: ChatBubbleProps) {
    if (!content) return null;
    const wrappedMessage = wrappedText(content);
    return (
        <div>
            <Card className="mb-2">
                <CardHeader>
                    <CardTitle className={role != "assistant" ? "text-amber-500 dark:text-amber-200" : "text-blue-500 dark:text-blue-200"}>
                        {role == "assistant" ? "Ai" : "You"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                    <Balancer>
                        {wrappedMessage}
                    </Balancer>
                </CardContent>
                <CardFooter>
                    <CardDescription className="w-full">
                        {sources && sources.length ? (
                            <Accordion type="single" collapsible className="w-full">
                                {sources.map((source, index) => (
                                    <AccordionItem key={index} value={`source-${index}`}>
                                        <AccordionTrigger>{`source-${index+1}`}</AccordionTrigger>
                                        <AccordionContent>{`Source ${index+1}`}</AccordionContent>
                                        <ReactMarkdown>{formattedText(source)}</ReactMarkdown>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : null}
                    </CardDescription>
                </CardFooter>
            </Card>
        </div>
    )
}