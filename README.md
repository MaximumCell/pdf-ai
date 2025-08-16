# 🤖 AI PDF Assistant

An intelligent PDF document assistant that allows you to upload PDFs and have conversational interactions with your documents using advanced AI.

## ✨ Features

- 📄 **PDF Upload & Processing** - Upload and process PDF documents with automatic chunking
- 🧠 **AI-Powered Chat** - Have intelligent conversations about your PDF content
- 🔍 **Vector Search** - Advanced semantic search using MongoDB Atlas Vector Search
- 🌙 **Dark/Light Mode** - Beautiful UI with theme switching
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- 🚀 **Real-time Responses** - Fast AI responses with streaming support

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI/ML**: Google Gemini API, LangChain
- **Database**: MongoDB Atlas with Vector Search
- **Deployment**: Vercel
- **File Processing**: PDF parsing and chunking

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- Google AI Studio API key

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/MaximumCell/pdf-ai.git
   cd pdf-ai
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in your environment variables:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   MONGODB_URI=your_mongodb_atlas_connection_string
   MONGODB_DB_NAME=pdf-ai-db
   MONGODB_COLLECTION_NAME=vectors
   MONGODB_INDEX_NAME=vector_index
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🌐 Deployment on Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/MaximumCell/pdf-ai)

### Manual Deployment

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables in Vercel dashboard
   - Deploy!

### Environment Variables for Vercel

Add these environment variables in your Vercel dashboard:

- `GEMINI_API_KEY` - Your Google AI Studio API key
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `MONGODB_DB_NAME` - Database name (pdf-ai-db)
- `MONGODB_COLLECTION_NAME` - Collection name (vectors)
- `MONGODB_INDEX_NAME` - Vector search index name (vector_index)

## 📋 Setup Requirements

### MongoDB Atlas Vector Search

1. Create a MongoDB Atlas cluster
2. Create a database named `pdf-ai-db`
3. Create a collection named `vectors`
4. Create a vector search index named `vector_index` with:
   - **Vector field**: `embedding`
   - **Dimensions**: `768`
   - **Similarity**: `cosine`

### Google AI Studio

1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add it to your environment variables

## 🎯 Usage

1. **Upload a PDF** - Drag and drop or click to upload your PDF document
2. **Wait for Processing** - The app will chunk and embed your document
3. **Start Chatting** - Ask questions about your PDF content
4. **Explore Sources** - View relevant document sections for each response

## 🏗️ Architecture

- **Frontend**: React components with Tailwind CSS styling
- **API Routes**: Next.js API routes handle file upload and chat requests
- **Vector Store**: MongoDB Atlas stores document chunks with embeddings
- **AI Processing**: Google Gemini for embeddings and chat responses
- **File Handling**: PDF parsing and intelligent chunking

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🔗 Links

- **GitHub**: [https://github.com/MaximumCell/pdf-ai](https://github.com/MaximumCell/pdf-ai)
- **Author**: [MaximumCell](https://github.com/MaximumCell)

---

Built with ❤️ using Next.js and AI
