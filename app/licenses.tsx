import { LICENSES_CONTENT } from '@/app/licenses-content';
import { AppFonts } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function LicensesScreen() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadLicenseText = async () => {
      try {
        // Simulate async load for consistency
        await new Promise(resolve => setTimeout(resolve, 100));

        if (mounted) {
          setContent(LICENSES_CONTENT);
          setError(null);
        }
      } catch {
        if (mounted) {
          setError('ライセンス情報の読み込みに失敗しました。');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadLicenseText();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color="#6A7383" />
          <Text style={styles.stateInfoText}>ライセンス情報を読み込み中...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateErrorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>ライセンス</Text>
          <Text style={styles.description}>アプリで利用しているオープンソースライセンス一覧</Text>
          <View style={styles.divider} />
          <Text selectable style={styles.body}>{content}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 20,
    color: '#2D3142',
    fontFamily: AppFonts.bold,
  },
  description: {
    marginTop: 6,
    fontSize: 13,
    color: '#697284',
    fontFamily: AppFonts.regular,
  },
  divider: {
    marginTop: 12,
    marginBottom: 12,
    height: 1,
    backgroundColor: '#E7EAF0',
  },
  stateInfoText: {
    fontSize: 14,
    fontFamily: AppFonts.regular,
    color: '#6A7383',
  },
  stateErrorText: {
    fontSize: 14,
    fontFamily: AppFonts.medium,
    color: '#AD2424',
    textAlign: 'center',
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: AppFonts.regular,
    color: '#2D3142',
  },
});
