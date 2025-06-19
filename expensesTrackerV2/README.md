# 💰 ExpensesTrackerV2 - Smart Expense Tracking App

A modern React Native mobile application built with Expo that helps users track their expenses intelligently using OCR receipt scanning, location-based tracking, and smart budget management with overspending alerts.

## 🚀 Features

### 🔐 Authentication

- **Google Sign-In**: Secure authentication using Firebase Auth and Google Sign-In
- **User Profiles**: Automatic user profile creation with Firebase Firestore
- **Session Management**: Persistent login sessions across app launches

### 📱 Receipt Scanning (OCR)

- **PDF Receipt Upload**: Upload PDF receipts directly from device
- **OCR Text Extraction**: Intelligent text extraction from receipt images
- **AI-Powered Analysis**: Automatic extraction of:
  - Transaction amount
  - Merchant/Beneficiary name
  - Reference ID
  - Transaction date and time
- **Manual Editing**: Users can review and edit extracted information

### 📍 Location Tracking

- **Automatic Location Detection**: GPS-based location tracking for expenses
- **Address Resolution**: Convert coordinates to readable addresses
- **Location-Based Categorization**: Better expense categorization with location context
- **Privacy Controls**: Optional location sharing with user consent

### 💸 Budget Management

- **Smart Budgeting**: Set budgets for different categories
- **Multiple Time Periods**: Daily, weekly, and monthly budget tracking
- **Progress Tracking**: Visual progress bars showing budget utilization
- **Category-Based Budgets**: Separate budgets for different expense categories

### 🚨 Overspending Alerts

- **Real-Time Monitoring**: Continuous monitoring of spending vs. budgets
- **Push Notifications**: Instant alerts when approaching or exceeding limits
- **Multiple Alert Levels**: 90% warning and 100% exceeded notifications
- **Monthly Overspending Limits**: Overall monthly spending limits with alerts

### 📊 Expense Management

- **Expense History**: View all recorded expenses with detailed information
- **Category Organization**: Organize expenses by predefined categories
- **Search & Filter**: Find expenses by date, amount, merchant, or category
- **Data Persistence**: All data stored securely in Firebase Firestore

## 🛠️ Technology Stack

- **Framework**: React Native with Expo SDK 53
- **Navigation**: Expo Router with file-based routing
- **Authentication**: Firebase Auth + Google Sign-In
- **Database**: Firebase Firestore (NoSQL)
- **Push Notifications**: Firebase Cloud Messaging
- **State Management**: React Hooks (useState, useEffect, useContext)
- **Location Services**: Expo Location
- **File Handling**: Expo Document Picker
- **UI Components**: React Native + Custom Components
- **TypeScript**: Full TypeScript support

## 📦 Dependencies

### Core Dependencies

```json
{
  "@react-native-firebase/app": "^22.2.1",
  "@react-native-firebase/auth": "^22.2.1",
  "@react-native-firebase/firestore": "^22.2.1",
  "@react-native-firebase/messaging": "^22.2.1",
  "@react-native-google-signin/google-signin": "^14.0.1",
  "expo": "~53.0.11",
  "expo-router": "~5.1.0",
  "react-native": "0.79.3"
}
```

### Key Expo Modules

```json
{
  "expo-location": "~18.1.5",
  "expo-document-picker": "~13.1.5",
  "expo-notifications": "~0.31.3",
  "expo-constants": "~17.1.6",
  "expo-device": "~7.1.4"
}
```

## ⚙️ Setup & Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- Firebase project with enabled services

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd expensesTrackerV2
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Firebase Configuration**

   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Google Sign-In)
   - Enable Firestore Database
   - Enable Cloud Messaging (for push notifications)
   - Download `google-services.json` and place it in the project root

4. **Environment Configuration**
   Update `app.json` with your configuration:

   ```json
   {
     "expo": {
       "extra": {
         "ocrEndpoint": "https://your-backend-api.com/extract-text",
         "apiBaseUrl": "https://your-backend-api.com"
       }
     }
   }
   ```

5. **Start the development server**

   ```bash
   npx expo start
   ```

6. **Run on device**

   ```bash
   # Android
   npx expo run:android

   # iOS
   npx expo run:ios
   ```

## 📱 App Structure

```
expensesTrackerV2/
├── app/                      # App screens and navigation
│   ├── (tabs)/              # Tab-based navigation
│   │   ├── index.tsx        # Home/Budget screen
│   │   ├── ocr.tsx          # Receipt scanning screen
│   │   ├── history.tsx      # Expense history
│   │   └── profile.tsx      # User profile
│   ├── auth.tsx             # Authentication screen
│   └── _layout.tsx          # Root layout with auth context
├── components/              # Reusable UI components
├── constants/               # App constants and colors
├── hooks/                   # Custom React hooks
├── assets/                  # Images, fonts, and other assets
└── types/                   # TypeScript type definitions
```

