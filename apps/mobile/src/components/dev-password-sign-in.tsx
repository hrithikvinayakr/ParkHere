import { emailSchema } from '@parkhere/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Body, Button, ErrorText, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme';

const passwordSchema = z.string().min(8, 'Use at least 8 characters');

/**
 * Email + password sign-in for development only (rendered when __DEV__ is true),
 * so the app can be tested without a working email sender. Sign-up returns a
 * session only when "Confirm email" is turned off in Supabase Auth settings.
 */
export function DevPasswordSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'sign-in' | 'sign-up' | null>(null);

  function validate() {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setError(parsedEmail.error.issues[0]?.message ?? 'Enter a valid email address');
      return null;
    }
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      setError(parsedPassword.error.issues[0]?.message ?? 'Enter a password');
      return null;
    }
    setError(null);
    return { email: parsedEmail.data, password: parsedPassword.data };
  }

  async function signIn() {
    const credentials = validate();
    if (!credentials) return;
    setLoading('sign-in');
    const { error: authError } = await supabase.auth.signInWithPassword(credentials);
    setLoading(null);
    if (authError) setError(authError.message);
  }

  async function signUp() {
    const credentials = validate();
    if (!credentials) return;
    setLoading('sign-up');
    const { data, error: authError } = await supabase.auth.signUp(credentials);
    setLoading(null);
    if (authError) {
      setError(authError.message);
    } else if (!data.session) {
      setError(
        'Account created, but Supabase wants email confirmation. Turn off "Confirm email" in Authentication settings, then sign in.',
      );
    }
  }

  return (
    <View style={styles.form}>
      <Body muted>Developer sign-in — only visible in development builds.</Body>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={signIn}
      />
      <ErrorText>{error}</ErrorText>
      <Button
        label="Sign in"
        onPress={signIn}
        loading={loading === 'sign-in'}
        disabled={loading !== null}
      />
      <Button
        label="Create account"
        variant="secondary"
        onPress={signUp}
        loading={loading === 'sign-up'}
        disabled={loading !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
