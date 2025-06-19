import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
    address?: string;
    street?: string;
    city?: string;
    region?: string;
    country?: string;
}

interface OCRAnalysisResult {
    referenceId?: string;
    date?: string;
    time?: string;
    beneficiaryName?: string;
    amount?: string;
}

interface ExpenseData {
    amount: number;
    merchantName: string;
    referenceId: string;
    transactionDate: string;
    description: string;
    category: string;
}

// Default categories for selection
const defaultCategories = [
    { id: "food-dining", name: "Food & Dining", icon: "🍽️" },
    { id: "transportation", name: "Transportation", icon: "🚗" },
    { id: "shopping", name: "Shopping", icon: "🛍️" },
    { id: "entertainment", name: "Entertainment", icon: "🎬" },
    { id: "bills-utilities", name: "Bills & Utilities", icon: "📄" },
    { id: "healthcare", name: "Healthcare", icon: "❤️" },
    { id: "groceries", name: "Groceries", icon: "🛒" },
    { id: "other", name: "Other", icon: "📦" }
];

export default function OCRScreen() {
    const [extractedText, setExtractedText] = useState('');
    const [analysisResult, setAnalysisResult] = useState<OCRAnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<LocationData | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Form data for expense confirmation
    const [expenseData, setExpenseData] = useState<ExpenseData>({
        amount: 0,
        merchantName: '',
        referenceId: '',
        transactionDate: '',
        description: '',
        category: 'other'
    });

    const [categories, setCategories] = useState(defaultCategories);

    // Load categories from Firestore
    useEffect(() => {
        loadCategories();
        // Automatically get location when screen loads
        getCurrentLocation();
    }, []);

    const loadCategories = async () => {
        try {
            const snapshot = await firestore().collection('categories').get();
            if (!snapshot.empty) {
                const loadedCategories = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    icon: doc.data().icon || '📦'
                }));
                setCategories(loadedCategories);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const getCurrentLocation = async () => {
        setLocationLoading(true);
        try {
            console.log('Requesting location permissions...');

            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Location access will help categorize your expenses better. You can enable it later in settings.'
                );
                setLocationLoading(false);
                return;
            }

            let locationResult = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
            });

            let addressResults = await Location.reverseGeocodeAsync({
                latitude: locationResult.coords.latitude,
                longitude: locationResult.coords.longitude,
            });

            let addressInfo = addressResults[0] || {};
            let addressParts: string[] = [];
            if (addressInfo.name) addressParts.push(addressInfo.name);
            if (addressInfo.street) addressParts.push(addressInfo.street);
            if (addressInfo.city) addressParts.push(addressInfo.city);
            if (addressInfo.region) addressParts.push(addressInfo.region);

            const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Address not available';

            setLocation({
                latitude: locationResult.coords.latitude,
                longitude: locationResult.coords.longitude,
                accuracy: locationResult.coords.accuracy,
                timestamp: locationResult.timestamp,
                address: fullAddress,
                street: addressInfo.street || 'Unknown street',
                city: addressInfo.city || 'Unknown city',
                region: addressInfo.region || 'Unknown region',
                country: addressInfo.country || 'Unknown country'
            });

            setLocationLoading(false);
        } catch (error) {
            console.error('Error getting location:', error);
            setLocationLoading(false);
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                console.log('File selected:', file.name, 'Size:', file.size);

                if (file.size && file.size > 10 * 1024 * 1024) {
                    Alert.alert('File Too Large', 'Please select a PDF file smaller than 10MB.');
                    return;
                }

                processFile(file);
            }
        } catch (error) {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick document. Please try again.');
        }
    };

    const processFile = async (file: any) => {
        setLoading(true);
        setExtractedText('');
        setAnalysisResult(null);
        setShowConfirmation(false);

        try {
            const formData = new FormData();
            formData.append('file', {
                uri: file.uri,
                type: 'application/pdf',
                name: file.name,
            } as any);

            console.log('Processing file...');
            const OCR_ENDPOINT = process.env.EXPO_PUBLIC_OCR_ENDPOINT || "";
            const response = await fetch(OCR_ENDPOINT, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('OCR Response:', data);

            if (data.success) {
                setExtractedText(data.extractedText);
                if (data.analysis) {
                    setAnalysisResult(data.analysis);

                    // Pre-populate form with extracted data
                    setExpenseData({
                        amount: parseFloat(data.analysis.amount?.replace(/[^\d.]/g, '') || '0'),
                        merchantName: data.analysis.beneficiaryName || '',
                        referenceId: data.analysis.referenceId || '',
                        transactionDate: data.analysis.date || new Date().toISOString().split('T')[0],
                        description: '',
                        category: 'other'
                    });

                    setShowConfirmation(true);
                }

                // Auto-get location if not already available
                if (!location) {
                    getCurrentLocation();
                }
            } else {
                Alert.alert('Error', data.error || 'Failed to extract text from PDF');
            }
        } catch (error) {
            console.error('Processing error:', error);
            Alert.alert('Error', 'Failed to process the PDF. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    // Function to get current period for budget tracking
    const getCurrentPeriod = (type: 'daily' | 'weekly' | 'monthly'): string => {
        const now = new Date();
        switch (type) {
            case 'daily':
                return now.toISOString().split('T')[0];
            case 'weekly':
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
                const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
                return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
            case 'monthly':
                return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
            default:
                return '';
        }
    };

    // Function to update budget spending
    const updateBudgetSpending = async (category: string, amount: number) => {
        const user = auth().currentUser;
        if (!user) return;

        try {
            // Find active budgets for this category
            const budgetsSnapshot = await firestore()
                .collection('budgets')
                .where('userId', '==', user.uid)
                .where('category', '==', category)
                .where('isActive', '==', true)
                .get();

            const batch = firestore().batch();

            budgetsSnapshot.docs.forEach(doc => {
                const budget = doc.data();
                const currentPeriod = getCurrentPeriod(budget.budgetType);

                // Check if we need to reset the period
                if (budget.currentPeriod !== currentPeriod) {
                    // New period, reset spending
                    batch.update(doc.ref, {
                        currentPeriod,
                        currentSpent: amount,
                        updatedAt: firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    // Same period, add to existing spending
                    batch.update(doc.ref, {
                        currentSpent: (budget.currentSpent || 0) + amount,
                        updatedAt: firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            await batch.commit();
            console.log('Budget spending updated successfully');
        } catch (error) {
            console.error('Error updating budget spending:', error);
            // Don't show error to user as this is background operation
        }
    };

    // Function to check for budget alerts
    const checkBudgetAlerts = async (category: string, amount: number) => {
        const user = auth().currentUser;
        if (!user) return;

        try {
            // Get updated budgets after spending update
            const budgetsSnapshot = await firestore()
                .collection('budgets')
                .where('userId', '==', user.uid)
                .where('category', '==', category)
                .where('isActive', '==', true)
                .get();

            budgetsSnapshot.docs.forEach(doc => {
                const budget = doc.data();
                const currentPeriod = getCurrentPeriod(budget.budgetType);

                if (budget.currentPeriod === currentPeriod) {
                    const spentAmount = budget.currentSpent || 0;
                    const budgetAmount = budget.budgetAmount || 0;
                    const percentage = (spentAmount / budgetAmount) * 100;

                    if (percentage >= 100) {
                        Alert.alert(
                            '⚠️ Budget Exceeded!',
                            `You've exceeded your ${budget.budgetType} budget for ${category}.\nSpent: RM${spentAmount.toFixed(2)} / RM${budgetAmount.toFixed(2)}`,
                            [{ text: 'OK', style: 'default' }]
                        );
                    } else if (percentage >= 90) {
                        Alert.alert(
                            '⚠️ Budget Alert',
                            `You're at ${percentage.toFixed(1)}% of your ${budget.budgetType} budget for ${category}.\nSpent: RM${spentAmount.toFixed(2)} / RM${budgetAmount.toFixed(2)}`,
                            [{ text: 'OK', style: 'default' }]
                        );
                    }
                }
            });
        } catch (error) {
            console.error('Error checking budget alerts:', error);
        }
    };

    // Function to check overspending alerts
    const checkOverspendingAlert = async (amount: number) => {
        const user = auth().currentUser;
        if (!user) return;

        try {
            // Get user preferences
            const userDoc = await firestore().collection('users').doc(user.uid).get();
            if (!userDoc.exists) return;

            const userData = userDoc.data();
            const overspendingLimit = userData?.preferences?.notifications?.overspendingAlerts || 1000;

            // Get current month's total expenses
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            const expensesSnapshot = await firestore()
                .collection('expenses')
                .where('userId', '==', user.uid)
                .where('createdAt', '>=', startOfMonth)
                .where('createdAt', '<=', endOfMonth)
                .get();

            let totalMonthlySpent = 0;
            expensesSnapshot.docs.forEach(doc => {
                totalMonthlySpent += doc.data().amount || 0;
            });

            // Add current expense
            totalMonthlySpent += amount;

            if (totalMonthlySpent >= overspendingLimit) {
                Alert.alert(
                    '🚨 Overspending Alert!',
                    `Your monthly expenses have reached RM${totalMonthlySpent.toFixed(2)}, exceeding your limit of RM${overspendingLimit.toFixed(2)}.`,
                    [{ text: 'OK', style: 'default' }]
                );
            }
        } catch (error) {
            console.error('Error checking overspending alert:', error);
        }
    };

    const saveExpense = async () => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert('Error', 'You must be logged in to save expenses');
            return;
        }

        if (!expenseData.amount || expenseData.amount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (!expenseData.merchantName.trim()) {
            Alert.alert('Error', 'Please enter the merchant name');
            return;
        }

        setSaving(true);
        try {
            const expenseDoc = {
                userId: user.uid,

                // Receipt Information (OCR Extracted)
                amount: expenseData.amount,
                merchantName: expenseData.merchantName.trim(),
                referenceId: expenseData.referenceId.trim(),
                transactionDate: expenseData.transactionDate,

                // User Input
                description: expenseData.description.trim(),
                category: expenseData.category,

                // Location Data
                location: location ? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    address: location.address,
                    city: location.city
                } : null,

                // Optional: Store extracted text for debugging
                extractedText: extractedText,

                // Metadata
                createdAt: firestore.FieldValue.serverTimestamp(),
                updatedAt: firestore.FieldValue.serverTimestamp()
            };

            // Save expense to database
            await firestore().collection('expenses').add(expenseDoc);

            // Update budget spending (background operation)
            await updateBudgetSpending(expenseData.category, expenseData.amount);

            // Check for budget alerts
            setTimeout(() => {
                checkBudgetAlerts(expenseData.category, expenseData.amount);
                checkOverspendingAlert(expenseData.amount);
            }, 1000);

            // Show success message and automatically reset form
            Alert.alert(
                'Success! 🎉',
                `Expense of RM${expenseData.amount.toFixed(2)} saved successfully!\n\nUpload another receipt to add more expenses.`,
                [
                    {
                        text: 'OK',
                        onPress: resetForm
                    }
                ]
            );

        } catch (error: any) {
            console.error('Error saving expense:', error);
            Alert.alert('Error', `Failed to save expense: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setExtractedText('');
        setAnalysisResult(null);
        setShowConfirmation(false);
        setExpenseData({
            amount: 0,
            merchantName: '',
            referenceId: '',
            transactionDate: '',
            description: '',
            category: 'other'
        });
    };

    const renderMainScreen = () => (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>📱 Scan Receipt</Text>
                    <Text style={styles.subtitle}>Upload PDF receipt to extract expense data</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.primaryButton]}
                        onPress={pickDocument}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? '🔄 Processing...' : '📄 Upload PDF Receipt'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Location Display */}
                <View style={styles.locationCard}>
                    {locationLoading ? (
                        <View style={styles.locationLoading}>
                            <Text style={styles.locationTitle}>📍 Getting Location...</Text>
                            <Text style={styles.locationSubtext}>This helps categorize your expenses</Text>
                        </View>
                    ) : location ? (
                        <View>
                            <Text style={styles.locationTitle}>📍 Current Location</Text>
                            <Text style={styles.locationText}>{location.address}</Text>
                            <Text style={styles.locationDetails}>
                                {location.city}, {location.region}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.locationError}>
                            <Text style={styles.locationTitle}>📍 Location Unavailable</Text>
                            <Text style={styles.locationSubtext}>
                                Enable location access for better expense tracking
                            </Text>
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={getCurrentLocation}
                            >
                                <Text style={styles.retryButtonText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Processing Indicator */}
                {loading && (
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color="#4285F4" />
                        <Text style={styles.loadingText}>Processing your receipt...</Text>
                        <Text style={styles.loadingSubtext}>This may take a few moments</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );

    const renderConfirmationScreen = () => (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>✅ Confirm Expense</Text>
                    <Text style={styles.subtitle}>Review and edit the extracted information</Text>
                </View>

                <View style={styles.formCard}>
                    {/* Amount */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Amount (MYR)</Text>
                        <TextInput
                            style={[styles.input, styles.amountInput]}
                            value={expenseData.amount.toString()}
                            onChangeText={(text) => setExpenseData({ ...expenseData, amount: parseFloat(text) || 0 })}
                            keyboardType="numeric"
                            placeholder="0.00"
                        />
                    </View>

                    {/* Merchant Name */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Merchant Name</Text>
                        <TextInput
                            style={styles.input}
                            value={expenseData.merchantName}
                            onChangeText={(text) => setExpenseData({ ...expenseData, merchantName: text })}
                            placeholder="Enter merchant name"
                        />
                    </View>

                    {/* Category Selection */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                            {categories.map((category) => (
                                <TouchableOpacity
                                    key={category.id}
                                    style={[
                                        styles.categoryChip,
                                        expenseData.category === category.id && styles.selectedCategory
                                    ]}
                                    onPress={() => setExpenseData({ ...expenseData, category: category.id })}
                                >
                                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                                    <Text style={[
                                        styles.categoryText,
                                        expenseData.category === category.id && styles.selectedCategoryText
                                    ]}>
                                        {category.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Description */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Description (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={expenseData.description}
                            onChangeText={(text) => setExpenseData({ ...expenseData, description: text })}
                            placeholder="Add a note about this expense"
                            multiline
                        />
                    </View>

                    {/* Reference ID */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Reference ID</Text>
                        <TextInput
                            style={styles.input}
                            value={expenseData.referenceId}
                            onChangeText={(text) => setExpenseData({ ...expenseData, referenceId: text })}
                            placeholder="Transaction reference"
                        />
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={saveExpense}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.buttonText}>💾 Save Expense</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={resetForm}
                            disabled={saving}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            {showConfirmation ? renderConfirmationScreen() : renderMainScreen()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },

    // Button Styles
    buttonContainer: {
        paddingHorizontal: 20,
        gap: 12,
    },
    button: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#4285F4',
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#4285F4',
    },
    saveButton: {
        backgroundColor: '#34C759',
        flex: 1,
    },
    cancelButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#FF6B6B',
        flex: 1,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButtonText: {
        color: '#4285F4',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButtonText: {
        color: '#FF6B6B',
        fontSize: 16,
        fontWeight: '600',
    },

    // Location Card
    locationCard: {
        backgroundColor: '#fff',
        margin: 20,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    locationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    locationText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    locationDetails: {
        fontSize: 12,
        color: '#999',
    },
    locationLoading: {
        alignItems: 'center',
    },
    locationSubtext: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        marginTop: 4,
    },
    locationError: {
        alignItems: 'center',
    },
    retryButton: {
        backgroundColor: '#4285F4',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginTop: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Loading Card
    loadingCard: {
        backgroundColor: '#fff',
        margin: 20,
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loadingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginTop: 12,
    },
    loadingSubtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },

    // Form Styles
    formCard: {
        backgroundColor: '#fff',
        margin: 20,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        borderWidth: 2,
        borderColor: '#e1e5e9',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
        backgroundColor: '#f8f9fa',
    },
    amountInput: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#34C759',
    },

    // Category Selection
    categoryScroll: {
        marginVertical: 8,
    },
    categoryChip: {
        backgroundColor: '#f1f3f4',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        alignItems: 'center',
        minWidth: 80,
    },
    selectedCategory: {
        backgroundColor: '#4285F4',
    },
    categoryIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    categoryText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    selectedCategoryText: {
        color: '#fff',
        fontWeight: '600',
    },

    // Action Buttons
    actionButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
});