## 🔧 Configuration

### Firebase Setup

1. **Authentication**: Enable Google Sign-In provider
2. **Firestore Collections**:
   - `users`: User profiles and preferences
   - `expenses`: Individual expense records
   - `budgets`: User budget configurations
   - `categories`: Expense categories

### Google Sign-In Configuration

```typescript
GoogleSignin.configure({
  webClientId: getWebClientId(), // From google-services.json
  offlineAccess: true,
});
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Expenses are user-specific
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
    }

    // Budgets are user-specific
    match /budgets/{budgetId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
    }
  }
}
```

## 📊 Data Models

### User Profile

```typescript
interface User {
  email: string;
  displayName: string;
  photoURL: string;
  preferences: {
    notifications: {
      overspendingAlerts: number;
    };
  };
  createdAt: Timestamp;
}
```

### Expense Record

```typescript
interface Expense {
  userId: string;
  amount: number;
  merchantName: string;
  referenceId: string;
  transactionDate: string;
  description: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
  };
  extractedText: string;
  createdAt: Timestamp;
}
```

### Budget Configuration

```typescript
interface Budget {
  userId: string;
  category: string;
  budgetType: "daily" | "weekly" | "monthly";
  budgetAmount: number;
  currentPeriod: string;
  currentSpent: number;
  isActive: boolean;
  createdAt: Timestamp;
}
```

## 🔔 Push Notifications

The app implements Firebase Cloud Messaging for:

- **Budget Alerts**: When spending reaches 90% or 100% of budget
- **Overspending Alerts**: When monthly spending exceeds set limits
- **Expense Confirmations**: Success notifications after saving expenses

## 📱 User Journey

1. **Authentication**: User signs in with Google account
2. **Budget Setup**: Set up budgets for different categories and time periods
3. **Overspending Limits**: Configure monthly overspending alert thresholds
4. **Receipt Scanning**: Upload PDF receipts for automatic data extraction
5. **Review & Confirm**: Review extracted data and make manual corrections
6. **Location Tracking**: App automatically captures location for context
7. **Expense Saved**: Expense is saved to Firestore with all metadata
8. **Budget Updates**: Budget spending is automatically updated
9. **Smart Alerts**: Receive notifications when approaching or exceeding limits

## 🔒 Security Features

- **Firebase Authentication**: Secure user authentication
- **Data Isolation**: Users can only access their own data
- **Location Privacy**: Location sharing requires explicit user consent
- **File Validation**: PDF files are validated before upload
- **Secure API Communication**: HTTPS communication with backend
- **Input Sanitization**: User inputs are validated and sanitized

## 🌟 Key Features Deep Dive

### OCR Receipt Processing

1. User uploads PDF receipt
2. File is sent to backend OCR service
3. AI extracts financial information
4. User reviews and edits extracted data
5. Expense is saved with full metadata

### Budget Management

- **Dynamic Period Tracking**: Automatically resets budgets for new periods
- **Category-Based Budgets**: Different budgets for different expense types
- **Visual Progress Indicators**: Easy-to-understand progress bars
- **Smart Alerts**: Proactive notifications before overspending

### Location Intelligence

- **Automatic Detection**: GPS location captured when adding expenses
- **Address Resolution**: Convert coordinates to human-readable addresses
- **Privacy Controls**: Users can enable/disable location tracking
- **Contextual Information**: Location helps with expense categorization

## 🚀 Building for Production

### Android

```bash
# Build APK
npx expo build:android

# Build AAB (recommended for Play Store)
npx expo build:android --type app-bundle
```

### iOS

```bash
# Build for iOS
npx expo build:ios
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run type checking
npx tsc --noEmit

# Run linting
npm run lint
```

## 🔄 API Integration

The app integrates with the ExpensesTracker Backend API for:

- **OCR Processing**: PDF text extraction and analysis
- **Receipt Data**: Structured financial information extraction

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Firebase**: For authentication and database services
- **Expo**: For the amazing development platform
- **React Native**: For cross-platform mobile development
- **Google Sign-In**: For secure authentication

---

**Built with ❤️ for Malaysian users • MYR currency support • Smart expense tracking**

## 📧 Support

For support, email [your-email@example.com] or create an issue in the repository.

---

_Transform your expense tracking with intelligent receipt scanning and smart budget management!_ 🚀
