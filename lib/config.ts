import z from "zod";

const envSchema = z.object({
    GEMINI_API_KEY: z.string().min(1).max(100),
    MONGODB_URI: z.string().min(1).max(500),
    PDF_PATH: z.string().min(1).max(500).optional(),
    MONGODB_DB_NAME: z.string().min(1).max(100),
    MONGODB_COLLECTION_NAME: z.string().min(1).max(100),
    MONGODB_INDEX_NAME: z.string().min(1).max(100),
});

let _env: z.infer<typeof envSchema> | null = null;

export function getEnv() {
    if (!_env) {
        _env = envSchema.parse(process.env);
    }
    return _env;
}

// For backward compatibility, export env that gets initialized lazily
export const env = new Proxy({} as z.infer<typeof envSchema>, {
    get(target, prop) {
        const envData = getEnv();
        return envData[prop as keyof typeof envData];
    }
});