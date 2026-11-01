import { emailSchema, otpSchema } from '@parkhere/shared';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { DevPasswordSignIn } from '@/components/dev-password-sign-in';
import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme';

type Step = { name: 'email' } | { name: 'code'; email: string } | { name: 'dev-password' };

export default function SignInScreen() {
  const [step, setStep] = useState<Step>({ name: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setStep({ name: 'code', email: parsed.data });
  }

  async function verifyCode(currentEmail: string) {
    const parsed = otpSchema.safeParse(code.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.verifyOtp({
      email: currentEmail,
      token: parsed.data,
      type: 'email',
    });
    setLoading(false);
    // On success the auth listener updates the session and the router guard
    // moves the user into the app.
    if (authError) setError(authError.message);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Title>ParkHere</Title>
        {step.name === 'email' ? (
          <View style={styles.form}>
            <Body muted>Sign in or create an account with your email.</Body>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              onSubmitEditing={sendCode}
            />
            <ErrorText>{error}</ErrorText>
            <Button label="Send code" onPress={sendCode} loading={loading} />
            {__DEV__ ? (
              <Button
                label="Developer sign-in (password)"
                variant="secondary"
                onPress={() => {
                  setError(null);
                  setStep({ name: 'dev-password' });
                }}
              />
            ) : null}
          </View>
        ) : step.name === 'dev-password' ? (
          <View style={styles.form}>
            <DevPasswordSignIn />
            <Button
              label="Back to email code"
              variant="secondary"
              onPress={() => setStep({ name: 'email' })}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Body muted>Enter the 6-digit code we sent to {step.email}.</Body>
            <TextField
              label="Code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={() => verifyCode(step.email)}
            />
            <ErrorText>{error}</ErrorText>
            <Button label="Verify" onPress={() => verifyCode(step.email)} loading={loading} />
            <Button
              label="Use a different email"
              variant="secondary"
              onPress={() => {
                setCode('');
                setError(null);
                setStep({ name: 'email' });
              }}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  form: { gap: spacing.md },
});
