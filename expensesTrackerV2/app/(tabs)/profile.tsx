import React, { useEffect, useState, useContext, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    Image,
    RefreshControl
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AuthContext } from '../_layout';
import { getApp } from '@react-native-firebase/app';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [userStats, setUserStats] = useState({
        totalExpenses: 0,
        monthlySpent: 0,
        activeBudgets: 0,
        totalBudgets: 0
    });
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (user) {
            loadUserStats(user.uid);
        }
    }, [user]);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (user) {
                loadUserStats(user.uid);
            }
        }, [user])
    );

    const loadUserStats = async (userId: string) => {
        try {
            // Get total expenses count
            const expensesSnapshot = await firestore()
                .collection('expenses')
                .where('userId', '==', userId)
                .get();

            // Get current month expenses
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            let monthlyTotal = 0;
            expensesSnapshot.docs.forEach(doc => {
                const expense = doc.data();
                const expenseDate = expense.createdAt?.toDate() || new Date(expense.transactionDate);

                if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
                    monthlyTotal += expense.amount || 0;
                }
            });

            // Get budgets count
            const budgetsSnapshot = await firestore()
                .collection('budgets')
                .where('userId', '==', userId)
                .get();

            const activeBudgets = budgetsSnapshot.docs.filter(doc => doc.data().isActive).length;

            setUserStats({
                totalExpenses: expensesSnapshot.docs.length,
                monthlySpent: monthlyTotal,
                activeBudgets: activeBudgets,
                totalBudgets: budgetsSnapshot.docs.length
            });
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    };

    const onRefresh = useCallback(async () => {
        if (user) {
            setRefreshing(true);
            try {
                await loadUserStats(user.uid);
            } catch (error) {
                console.error('Error refreshing profile data:', error);
            } finally {
                setRefreshing(false);
            }
        }
    }, [user]);

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // First try to sign out from Google
                            try {
                                const isSignedIn = await GoogleSignin.getCurrentUser();
                                if (isSignedIn) {
                                    await GoogleSignin.revokeAccess();
                                    await GoogleSignin.signOut();
                                }
                            } catch (googleError) {
                                console.log('Google sign out error:', googleError);
                                // Continue with Firebase sign out even if Google sign out fails
                            }

                            // Sign out from Firebase using the new API
                            const app = getApp();
                            const firebaseAuth = auth(app);
                            await firebaseAuth.signOut();

                            console.log('User signed out successfully');
                        } catch (error) {
                            console.error('Error signing out:', error);
                            Alert.alert(
                                'Error',
                                'There was an issue signing out. Please force close the app and try again.'
                            );
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#4285F4" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
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
                    <Text style={styles.title}>👤 Profile</Text>
                </View>

                {/* User Info Card */}
                <View style={styles.userCard}>
                    <View style={styles.userInfo}>
                        {user.photoURL ? (
                            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>
                                    {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.userDetails}>
                            <Text style={styles.userName}>
                                {user.displayName || 'User'}
                            </Text>
                            <Text style={styles.userEmail}>{user.email}</Text>
                        </View>
                    </View>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    <Text style={styles.sectionTitle}>📊 Your Statistics</Text>

                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>{userStats.totalExpenses}</Text>
                            <Text style={styles.statLabel}>Total Expenses</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>RM {userStats.monthlySpent.toFixed(0)}</Text>
                            <Text style={styles.statLabel}>This Month</Text>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>{userStats.activeBudgets}</Text>
                            <Text style={styles.statLabel}>Active Budgets</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>{userStats.totalBudgets}</Text>
                            <Text style={styles.statLabel}>Total Budgets</Text>
                        </View>
                    </View>
                </View>

                {/* Settings Section */}
                <View style={styles.settingsContainer}>
                    <Text style={styles.sectionTitle}>⚙️ Settings</Text>

                    <View style={styles.settingCard}>
                        <Text style={styles.settingTitle}>💰 Currency</Text>
                        <Text style={styles.settingValue}>Malaysian Ringgit (MYR)</Text>
                    </View>

                    <View style={styles.settingCard}>
                        <Text style={styles.settingTitle}>🌍 Timezone</Text>
                        <Text style={styles.settingValue}>Asia/Kuala_Lumpur</Text>
                    </View>

                    <View style={styles.settingCard}>
                        <Text style={styles.settingTitle}>🔔 Notifications</Text>
                        <Text style={styles.settingValue}>Budget & Overspending Alerts</Text>
                    </View>
                </View>

                {/* Sign Out Button */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={[styles.signOutButton, loading && styles.disabledButton]}
                        onPress={handleSignOut}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.signOutButtonText}>🚪 Sign Out</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoText}>
                        Expense Tracker v1.0 • Made for Malaysian users
                    </Text>
                </View>
            </ScrollView>
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
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    userCard: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 16,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textTransform: 'uppercase',
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
    },
    statsContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4285F4',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    settingsContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    settingCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    settingValue: {
        fontSize: 14,
        color: '#666',
    },
    actionContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    signOutButton: {
        backgroundColor: '#FF6B6B',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.6,
    },
    signOutButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    appInfo: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        alignItems: 'center',
    },
    appInfoText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
    },
});