import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useAppMode } from '@/stores/app-mode';
import { spacing } from '@/theme';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { mode, setMode } = useAppMode();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const { error: authError } = await supabase.auth.signOut();
    setSigningOut(false);
    if (authError) setError(authError.message);
  }

  return (
    <Screen>
      <Title>Profile</Title>
      <View style={styles.sections}>
        <Card>
          <Body muted>Signed in as</Body>
          <Body>{session?.user.email}</Body>
        </Card>

        <Card>
          <Body muted>Mode</Body>
          <Body>
            {mode === 'driver'
              ? 'You are looking for parking.'
              : 'You are managing your parking spots.'}
          </Body>
          <View style={styles.modeButton}>
            <Button
              label={mode === 'driver' ? 'Switch to host mode' : 'Switch to driver mode'}
              variant="secondary"
              onPress={() => setMode(mode === 'driver' ? 'host' : 'driver')}
            />
          </View>
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button label="Sign out" variant="secondary" onPress={signOut} loading={signingOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing.md },
  modeButton: { marginTop: spacing.sm },
});
