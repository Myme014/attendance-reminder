import { AppFonts } from '@/constants/theme';
import {
    createDefaultSettings,
    formatTime,
    getSettings,
    resetAllData,
    saveSettings,
    Settings
} from '@/utils/storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(createDefaultSettings());
  const [hasChanges, setHasChanges] = useState(false);

  // Time picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    periodIdx: number;
    type: 'start' | 'end';
  } | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    const data = await getSettings();
    setSettings(data);
    setHasChanges(false);
  };

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await saveSettings(settings);
    setHasChanges(false);
    Alert.alert('保存完了', '設定を保存しました。');
  };

  const changeMaxPeriods = (delta: number) => {
    const newMax = Math.min(8, Math.max(1, settings.maxPeriods + delta));
    updateSettings({ maxPeriods: newMax });
  };

  const openTimePicker = (periodIdx: number, type: 'start' | 'end') => {
    const pt = settings.periodTimes[periodIdx];
    if (!pt) return;
    const d = new Date();
    if (type === 'start') {
      d.setHours(pt.startHour, pt.startMinute, 0, 0);
    } else {
      d.setHours(pt.endHour, pt.endMinute, 0, 0);
    }
    setPickerDate(d);
    setPickerTarget({ periodIdx, type });
    setPickerVisible(true);
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    if (!selectedDate || !pickerTarget) return;

    setPickerDate(selectedDate);

    
    if (Platform.OS === 'android') {
      saveTimeSetting(selectedDate);
      setPickerVisible(false);
      setPickerTarget(null);
    }
  };

  const saveTimeSetting = (date: Date) => {
    if (!pickerTarget) return;
    const newTimes = [...settings.periodTimes];
    const pt = { ...newTimes[pickerTarget.periodIdx] };
    if (pickerTarget.type === 'start') {
      pt.startHour = date.getHours();
      pt.startMinute = date.getMinutes();
    } else {
      pt.endHour = date.getHours();
      pt.endMinute = date.getMinutes();
    }
    newTimes[pickerTarget.periodIdx] = pt;
    updateSettings({ periodTimes: newTimes });
  };

  const confirmTimePicker = () => {
    if (pickerTarget && pickerDate) {
      saveTimeSetting(pickerDate);
    }
    setPickerVisible(false);
    setPickerTarget(null);
  };

  const handleResetAll = () => {
    Alert.alert(
      '確認',
      '本当にリセットしますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: async () => {
            try {
              // 通知キャンセルが失敗してもデータ初期化は必ず実行する
              await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
              const defaultSettings = await resetAllData();
              setSettings(defaultSettings);
              setHasChanges(false);
              Alert.alert('完了', '全データをリセットしました。');
            } catch {
              Alert.alert('エラー', 'リセットに失敗しました。もう一度お試しください。');
            }
          },
        },
      ]
    );
  };

  const changeNotifyBefore = (delta: number) => {
    const newVal = Math.min(30, Math.max(0, settings.notifyBeforeDefault + delta));
    updateSettings({ notifyBeforeDefault: newVal });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: 'rgba(63, 78, 103, 0.92)' }]}>
        <Text style={styles.headerTitle}>設定</Text>
        <Text style={styles.headerSubtitle}>時間割・通知の設定</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Max Periods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最大限数</Text>
          <Text style={styles.sectionDesc}>大学の時間割の最大コマ数を設定</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperButton, settings.maxPeriods <= 1 && styles.stepperDisabled]}
              onPress={() => changeMaxPeriods(-1)}
              disabled={settings.maxPeriods <= 1}
            >
              <Text style={styles.stepperText}>−</Text>
            </TouchableOpacity>
            <View style={styles.stepperValue}>
              <Text style={styles.stepperValueText}>{settings.maxPeriods}限</Text>
            </View>
            <TouchableOpacity
              style={[styles.stepperButton, settings.maxPeriods >= 8 && styles.stepperDisabled]}
              onPress={() => changeMaxPeriods(1)}
              disabled={settings.maxPeriods >= 8}
            >
              <Text style={styles.stepperText}>＋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Period Times */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>時限の時間帯</Text>
          <Text style={styles.sectionDesc}>各時限の開始・終了時刻を設定</Text>
          {settings.periodTimes.slice(0, settings.maxPeriods).map((pt, idx) => (
            <View key={idx} style={styles.periodTimeRow}>
              <View style={styles.periodLabel}>
                <Text style={styles.periodLabelText}>{idx + 1}限</Text>
              </View>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => openTimePicker(idx, 'start')}
              >
                <Text style={styles.timeButtonText}>
                  {formatTime(pt.startHour, pt.startMinute)}
                </Text>
              </TouchableOpacity>
              <Text style={styles.timeSeparator}>〜</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => openTimePicker(idx, 'end')}
              >
                <Text style={styles.timeButtonText}>
                  {formatTime(pt.endHour, pt.endMinute)}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Default URL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ポータルサイトURL設定</Text>
          <Text style={styles.sectionDesc}>出席コード入力ページのURLを設定</Text>
          <TextInput
            style={styles.urlInput}
            placeholder="https://example.com/attendance"
            placeholderTextColor="#AAB2C0"
            value={settings.defaultUrl}
            onChangeText={text => updateSettings({ defaultUrl: text })}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Default Notify Before */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知タイミング設定</Text>
          <Text style={styles.sectionDesc}>授業の何分前に通知するか</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperButton, settings.notifyBeforeDefault <= 0 && styles.stepperDisabled]}
              onPress={() => changeNotifyBefore(-1)}
              disabled={settings.notifyBeforeDefault <= 0}
            >
              <Text style={styles.stepperText}>−</Text>
            </TouchableOpacity>
            <View style={styles.stepperValue}>
              <Text style={styles.stepperValueText}>
                {settings.notifyBeforeDefault === 0 ? '時間通り' : `${settings.notifyBeforeDefault}分前`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.stepperButton, settings.notifyBeforeDefault >= 30 && styles.stepperDisabled]}
              onPress={() => changeNotifyBefore(1)}
              disabled={settings.notifyBeforeDefault >= 30}
            >
              <Text style={styles.stepperText}>＋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <TouchableOpacity style={styles.saveButtonWrapper} onPress={handleSave}>
            <View style={[styles.saveButton, { backgroundColor: 'rgba(63, 78, 103, 0.92)' }]}>
              <Text style={styles.saveButtonText}>設定を保存</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Danger Zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetAll}>
            <Text style={styles.resetButtonText}>全データをリセット</Text>
          </TouchableOpacity>
        </View>

        {/* OSS Licenses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ライセンス</Text>
          <TouchableOpacity style={styles.licenseButton} onPress={() => router.push('/licenses')}>
            <Text style={styles.licenseButtonText}>表示する</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Time Picker Modal (iOS) */}
      {Platform.OS === 'ios' && pickerVisible && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={confirmTimePicker}>
                  <Text style={styles.pickerDone}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="time"
                is24Hour={true}
                display="spinner"
                themeVariant="light"
                textColor="#2D3142"
                accentColor="#3F4E67"
                onChange={handleTimeChange}
                style={{ height: 220, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker (Android) */}
      {Platform.OS === 'android' && pickerVisible && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Time Picker (Web) */}
      {Platform.OS === 'web' && pickerVisible && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={confirmTimePicker}>
                  <Text style={styles.pickerDone}>完了</Text>
                </TouchableOpacity>
              </View>
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ marginBottom: 10, fontSize: 16 }}>Webブラウザでは下の入力欄で変更できます:</Text>
                <TextInput
                  style={[styles.urlInput, { minWidth: 150, textAlign: 'center', fontSize: 24 }]}
                  defaultValue={formatTime(pickerDate.getHours(), pickerDate.getMinutes())}
                  keyboardType="numbers-and-punctuation"
                  onSubmitEditing={(e) => {
                    const text = e.nativeEvent.text;
                    const parts = text.split(':');
                    if (parts.length === 2) {
                      const h = parseInt(parts[0], 10);
                      const m = parseInt(parts[1], 10);
                      if (!isNaN(h) && !isNaN(m)) {
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
                        handleTimeChange(null, d);
                      }
                    }
                    confirmTimePicker();
                  }}
                  placeholder="09:00"
                />
                <Text style={{ marginTop: 10, color: '#666', fontSize: 12 }}>入力後、Enterキーを押すか「完了」を押してください。</Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F8',
    overflow: 'visible',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 68 : 46,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: AppFonts.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: AppFonts.regular,
    color: '#F1F1F1',
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
    marginBottom: 4,
    textAlign: 'center',
    
  },
  sectionDesc: {
    fontSize: 13,
    fontFamily: AppFonts.regular,
    color: '#AAB2C0',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperDisabled: {
    opacity: 0.3,
  },
  stepperText: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
  },
  stepperValue: {
    minWidth: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
  },
  // Period times
  periodTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  periodLabel: {
    width: 40,
    paddingVertical: 6,
    backgroundColor: 'rgba(63, 77, 103, 0.86)',
    borderRadius: 8,
    alignItems: 'center',
  },
  periodLabelText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: AppFonts.bold,
    color: '#fff',
  },
  timeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F8F9FC',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: AppFonts.medium,
    color: '#2D3142',
  },
  timeSeparator: {
    fontSize: 16,
    fontFamily: AppFonts.regular,
    color: '#AAB2C0',
  },
  // URL input
  urlInput: {
    backgroundColor: '#F8F9FC',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    fontFamily: AppFonts.regular,
    color: '#2D3142',
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  // Save button
  saveButtonWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#4facfe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButton: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
  },
  // Danger zone
  dangerSection: {
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  resetButton: {
    backgroundColor: '#FFF0F0',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#E53935',
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    fontSize: 15,
  },
  licenseButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9DFEA',
  },
  licenseButtonText: {
    color: '#2D3142',
    fontFamily: AppFonts.medium,
    fontSize: 14,
  },
  // Picker modal (iOS)
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAF0',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#4facfe',
  },
});
