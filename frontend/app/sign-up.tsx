// app/sign-up.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons';
import { useApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = {
  brand: '#2E7D6E',
  bg: '#FAFAFA',
  text: '#111827',
  muted: '#9CA3AF',
  white: '#FFFFFF',
  border: '#EEEEEE',
};

export default function SignUpScreen() {
  const api = useApi();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const onSignUpPress = async () => {
    if (!name || !emailAddress || !password) {
      Alert.alert('Missing info', 'Please fill out all fields.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.register(name, emailAddress, password);
      if (data && data.token) await login(data.token);
    } catch (err: any) {
      Alert.alert('Registration failed', err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 20}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={styles.container}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>₹</Text>
            </View>
            <Text style={styles.brandName}>Spendly</Text>
          </View>

          <Text style={styles.headline}>Create account</Text>
          <Text style={styles.subheadline}>Join thousands taking control of their finances.</Text>

          <View style={styles.form}>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={name}
                placeholder="e.g. Aryan Sharma"
                placeholderTextColor={C.muted}
                onChangeText={setName}
                style={[styles.input, focusedField === 'name' && styles.inputFocused]}
                editable={!loading}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                value={emailAddress}
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
                onChangeText={setEmailAddress}
                style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                keyboardType="email-address"
                editable={!loading}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={C.muted}
                  onChangeText={setPassword}
                  style={[styles.input, styles.passwordInput, focusedField === 'password' && styles.inputFocused]}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon} 
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={20} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={styles.termsText}>
            By signing up, you agree to our <Text style={styles.termsLink}>Terms</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onSignUpPress}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={C.white} size="small" /> : <Text style={styles.buttonText}>Create account</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/sign-in" asChild>
              <TouchableOpacity disabled={loading}>
                <Text style={styles.link}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </MotiView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  container: { paddingHorizontal: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  logoIcon: { fontSize: 17, color: C.white, fontWeight: '700' },
  brandName: { fontSize: 18, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  headline: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 6, letterSpacing: -0.4 },
  subheadline: { fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 20 },
  form: { gap: 16, marginBottom: 16 },
  fieldWrap: { gap: 7 },
  label: { fontSize: 11, fontWeight: '600', color: C.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 14, fontSize: 15, color: C.text,
  },
  inputFocused: { borderColor: C.brand },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 45 },
  eyeIcon: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center' },
  termsText: { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 20, textAlign: 'center' },
  termsLink: { color: C.brand, fontWeight: '700' },
  button: { backgroundColor: C.text, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: C.white, fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { color: C.muted, fontSize: 14 },
  link: { color: C.brand, fontSize: 14, fontWeight: '700' },
});