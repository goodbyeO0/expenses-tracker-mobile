import React, { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
    Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin, type User } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';
import { AuthContext } from './_layout';
import { getApp } from '@react-native-firebase/app';
import googleServices from "../google-services.json";

const { width, height } = Dimensions.get('window');

// Extract webClientId from google-services.json
const getWebClientId = () => {
    const client = googleServices.client[0];
    const webClient = client.oauth_client.find(client => client.client_type === 3);
    return webClient?.client_id || '';
};

// Configure Google Sign-In
GoogleSignin.configure({
    webClientId: getWebClientId(),
    offlineAccess: true,
});

export default function AuthScreen() {
    const [loading, setLoading] = useState(false);
    const { user, initializing } = useContext(AuthContext);

    useEffect(() => {
        if (!initializing && user) {
            console.log('User authenticated, redirecting to main app...');
            router.replace('/(tabs)');
        }
    }, [user, initializing]);

    // If user is already authenticated, don't show auth screen
    if (user) {
        return null;
    }

    const createUserProfile = async (user: FirebaseAuthTypes.User) => {
        const app = getApp();
        const db = firestore(app);
        const userRef = db.collection('users').doc(user.uid);

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
        }
    };

    const signInWithGoogle = async () => {
        setLoading(true);
        try {
            console.log('Starting Google Sign-In...');

            // Check if your device supports Google Play
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Sign in and get tokens
            await GoogleSignin.signIn();
            const { accessToken } = await GoogleSignin.getTokens();

            if (!accessToken) {
                throw new Error('Failed to get access token from Google Sign-In');
            }

            // Create a Google credential with the token
            const app = getApp();
            const firebaseAuth = auth(app);
            const googleCredential = auth.GoogleAuthProvider.credential(null, accessToken);

            // Sign-in the user with the credential
            const userCredential = await firebaseAuth.signInWithCredential(googleCredential);
            console.log('User signed in:', userCredential.user.email);

            // Create user profile in Firestore
            await createUserProfile(userCredential.user);

            Alert.alert(
                'Welcome! 🎉',
                `Successfully signed in as ${userCredential.user.displayName || userCredential.user.email}`,
                [{ text: 'Continue', style: 'default' }]
            );

        } catch (error) {
            console.error('Google Sign-In Error:', error);
            Alert.alert(
                'Sign In Error',
                'Failed to sign in with Google. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoIcon}>💰</Text>
                    </View>
                    <Text style={styles.title}>Expense Tracker</Text>
                    <Text style={styles.subtitle}>
                        Track your expenses with smart OCR receipt scanning
                    </Text>
                </View>

                {/* Features Section */}
                <View style={styles.featuresContainer}>
                    <View style={styles.feature}>
                        <Text style={styles.featureIcon}>📱</Text>
                        <Text style={styles.featureText}>Scan PDF receipts instantly</Text>
                    </View>
                    <View style={styles.feature}>
                        <Text style={styles.featureIcon}>📊</Text>
                        <Text style={styles.featureText}>Smart budget tracking</Text>
                    </View>
                    <View style={styles.feature}>
                        <Text style={styles.featureIcon}>🚨</Text>
                        <Text style={styles.featureText}>Overspending alerts</Text>
                    </View>
                    <View style={styles.feature}>
                        <Text style={styles.featureIcon}>📍</Text>
                        <Text style={styles.featureText}>Location-based expenses</Text>
                    </View>
                </View>

                {/* Sign In Button */}
                <View style={styles.authContainer}>
                    <TouchableOpacity
                        style={[styles.googleButton, loading && styles.disabledButton]}
                        onPress={signInWithGoogle}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={styles.googleIcon}>🔐</Text>
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.disclaimer}>
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </Text>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Made for Malaysian users • MYR currency • Secure & Private
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    logoIcon: {
        fontSize: 36,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    featuresContainer: {
        marginBottom: 48,
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    featureIcon: {
        fontSize: 24,
        marginRight: 16,
    },
    featureText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    authContainer: {
        alignItems: 'center',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4285F4',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    disabledButton: {
        opacity: 0.7,
    },
    googleIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    googleButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    disclaimer: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        marginTop: 24,
        lineHeight: 18,
        paddingHorizontal: 20,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
    },
}); 