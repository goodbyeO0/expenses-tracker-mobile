import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

interface Budget {
    id: string;
    userId: string;
    category: string;
    budgetType: 'daily' | 'weekly' | 'monthly';
    budgetAmount: number;
    currentPeriod: string;
    currentSpent: number;
    isActive: boolean;
    createdAt: any;
    updatedAt: any;
}

interface Category {
    id: string;
    name: string;
    icon: string;
    color?: string;
}

interface UserPreferences {
    overspendingAlerts: number;
}

const defaultCategories: Category[] = [
    { id: "food-dining", name: "Food & Dining", icon: "🍽️", color: "#FF6B6B" },
    { id: "transportation", name: "Transportation", icon: "🚗", color: "#4ECDC4" },
    { id: "shopping", name: "Shopping", icon: "🛍️", color: "#45B7D1" },
    { id: "entertainment", name: "Entertainment", icon: "🎬", color: "#96CEB4" },
    { id: "bills-utilities", name: "Bills & Utilities", icon: "📄", color: "#FFEAA7" },
    { id: "healthcare", name: "Healthcare", icon: "❤️", color: "#DDA0DD" },
    { id: "groceries", name: "Groceries", icon: "🛒", color: "#98D8C8" },
    { id: "other", name: "Other", icon: "📦", color: "#A8A8A8" }
];

