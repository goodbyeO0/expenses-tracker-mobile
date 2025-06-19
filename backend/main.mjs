import express from 'express';
import multer from 'multer';
import cors from 'cors';
import scribe from 'scribe.js-ocr';
import path from 'path';
import fs from 'fs';
import Groq from 'groq-sdk';
import dotenv from "dotenv"
dotenv.config()


const app = express();
const port = 3000;

// Initialize Groq client
const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY
});

// Function to analyze text with Groq and extract financial data
async function analyzeFinancialDocument(text) {
	try {
		const prompt = `
You are a financial document analyzer. Extract the following information from this text and return it as a JSON object with these exact keys:

{
  "referenceId": "reference number or transaction ID",
  "date": "date in YYYY-MM-DD format if possible",
  "time": "time if available",
  "beneficiaryName": "name of the recipient/beneficiary",
  "amount": "monetary amount with currency if available"
}

If any field is not found, use null for that field. Only return the JSON object, no other text.

Text to analyze:
${text}
`;

		const completion = await groq.chat.completions.create({
			messages: [
				{
					role: "user",
					content: prompt
				}
			],
			model: "llama3-8b-8192",
			temperature: 0.1,
			max_tokens: 500,
		});

		const response = completion.choices[0]?.message?.content;

		// Try to parse the JSON response
		try {
			return JSON.parse(response);
		} catch (parseError) {
			console.error('Failed to parse Groq response as JSON:', response);
			return {
				referenceId: null,
				date: null,
				time: null,
				beneficiaryName: null,
				amount: null
			};
		}
	} catch (error) {
		console.error('Error analyzing document with Groq:', error);
		return {
			referenceId: null,
			date: null,
			time: null,
			beneficiaryName: null,
			amount: null
		};
	}
}

// Enable CORS for React Native app
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadDir = 'uploads/';
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		// Keep original filename with timestamp
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + '-' + file.originalname);
	}
});

const upload = multer({
	storage,
	fileFilter: (req, file, cb) => {
		if (file.mimetype === 'application/pdf') {
			cb(null, true);
		} else {
			cb(new Error('Only PDF files are allowed!'), false);
		}
	},
	limits: {
		fileSize: 10 * 1024 * 1024 // 10MB limit
	}
});

// Health check endpoint
app.get('/', (req, res) => {
	res.json({ message: 'PDF Text Extraction Server is running!' });
});

// Test endpoint to verify server connectivity
app.get('/test', (req, res) => {
	console.log('Test endpoint called');
	res.json({ message: 'Server is reachable!', timestamp: new Date().toISOString() });
});

// PDF upload and text extraction endpoint
app.post('/extract-text', upload.single('file'), async (req, res) => {
	try {
		if (!req.file) {
			console.log('No file received');
			return res.status(400).json({ error: 'No PDF file uploaded' });
		}

		console.log('Processing PDF:', req.file.filename, 'Size:', req.file.size, 'bytes');
		console.log('File path:', req.file.path);

		// Add timeout for extraction (30 seconds)
		const extractionPromise = scribe.extractText([req.file.path]);
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Text extraction timeout')), 30000)
		);

		console.log('Starting text extraction...');
		const extractedText = await Promise.race([extractionPromise, timeoutPromise]);

		console.log('Text extraction completed successfully');
		console.log('Extracted text length:', typeof extractedText === 'string' ? extractedText.length : 'Not a string');

		// Analyze the extracted text with Groq
		console.log('Starting Groq analysis...');
		const analysisResult = await analyzeFinancialDocument(extractedText);
		console.log('Groq analysis completed:', analysisResult);

		// Clean up uploaded file after processing
		fs.unlinkSync(req.file.path);

		res.json({
			success: true,
			filename: req.file.originalname,
			extractedText: extractedText,
			analysis: analysisResult,
			message: 'Text extracted and analyzed successfully'
		});

	} catch (error) {
		console.error('Error extracting text:', error);

		// Clean up file if it exists
		if (req.file && fs.existsSync(req.file.path)) {
			fs.unlinkSync(req.file.path);
		}

		res.status(500).json({
			error: 'Failed to extract text from PDF',
			details: error.message
		});
	}
});

// Error handling middleware
app.use((error, req, res, next) => {
	if (error instanceof multer.MulterError) {
		if (error.code === 'LIMIT_FILE_SIZE') {
			return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
		}
	}

	res.status(500).json({ error: error.message });
});

app.listen(port, () => {
	console.log(`PDF Text Extraction Server running at http://localhost:${port}`);
});