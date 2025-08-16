import Balancer from "react-wrap-balancer";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import { formattedText } from "@/lib/utils";

const convertNewLines = (text: string) =>
    text.split("\n").map((line, i) => (
        <span key={i}>
            {line}
            <br />
        </span>
    ));

interface Source {
    pageContent?: string;
    content?: string;
    metadata?: {
        source?: string;
        fileName?: string;
        pageNumber?: number;
    };
}

interface ChatLineProps {
    role?: "user" | "assistant";
    content?: string;
    sources: (string | Source)[]; // Changed from any[] to proper union type
}

export function ChatLine({
    role = "assistant",
    content,
    sources,
}: ChatLineProps) {
    if (!content) {
        return null;
    }
    const formattedMessage = convertNewLines(content);

    return (
        <div>
            <Card className="mb-2">
                <CardHeader>
                    <CardTitle
                        className={
                            role != "assistant"
                                ? "text-amber-500 dark:text-amber-200"
                                : "text-blue-500 dark:text-blue-200"
                        }
                    >
                        {role == "assistant" ? "AI" : "You"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                    <Balancer>{formattedMessage}</Balancer>
                </CardContent>
                <CardFooter>
                    <CardDescription className="w-full">
                        {sources && sources.length ? (
                            <Accordion type="single" collapsible className="w-full">
                                {sources.map((source, index) => {
                                    // Handle both string sources and document objects
                                    const sourceText = typeof source === 'string'
                                        ? source
                                        : (source as Source)?.pageContent || (source as Source)?.content || JSON.stringify(source);

                                    return (
                                        <AccordionItem value={`source-${index}`} key={index}>
                                            <AccordionTrigger>{`Source ${index + 1}`}</AccordionTrigger>
                                            <AccordionContent>
                                                <ReactMarkdown
                                                    components={{
                                                        a: ({ href, children }) => (
                                                            <a href={href} target="_blank" rel="noopener noreferrer">
                                                                {children}
                                                            </a>
                                                        ),
                                                    }}
                                                >
                                                    {formattedText(sourceText)}
                                                </ReactMarkdown>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        ) : (
                            <></>
                        )}
                    </CardDescription>
                </CardFooter>
            </Card>
        </div>
    );
}
