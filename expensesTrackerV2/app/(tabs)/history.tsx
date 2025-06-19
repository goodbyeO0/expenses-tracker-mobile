import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Dimensions,
    Modal,
    Alert,
    RefreshControl,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

interface Expense {
    id: string;
    userId: string;
    amount: number;
    merchantName: string;
    referenceId: string;
    transactionDate: string;
    description: string;
    category: string;
    location?: {
        latitude: number;
        longitude: number;
        address: string;
        city: string;
    };
    createdAt: any;
    updatedAt: any;
}

interface Category {
    id: string;
    name: string;
    icon: string;
    color?: string;
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

export default function HistoryScreen() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<Category[]>(defaultCategories);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showFilters, setShowFilters] = useState(false);
    const [totalSpent, setTotalSpent] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged((user) => {
            if (user) {
                loadExpenses();
                loadCategories();
            } else {
                setExpenses([]);
                setFilteredExpenses([]);
                setTotalSpent(0);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        filterAndSortExpenses();
    }, [expenses, searchText, selectedCategory, sortBy, sortOrder]);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            const currentUser = auth().currentUser;
            if (currentUser) {
                loadExpenses();
                loadCategories();
            }
        }, [])
    );

    const loadExpenses = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            console.log('Loading expenses for user:', currentUser.uid);
            // First, get all expenses for the user without ordering (to avoid index requirement)
            const snapshot = await firestore()
                .collection('expenses')
                .where('userId', '==', currentUser.uid)
                .get();

            const expenseData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Expense[];

            // Sort the data in JavaScript instead of in the query
            expenseData.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date();
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date();
                return dateB.getTime() - dateA.getTime(); // Newest first
            });

            console.log('Loaded expenses:', expenseData.length);
            setExpenses(expenseData);

            // Calculate total spent
            const total = expenseData.reduce((sum, expense) => sum + expense.amount, 0);
            setTotalSpent(total);
        } catch (error) {
            console.error('Error loading expenses:', error);
            Alert.alert('Error', 'Failed to load expense history');
        } finally {
            setLoading(false);
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

    const filterAndSortExpenses = () => {
        let filtered = [...expenses];

        // Filter by search text
        if (searchText.trim()) {
            filtered = filtered.filter(expense =>
                expense.merchantName.toLowerCase().includes(searchText.toLowerCase()) ||
                expense.description.toLowerCase().includes(searchText.toLowerCase()) ||
                expense.referenceId.toLowerCase().includes(searchText.toLowerCase())
            );
        }

        // Filter by category
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(expense => expense.category === selectedCategory);
        }

        // Sort expenses
        filtered.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'date') {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date();
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date();
                comparison = dateA.getTime() - dateB.getTime();
            } else if (sortBy === 'amount') {
                comparison = a.amount - b.amount;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        setFilteredExpenses(filtered);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadExpenses();
            await loadCategories();
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const getCategoryInfo = (categoryId: string) => {
        return categories.find(cat => cat.id === categoryId) ||
            { name: 'Other', icon: '📦', color: '#A8A8A8' };
    };

    const getExpenseTitle = (expense: Expense) => {
        // If description exists and is not empty, use it
        if (expense.description && expense.description.trim()) {
            return expense.description.trim();
        }

        // Otherwise show "No description"
        return 'No description';
    };

    const formatDate = (timestamp: any) => {
        try {
            const date = timestamp?.toDate?.() || new Date(timestamp) || new Date();
            return date.toLocaleDateString('en-MY', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (error) {
            return 'Unknown date';
        }
    };

    const formatTime = (timestamp: any) => {
        try {
            const date = timestamp?.toDate?.() || new Date(timestamp) || new Date();
            return date.toLocaleTimeString('en-MY', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '';
        }
    };

    const renderExpenseItem = (expense: Expense) => {
        const categoryInfo = getCategoryInfo(expense.category);

        return (
            <View key={expense.id} style={styles.expenseItem}>
                <View style={styles.expenseHeader}>
                    <View style={styles.merchantInfo}>

                        <View style={styles.merchantDetails}>
                            <Text style={styles.expenseType} numberOfLines={1} ellipsizeMode="tail">
                                {getExpenseTitle(expense)}
                            </Text>
                            <Text style={styles.merchantName} numberOfLines={1} ellipsizeMode="tail">
                                {expense.merchantName}
                            </Text>
                            <Text style={styles.categoryName}>{categoryInfo.name}</Text>
                        </View>
                    </View>
                    <View style={styles.amountContainer}>
                        <Text style={styles.amount}>-RM {expense.amount.toFixed(2)}</Text>
                        <Text style={styles.date}>{formatDate(expense.createdAt)}</Text>
                    </View>
                </View>


                <View style={styles.expenseFooter}>
                    <View style={styles.metaInfo}>
                        {expense.location && (
                            <View style={styles.metaItem}>
                                <Text style={styles.metaIcon}>📍</Text>
                                <Text style={styles.location}>{expense.location.city}</Text>
                            </View>
                        )}
                        {expense.referenceId && (
                            <View style={styles.metaItem}>
                                <Text style={styles.metaIcon}>🧾</Text>
                                <Text style={styles.referenceId}>{expense.referenceId}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.time}>{formatTime(expense.createdAt)}</Text>
                </View>
            </View>
        );
    };

    const renderFilterModal = () => (
        <Modal
            visible={showFilters}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowFilters(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Filter & Sort</Text>
                        <TouchableOpacity onPress={() => setShowFilters(false)}>
                            <Text style={styles.closeButton}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Category Filter */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.categoryFilters}>
                                <TouchableOpacity
                                    style={[styles.categoryFilter, selectedCategory === 'all' && styles.selectedFilter]}
                                    onPress={() => setSelectedCategory('all')}
                                >
                                    <Text style={styles.categoryFilterText}>All</Text>
                                </TouchableOpacity>
                                {categories.map(category => (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={[styles.categoryFilter, selectedCategory === category.id && styles.selectedFilter]}
                                        onPress={() => setSelectedCategory(category.id)}
                                    >
                                        <Text style={styles.categoryFilterIcon}>{category.icon}</Text>
                                        <Text style={styles.categoryFilterText}>{category.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Sort Options */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Sort By</Text>
                        <View style={styles.sortOptions}>
                            <TouchableOpacity
                                style={[styles.sortOption, sortBy === 'date' && styles.selectedSort]}
                                onPress={() => setSortBy('date')}
                            >
                                <Text style={styles.sortOptionText}>Date</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sortOption, sortBy === 'amount' && styles.selectedSort]}
                                onPress={() => setSortBy('amount')}
                            >
                                <Text style={styles.sortOptionText}>Amount</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.sortOptions}>
                            <TouchableOpacity
                                style={[styles.sortOption, sortOrder === 'desc' && styles.selectedSort]}
                                onPress={() => setSortOrder('desc')}
                            >
                                <Text style={styles.sortOptionText}>Newest First</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sortOption, sortOrder === 'asc' && styles.selectedSort]}
                                onPress={() => setSortOrder('asc')}
                            >
                                <Text style={styles.sortOptionText}>Oldest First</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.applyButton}
                        onPress={() => setShowFilters(false)}
                    >
                        <Text style={styles.applyButtonText}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'right', 'left']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4285F4" />
                    <Text style={styles.loadingText}>Loading your expense history...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'right', 'left']}>
            <View style={styles.header}>
                <Text style={styles.title}>💰 Expense History</Text>
                <Text style={styles.subtitle}>
                    Total: RM {totalSpent.toFixed(2)} • {filteredExpenses.length} transactions
                </Text>
            </View>

            {/* Search and Filter Bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search merchants, descriptions..."
                    value={searchText}
                    onChangeText={setSearchText}
                />
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilters(true)}
                >
                    <Text style={styles.filterButtonText}>🔽</Text>
                </TouchableOpacity>
            </View>

            {/* Expense List */}
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
                {filteredExpenses.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📊</Text>
                        <Text style={styles.emptyTitle}>No expenses found</Text>
                        <Text style={styles.emptySubtitle}>
                            {expenses.length === 0
                                ? "Start by scanning your first receipt!"
                                : "Try adjusting your search or filters"
                            }
                        </Text>
                    </View>
                ) : (
                    filteredExpenses.map(renderExpenseItem)
                )}
            </ScrollView>

            {renderFilterModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6c757d',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6c757d',
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',

        gap: 12,
    },
    searchInput: {
        backgroundColor: '#6c757d',
        flex: 1,
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    filterButton: {
        width: 44,
        height: 44,
        backgroundColor: '#4285F4',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterButtonText: {
        fontSize: 16,
        color: '#fff',
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    expenseItem: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 0.5,
        borderColor: '#f0f0f0',
    },
    expenseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    merchantInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        marginRight: 16,
    },
    categoryIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    categoryIcon: {
        fontSize: 22,
    },
    merchantDetails: {
        flex: 1,
        minWidth: 0, // This allows the text to shrink and wrap
    },
    expenseType: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 2,
        letterSpacing: -0.4,
        textTransform: 'capitalize',
    },
    merchantName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#8e8e93',
        marginBottom: 2,
        letterSpacing: -0.1,
    },
    categoryName: {
        fontSize: 13,
        color: '#8e8e93',
        fontWeight: '500',
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: 19,
        fontWeight: '800',
        color: '#ff3b30',
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    date: {
        fontSize: 11,
        color: '#8e8e93',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    descriptionContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    description: {
        fontSize: 14,
        color: '#495057',
        lineHeight: 20,
        fontStyle: 'italic',
    },
    expenseFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: 12,
        borderTopWidth: 0.5,
        borderTopColor: '#f0f0f0',
    },
    metaInfo: {
        flex: 1,
        gap: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaIcon: {
        fontSize: 12,
        opacity: 0.8,
    },
    location: {
        fontSize: 12,
        color: '#34c759',
        fontWeight: '500',
    },
    referenceId: {
        fontSize: 12,
        color: '#8e8e93',
        fontWeight: '500',
    },
    time: {
        fontSize: 11,
        color: '#8e8e93',
        fontWeight: '500',
        textAlign: 'right',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        fontSize: 24,
        color: '#6c757d',
    },
    filterSection: {
        marginBottom: 24,
    },
    filterTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    categoryFilters: {
        flexDirection: 'row',
        gap: 8,
    },
    categoryFilter: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
        gap: 4,
    },
    selectedFilter: {
        backgroundColor: '#4285F4',
        borderColor: '#4285F4',
    },
    categoryFilterIcon: {
        fontSize: 16,
    },
    categoryFilterText: {
        fontSize: 14,
        color: '#333',
    },
    sortOptions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    sortOption: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    selectedSort: {
        backgroundColor: '#4285F4',
        borderColor: '#4285F4',
    },
    sortOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
    applyButton: {
        backgroundColor: '#28a745',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
}); 