# 📄 Expense Tracker Backend API

A robust Node.js backend server that provides OCR (Optical Character Recognition) services for extracting financial information from PDF receipts. This API powers the mobile expense tracking application by analyzing receipt data and extracting key financial details using AI.

## 🚀 Features

- **PDF Text Extraction**: Extract text from PDF receipts using OCR technology
- **AI-Powered Analysis**: Intelligent extraction of financial data using Groq AI
- **Receipt Data Processing**: Automatically identify reference IDs, dates, amounts, and beneficiary names
- **File Upload Handling**: Secure PDF file upload with size limits and validation
- **CORS Support**: Cross-origin resource sharing for mobile app integration
- **Error Handling**: Comprehensive error handling and logging

## 🛠️ Technology Stack

- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js
- **OCR Engine**: Scribe.js-OCR
- **AI Analysis**: Groq SDK (LLaMA 3 model)
- **File Processing**: Multer for multipart/form-data
- **Cross-Origin**: CORS middleware

## 📦 Dependencies

```json
{
  "scribe.js-ocr": "^0.8.0", // OCR text extraction
  "express": "^4.18.2", // Web framework
  "multer": "^1.4.5-lts.1", // File upload handling
  "cors": "^2.8.5", // Cross-origin requests
  "groq-sdk": "^0.7.0" // AI analysis
}
```

## ⚙️ Setup & Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Groq API key

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   PORT=3000
   ```

4. **Start the server**

   ```bash
   node main.mjs
   ```

   The server will start on `http://localhost:3000`

## 🔌 API Endpoints

### Health Check

```http
GET /
```

**Response:**

```json
{
  "message": "PDF Text Extraction Server is running!"
}
```

### Test Connectivity

```http
GET /test
```

**Response:**

```json
{
  "message": "Server is reachable!",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Extract Text from PDF

```http
POST /extract-text
Content-Type: multipart/form-data
```

**Request Body:**

- `file`: PDF file (max 10MB)

**Response:**

```json
{
  "success": true,
  "filename": "receipt.pdf",
  "extractedText": "Full OCR extracted text...",
  "analysis": {
    "referenceId": "TXN123456789",
    "date": "2024-01-01",
    "time": "14:30:00",
    "beneficiaryName": "ABC Store Sdn Bhd",
    "amount": "RM 25.50"
  },
  "message": "Text extracted and analyzed successfully"
}
```

**Error Response:**

```json
{
  "error": "Failed to extract text from PDF",
  "details": "Error message details"
}
```

## 🤖 AI Analysis

The backend uses **Groq's LLaMA 3** model to intelligently analyze extracted text and identify:

- **Reference ID**: Transaction or receipt reference number
- **Date**: Transaction date in YYYY-MM-DD format
- **Time**: Transaction time if available
- **Beneficiary Name**: Merchant or recipient name
- **Amount**: Transaction amount with currency

## 📁 File Handling

- **Supported Format**: PDF only
- **File Size Limit**: 10MB maximum
- **Temporary Storage**: Files are automatically deleted after processing
- **Upload Directory**: `uploads/` (created automatically)

## 🔒 Security Features

- **File Type Validation**: Only PDF files accepted
- **File Size Limits**: 10MB maximum file size
- **Automatic Cleanup**: Uploaded files are deleted after processing
- **Error Handling**: Comprehensive error handling prevents crashes

## 🌐 CORS Configuration

The API is configured to accept requests from any origin, making it suitable for mobile app integration:

```javascript
app.use(cors());
```

## 📊 Usage Flow

1. **Mobile app uploads PDF receipt**
2. **Server validates file type and size**
3. **OCR extracts text from PDF**
4. **AI analyzes text for financial data**
5. **Structured data returned to app**
6. **Temporary file deleted from server**

## 🔧 Development

### Running in Development

```bash
# Start with file watching (install nodemon first)
npm install -g nodemon
nodemon main.mjs
```

### Environment Variables

- `GROQ_API_KEY`: Your Groq API key for AI analysis
- `PORT`: Server port (default: 3000)

## 🚨 Error Handling

The API includes comprehensive error handling for:

- Invalid file types
- File size exceeded
- OCR processing failures
- AI analysis errors
- Server timeouts (30 seconds)

## 📝 Logs

The server provides detailed console logging for:

- File upload information
- OCR processing status
- AI analysis results
- Error details and stack traces

## 🔄 API Integration

This backend is designed to work with the **ExpensesTrackerV2** mobile application, providing OCR services for receipt processing and expense tracking.

### 📱 Want the Mobile App?

If you're looking to **download and use the ExpensesTrackerV2 mobile app**, join our Telegram group:

**📱 [Download ExpensesTrackerV2 App](https://t.me/+SQsA9kRYn1Y3NWE1)**

Get the latest APK releases and installation instructions from the **Expenses Tracker Application** Telegram group.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with ❤️ for intelligent expense tracking**