export default function HomeScreen() {
    const [user, setUser] = useState(auth().currentUser);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>(defaultCategories);
    const [loading, setLoading] = useState(true);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [showOverspendingModal, setShowOverspendingModal] = useState(false);
    const [userPreferences, setUserPreferences] = useState<UserPreferences>({ overspendingAlerts: 1000 });
    const [monthlySpent, setMonthlySpent] = useState(0);

    // Budget form state
    const [selectedCategory, setSelectedCategory] = useState('');
    const [budgetType, setBudgetType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
    const [budgetAmount, setBudgetAmount] = useState('');
    const [saving, setSaving] = useState(false);

    // Overspending settings
    const [overspendingLimit, setOverspendingLimit] = useState('1000');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged((user) => {
            console.log('Auth state changed:', user?.uid || 'No user');
            setUser(user);

            if (user) {
                // Reset all state when user changes
                setBudgets([]);
                setMonthlySpent(0);
                setUserPreferences({ overspendingAlerts: 1000 });

                // Load new user's data
                loadUserData();
            } else {
                setLoading(false);
                // Clear all data when user logs out
                setBudgets([]);
                setMonthlySpent(0);
                setUserPreferences({ overspendingAlerts: 1000 });
            }
        });

        return unsubscribe;
    }, []);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            const currentUser = auth().currentUser;
            if (currentUser) {
                loadUserData();
            }
        }, [])
    );

    const loadUserData = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser) {
            console.log('No authenticated user for loadUserData');
            setLoading(false);
            return;
        }

        console.log('Loading data for user:', currentUser.uid);
        setLoading(true);
        try {
            await Promise.all([
                loadBudgets(),
                loadCategories(),
                loadUserPreferences(),
                loadMonthlySpending()
            ]);
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadBudgets = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser) return;

        try {
            const snapshot = await firestore()
                .collection('budgets')
                .where('userId', '==', currentUser.uid)
                .where('isActive', '==', true)
                .get();

            const budgetData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Budget[];

            setBudgets(budgetData);
        } catch (error) {
            console.error('Error loading budgets:', error);
        }
    };

    const loadCategories = async () => {
        try {
            const snapshot = await firestore().collection('categories').get();
            if (!snapshot.empty) {
                const categoryData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    icon: doc.data().icon || '📦',
                    color: doc.data().color
                }));
                setCategories(categoryData);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadUserPreferences = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser) return;

        try {
            const doc = await firestore().collection('users').doc(currentUser.uid).get();
            if (doc.exists()) {
                const userData = doc.data();
                if (userData?.preferences?.notifications?.overspendingAlerts) {
                    setUserPreferences({
                        overspendingAlerts: userData.preferences.notifications.overspendingAlerts
                    });
                    setOverspendingLimit(userData.preferences.notifications.overspendingAlerts.toString());
                }
            }
        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    };

    const loadMonthlySpending = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser) {
            console.log('No authenticated user for monthly spending');
            setMonthlySpent(0);
            return;
        }

        try {
            console.log('Loading monthly spending for user:', currentUser.uid);

            // Get all user expenses (simple query - no date range filter)
            const expensesSnapshot = await firestore()
                .collection('expenses')
                .where('userId', '==', currentUser.uid)
                .get();

            console.log('Found expenses:', expensesSnapshot.docs.length);

            // Filter by current month in client-side
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            let totalMonthlySpent = 0;
            expensesSnapshot.docs.forEach(doc => {
                const expenseData = doc.data();
                const expenseDate = expenseData.createdAt?.toDate() || new Date(expenseData.transactionDate);

                // Check if expense is from current month
                if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
                    totalMonthlySpent += expenseData.amount || 0;
                }
            });

            console.log('Total monthly spent:', totalMonthlySpent);
            setMonthlySpent(totalMonthlySpent);
        } catch (error) {
            console.error('Error loading monthly spending:', error);
            // Set to 0 on error to prevent UI issues
            setMonthlySpent(0);
        }
    };

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

    const saveBudget = async () => {
        if (!user || !selectedCategory || !budgetAmount || parseFloat(budgetAmount) <= 0) {
            Alert.alert('Error', 'Please fill in all fields with valid values');
            return;
        }

        setSaving(true);
        try {
            const currentPeriod = getCurrentPeriod(budgetType);

            // Check if budget already exists for this category
            const existingBudget = budgets.find(b => b.category === selectedCategory && b.budgetType === budgetType);

            if (existingBudget) {
                // Update existing budget
                await firestore().collection('budgets').doc(existingBudget.id).update({
                    budgetAmount: parseFloat(budgetAmount),
                    currentPeriod,
                    updatedAt: firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Create new budget
                await firestore().collection('budgets').add({
                    userId: user.uid,
                    category: selectedCategory,
                    budgetType,
                    budgetAmount: parseFloat(budgetAmount),
                    currentPeriod,
                    currentSpent: 0,
                    isActive: true,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    updatedAt: firestore.FieldValue.serverTimestamp()
                });
            }

            Alert.alert('Success', 'Budget saved successfully!');
            setShowBudgetModal(false);
            resetBudgetForm();
            loadBudgets();
        } catch (error: any) {
            console.error('Error saving budget:', error);
            Alert.alert('Error', `Failed to save budget: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const saveOverspendingLimit = async () => {
        if (!user || !overspendingLimit || parseFloat(overspendingLimit) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        setSaving(true);
        try {
            await firestore().collection('users').doc(user.uid).update({
                'preferences.notifications.overspendingAlerts': parseFloat(overspendingLimit),
                updatedAt: firestore.FieldValue.serverTimestamp()
            });

            setUserPreferences({ overspendingAlerts: parseFloat(overspendingLimit) });
            Alert.alert('Success', 'Overspending limit updated successfully!');
            setShowOverspendingModal(false);
        } catch (error: any) {
            console.error('Error updating overspending limit:', error);
            Alert.alert('Error', `Failed to update limit: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const resetBudgetForm = () => {
        setSelectedCategory('');
        setBudgetType('monthly');
        setBudgetAmount('');
    };

    const deleteBudget = async (budgetId: string) => {
        Alert.alert(
            'Delete Budget',
            'Are you sure you want to delete this budget?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await firestore().collection('budgets').doc(budgetId).update({
                                isActive: false,
                                updatedAt: firestore.FieldValue.serverTimestamp()
                            });
                            loadBudgets();
                        } catch (error) {
                            console.error('Error deleting budget:', error);
                            Alert.alert('Error', 'Failed to delete budget');
                        }
                    }
                }
            ]
        );
    };

    const getProgressColor = (spent: number, budget: number) => {
        const percentage = (spent / budget) * 100;
        if (percentage >= 100) return '#FF6B6B';
        if (percentage >= 75) return '#FFA500';
        return '#34C759';
    };

    const getBudgetTypeIcon = (type: string) => {
        switch (type) {
            case 'daily': return '📅';
            case 'weekly': return '📆';
            case 'monthly': return '🗓️';
            default: return '📊';
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadUserData();
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <Text style={styles.loginPrompt}>Please login to manage your budgets</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#4285F4" />
                    <Text style={styles.loadingText}>Loading your budgets...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#4285F4']}
                        tintColor="#4285F4"
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>💰 Expense Tracker</Text>
                        <Text style={styles.subtitle}>
                            Welcome back, {user.displayName || user.email?.split('@')[0]}!
                        </Text>
                    </View>
                </View>

                {/* Monthly Overspending Progress */}
                <View style={styles.overspendingCard}>
                    <View style={styles.overspendingHeader}>
                        <Text style={styles.overspendingTitle}>🚨 Monthly Spending Alert</Text>
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => setShowOverspendingModal(true)}
                        >
                            <Text style={styles.editIcon}>✏️</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.overspendingAmount}>
                        <Text style={styles.currentSpent}>
                            RM {monthlySpent.toFixed(2)}
                        </Text>
                        <Text style={styles.totalLimit}>
                            / RM {userPreferences.overspendingAlerts.toFixed(2)}
                        </Text>
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${Math.min((monthlySpent / userPreferences.overspendingAlerts) * 100, 100)}%`,
                                        backgroundColor: getProgressColor(monthlySpent, userPreferences.overspendingAlerts)
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>
                            {((monthlySpent / userPreferences.overspendingAlerts) * 100).toFixed(1)}%
                        </Text>
                    </View>

                    {monthlySpent >= userPreferences.overspendingAlerts && (
                        <View style={styles.warningBanner}>
                            <Text style={styles.warningText}>
                                ⚠️ Monthly spending limit exceeded!
                            </Text>
                        </View>
                    )}

                    <Text style={styles.overspendingLabel}>
                        {monthlySpent >= userPreferences.overspendingAlerts
                            ? `🚨 Exceeded by RM${(monthlySpent - userPreferences.overspendingAlerts).toFixed(2)}`
                            : monthlySpent >= userPreferences.overspendingAlerts * 0.9
                                ? `⚠️ Close to limit! RM${(userPreferences.overspendingAlerts - monthlySpent).toFixed(2)} remaining`
                                : `RM${(userPreferences.overspendingAlerts - monthlySpent).toFixed(2)} remaining this month`
                        }
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => setShowBudgetModal(true)}
                    >
                        <Text style={styles.buttonText}>➕ Add Budget</Text>
                    </TouchableOpacity>
                </View>

                {/* Budget List */}
                <View style={styles.budgetsContainer}>
                    <Text style={styles.sectionTitle}>Your Budgets</Text>

                    {budgets.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateIcon}>📊</Text>
                            <Text style={styles.emptyStateTitle}>No budgets yet</Text>
                            <Text style={styles.emptyStateText}>
                                Add your first budget to start tracking your expenses
                            </Text>
                        </View>
                    ) : (
                        budgets.map((budget) => {
                            const category = categories.find(c => c.id === budget.category);
                            const progressPercentage = (budget.currentSpent / budget.budgetAmount) * 100;
                            const progressColor = getProgressColor(budget.currentSpent, budget.budgetAmount);

                            return (
                                <View key={budget.id} style={styles.budgetCard}>
                                    <View style={styles.budgetHeader}>
                                        <View style={styles.budgetInfo}>
                                            <Text style={styles.budgetCategory}>
                                                {category?.icon} {category?.name || budget.category}
                                            </Text>
                                            <Text style={styles.budgetType}>
                                                {getBudgetTypeIcon(budget.budgetType)} {budget.budgetType}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => deleteBudget(budget.id)}
                                            style={styles.deleteButton}
                                        >
                                            <Text style={styles.deleteIcon}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.budgetAmount}>
                                        <Text style={styles.spentAmount}>
                                            RM {budget.currentSpent.toFixed(2)}
                                        </Text>
                                        <Text style={styles.totalAmount}>
                                            / RM {budget.budgetAmount.toFixed(2)}
                                        </Text>
                                    </View>

                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressBar}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: `${Math.min(progressPercentage, 100)}%`,
                                                        backgroundColor: progressColor
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.progressText}>
                                            {progressPercentage.toFixed(1)}%
                                        </Text>
                                    </View>

                                    {progressPercentage >= 100 && (
                                        <View style={styles.warningBanner}>
                                            <Text style={styles.warningText}>
                                                ⚠️ Budget exceeded!
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Budget Creation Modal */}
            <Modal
                visible={showBudgetModal}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            onPress={() => setShowBudgetModal(false)}
                            style={styles.modalCloseButton}
                        >
                            <Text style={styles.modalCloseText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Add Budget</Text>
                        <View style={styles.modalPlaceholder} />
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {/* Category Selection */}
                        <View style={styles.formSection}>
                            <Text style={styles.formLabel}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {categories.map((category) => (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={[
                                            styles.categoryChip,
                                            selectedCategory === category.id && styles.selectedChip
                                        ]}
                                        onPress={() => setSelectedCategory(category.id)}
                                    >
                                        <Text style={styles.categoryIcon}>{category.icon}</Text>
                                        <Text style={[
                                            styles.categoryName,
                                            selectedCategory === category.id && styles.selectedChipText
                                        ]}>
                                            {category.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Budget Type Selection */}
                        <View style={styles.formSection}>
                            <Text style={styles.formLabel}>Budget Period</Text>
                            <View style={styles.budgetTypeContainer}>
                                {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.budgetTypeButton,
                                            budgetType === type && styles.selectedBudgetType
                                        ]}
                                        onPress={() => setBudgetType(type)}
                                    >
                                        <Text style={styles.budgetTypeIcon}>
                                            {getBudgetTypeIcon(type)}
                                        </Text>
                                        <Text style={[
                                            styles.budgetTypeText,
                                            budgetType === type && styles.selectedBudgetTypeText
                                        ]}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Budget Amount */}
                        <View style={styles.formSection}>
                            <Text style={styles.formLabel}>Budget Amount (MYR)</Text>
                            <TextInput
                                style={styles.amountInput}
                                value={budgetAmount}
                                onChangeText={setBudgetAmount}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.disabledButton]}
                            onPress={saveBudget}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.saveButtonText}>Save Budget</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Overspending Settings Modal */}
            <Modal
                visible={showOverspendingModal}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            onPress={() => setShowOverspendingModal(false)}
                            style={styles.modalCloseButton}
                        >
                            <Text style={styles.modalCloseText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Overspending Alert</Text>
                        <View style={styles.modalPlaceholder} />
                    </View>

                    <View style={styles.modalContent}>
                        <Text style={styles.formDescription}>
                            Set your monthly overspending limit. You'll get an alert when your total expenses exceed this amount.
                        </Text>

                        <View style={styles.formSection}>
                            <Text style={styles.formLabel}>Monthly Limit (MYR)</Text>
                            <TextInput
                                style={styles.amountInput}
                                value={overspendingLimit}
                                onChangeText={setOverspendingLimit}
                                keyboardType="numeric"
                                placeholder="1000.00"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.disabledButton]}
                            onPress={saveOverspendingLimit}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.saveButtonText}>Save Limit</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    settingsButton: {
        padding: 8,
    },
    settingsIcon: {
        fontSize: 24,
    },

    // Overspending Card
    overspendingCard: {
        backgroundColor: '#fff',
        margin: 20,
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    overspendingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    overspendingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    editButton: {
        padding: 4,
    },
    editIcon: {
        fontSize: 16,
    },
    overspendingAmount: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 16,
        justifyContent: 'center',
    },
    currentSpent: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    totalLimit: {
        fontSize: 18,
        color: '#666',
        marginLeft: 4,
    },
    overspendingLabel: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 12,
    },

    // Action Buttons
    actionButtons: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    primaryButton: {
        backgroundColor: '#4285F4',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Budgets Section
    budgetsContainer: {
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyStateIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },

    // Budget Cards
    budgetCard: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    budgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    budgetInfo: {
        flex: 1,
    },
    budgetCategory: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    budgetType: {
        fontSize: 12,
        color: '#666',
        textTransform: 'capitalize',
    },
    deleteButton: {
        padding: 4,
    },
    deleteIcon: {
        fontSize: 18,
    },
    budgetAmount: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    spentAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    totalAmount: {
        fontSize: 16,
        color: '#666',
        marginLeft: 4,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    progressBar: {
        flex: 1,
        height: 8,
        backgroundColor: '#e1e5e9',
        borderRadius: 4,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        minWidth: 40,
        textAlign: 'right',
    },
    warningBanner: {
        backgroundColor: '#FFE5E5',
        padding: 8,
        borderRadius: 8,
        marginTop: 12,
        alignItems: 'center',
    },
    warningText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FF6B6B',
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e1e5e9',
        backgroundColor: '#fff',
    },
    modalCloseButton: {
        minWidth: 60,
    },
    modalCloseText: {
        fontSize: 16,
        color: '#4285F4',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    modalPlaceholder: {
        minWidth: 60,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },

    // Form Styles
    formSection: {
        marginBottom: 24,
    },
    formLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    formDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 24,
    },
    categoryChip: {
        backgroundColor: '#f1f3f4',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        marginRight: 12,
        alignItems: 'center',
        minWidth: 80,
    },
    selectedChip: {
        backgroundColor: '#4285F4',
    },
    categoryIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    categoryName: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    selectedChipText: {
        color: '#fff',
        fontWeight: '600',
    },
    budgetTypeContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    budgetTypeButton: {
        flex: 1,
        backgroundColor: '#f1f3f4',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    selectedBudgetType: {
        backgroundColor: '#4285F4',
    },
    budgetTypeIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    budgetTypeText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    selectedBudgetTypeText: {
        color: '#fff',
        fontWeight: '600',
    },
    amountInput: {
        borderWidth: 2,
        borderColor: '#e1e5e9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: '#fff',
        color: '#34C759',
    },
    saveButton: {
        backgroundColor: '#34C759',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    disabledButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Loading and Login
    loginPrompt: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
});