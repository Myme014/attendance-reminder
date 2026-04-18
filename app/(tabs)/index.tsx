import { AppFonts } from '@/constants/theme';
import {
  DAY_LABELS,
  DEFAULT_SETTINGS,
  Settings,
  TimetableEntry,
  deleteTimetableEntry,
  formatTime,
  generateId,
  getSettings,
  getTimetable,
  upsertTimetableEntry,
} from '@/utils/storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── URL Security Helper ──────────────────────────────────────
// Only allow https to prevent abuse of tel:, file:, javascript:, http: etc.
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function safeOpenURL(url: string): Promise<void> {
  if (!isSafeUrl(url)) {
    Alert.alert(
      '無効なURL',
      'https:// で始まるURLのみ開けます。\n設定画面でURLを確認してください。'
    );
    return;
  }
  await Linking.openURL(url);
}

// Configure foreground notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function TimetableScreen() {
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDay();
    // Map: Sun=0 → 0(Mon), Mon=1 → 0, Tue=2 → 1, ...  Sat=6 → 4
    return today >= 1 && today <= 5 ? today - 1 : 0;
  });
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

  // Edit form state
  const [formLecture, setFormLecture] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [formIsEmpty, setFormIsEmpty] = useState(false);
  const [formNotifyBefore, setFormNotifyBefore] = useState(5);

  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | undefined>(undefined);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('通知をオンにしてください', 'リマインダーを受け取るには通知の許可が必要です。');
      }
    };
    requestPermissions();

    // Handle notification tap → open attendance URL
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const url = typeof data?.attendanceUrl === 'string' ? data.attendanceUrl : '';
      if (url) {
        safeOpenURL(url).catch(err =>
          console.error('URLを開けませんでした:', err)
        );
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const loadData = async () => {
    const [timetable, savedSettings] = await Promise.all([
      getTimetable(),
      getSettings(),
    ]);
    setEntries(timetable);
    setSettings(savedSettings);
  };

  // Get entries for a specific day, sorted by period
  const getDayEntries = (day: number): (TimetableEntry | null)[] => {
    const result: (TimetableEntry | null)[] = [];
    for (let p = 1; p <= settings.maxPeriods; p++) {
      const entry = entries.find(e => e.dayOfWeek === day && e.period === p);
      result.push(entry || null);
    }
    return result;
  };

  const openEditModal = (period: number, existing?: TimetableEntry) => {
    if (existing) {
      setEditingEntry(existing);
      setFormLecture(existing.lectureName);
      setFormUrl(existing.attendanceUrl);
      setFormMemo(existing.memo);
      setFormIsEmpty(existing.isEmpty);
      setFormNotifyBefore(existing.notifyBefore);
    } else {
      setEditingEntry(null);
      setFormLecture('');
      setFormUrl(settings.defaultUrl);
      setFormMemo('');
      setFormIsEmpty(false);
      setFormNotifyBefore(settings.notifyBeforeDefault);
    }
    setModalVisible(true);
  };

  const scheduleWeeklyNotification = async (entry: TimetableEntry): Promise<string | null> => {
    if (entry.isEmpty || !entry.lectureName.trim()) return null;

    const periodTime = settings.periodTimes[entry.period - 1];
    if (!periodTime) return null;

    // Calculate notification time (minutes before class start)
    let notifyHour = periodTime.startHour;
    let notifyMinute = periodTime.startMinute - entry.notifyBefore;
    if (notifyMinute < 0) {
      notifyHour -= 1;
      notifyMinute += 60;
    }

    // iOS weekday: 1=Sunday, 2=Monday, ... 6=Friday, 7=Saturday
    const iosWeekday = entry.dayOfWeek + 2; // dayOfWeek 0=Mon → iOS 2=Mon

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: ' 出席確認リマインダー',
          body: `「${entry.lectureName}」の出席コードを入力する時間です！`,
          data: {
            lectureName: entry.lectureName,
            attendanceUrl: entry.attendanceUrl || settings.defaultUrl,
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: iosWeekday,
          hour: notifyHour,
          minute: notifyMinute,
        },
      });
      return notificationId;
    } catch (error) {
      console.error('通知設定エラー:', error);
      return null;
    }
  };

  const saveEntry = async () => {
    const entry: TimetableEntry = {
      id: editingEntry?.id || generateId(),
      period: editingEntry?.period || 1,
      dayOfWeek: editingEntry?.dayOfWeek ?? selectedDay,
      lectureName: formIsEmpty ? '' : formLecture.trim(),
      attendanceUrl: formUrl.trim(),
      memo: formMemo.trim(),
      isEmpty: formIsEmpty,
      notifyBefore: formNotifyBefore,
      notificationId: null,
    };

    // Cancel old notification if exists
    if (editingEntry?.notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(editingEntry.notificationId);
      } catch {}
    }

    // Schedule new notification
    if (!entry.isEmpty && entry.lectureName) {
      entry.notificationId = await scheduleWeeklyNotification(entry);
    }

    const updated = await upsertTimetableEntry(entry);
    setEntries(updated);
    setModalVisible(false);
  };

  const handleDelete = async () => {
    if (!editingEntry) return;
    Alert.alert('削除確認', 'この授業を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          if (editingEntry.notificationId) {
            try {
              await Notifications.cancelScheduledNotificationAsync(editingEntry.notificationId);
            } catch {}
          }
          const updated = await deleteTimetableEntry(editingEntry.id);
          setEntries(updated);
          setModalVisible(false);
        },
      },
    ]);
  };

  const openUrl = (url: string) => {
    const targetUrl = url || settings.defaultUrl;
    if (!targetUrl) {
      Alert.alert('URL未設定', '設定画面でデフォルトの出席URLを設定してください。');
      return;
    }
    safeOpenURL(targetUrl).catch(() =>
      Alert.alert('エラー', 'URLを開けませんでした。')
    );
  };

  const dayEntries = getDayEntries(selectedDay);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: '#3F4E67', paddingTop: Platform.OS === 'ios' ? 68 : 46 },
        ]}
      >
        <Text style={styles.headerTitle}>時間割</Text>
        <Text style={styles.headerSubtitle}>出席リマインダー</Text>
      </View>

      {/* Day Tabs */}
      <View style={styles.dayTabsContainer}>
        {DAY_LABELS.map((label, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.dayTab,
              selectedDay === idx && styles.dayTabActive,
            ]}
            onPress={() => setSelectedDay(idx)}
          >
            <Text
              style={[
                styles.dayTabText,
                selectedDay === idx && styles.dayTabTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period Cards */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {dayEntries.map((entry, idx) => {
          const period = idx + 1;
          const periodTime = settings.periodTimes[idx];
          const timeStr = periodTime
            ? `${formatTime(periodTime.startHour, periodTime.startMinute)} - ${formatTime(periodTime.endHour, periodTime.endMinute)}`
            : '';

          if (!entry) {
            // Empty slot — no entry set
            return (
              <TouchableOpacity
                key={`empty-${period}`}
                style={styles.emptyCard}
                onPress={() => {
                  setEditingEntry({
                    id: generateId(),
                    period,
                    dayOfWeek: selectedDay,
                    lectureName: '',
                    attendanceUrl: settings.defaultUrl,
                    memo: '',
                    isEmpty: false,
                    notifyBefore: settings.notifyBeforeDefault,
                    notificationId: null,
                  });
                  setFormLecture('');
                  setFormUrl(settings.defaultUrl);
                  setFormMemo('');
                  setFormIsEmpty(false);
                  setFormNotifyBefore(settings.notifyBeforeDefault);
                  setModalVisible(true);
                }}
              >
                <View style={styles.periodBadgeEmpty}>
                  <Text style={styles.periodBadgeText}>{period}限</Text>
                </View>
                <View style={styles.emptyCardContent}>
                  <Text style={styles.emptyCardText}>＋ タップして追加</Text>
                  <Text style={styles.emptyTimeText}>{timeStr}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          if (entry.isEmpty) {
            // Free period (空きコマ)
            return (
              <TouchableOpacity
                key={entry.id}
                style={styles.freeCard}
                onPress={() => openEditModal(period, entry)}
                activeOpacity={0.7}
              >
                <View style={styles.periodBadgeFree}>
                  <Text style={styles.periodBadgeText}>{period}限</Text>
                </View>
                <View style={styles.freeCardContent}>
                  <Text style={styles.freeCardText}>空きコマ</Text>
                  <Text style={styles.freeTimeText}>{timeStr}</Text>
                </View>
                <View style={styles.freeIcon}>
                  <MaterialIcons name="local-cafe" size={20} color="#6D7688" />
                </View>
              </TouchableOpacity>
            );
          }

          // Regular lecture card
          return (
            <TouchableOpacity
              key={entry.id}
              style={styles.lectureCard}
              onPress={() => openEditModal(period, entry)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.periodBadge}>
                  <Text style={styles.periodBadgeText}>{period}限</Text>
                </View>
                <Text style={styles.cardTimeText}>{timeStr}</Text>
                {entry.notificationId && (
                  <MaterialIcons name="notifications" size={16} color="#4E5F80" />
                )}
              </View>
              <Text style={styles.lectureName}>{entry.lectureName}</Text>
              {entry.memo ? (
                <View style={styles.cardMemoRow}>
                  <MaterialIcons name="description" size={14} color="#7B8294" />
                  <Text style={styles.cardMemo} numberOfLines={2}>
                    {entry.memo}
                  </Text>
                </View>
              ) : null}
              {(entry.attendanceUrl || settings.defaultUrl) ? (
                <TouchableOpacity
                  style={styles.urlButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openUrl(entry.attendanceUrl);
                  }}
                >
                  <View style={styles.urlButtonContent}>
                    <MaterialIcons name="link" size={16} color="rgba(63, 77, 103, 0.86)" />
                    <Text style={styles.urlButtonText}>出席コードを入力</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}> 
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEntry?.lectureName ? '授業を編集' : '授業を追加'}
            </Text>
            <TouchableOpacity onPress={saveEntry}>
              <Text style={styles.modalSave}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* 空きコマ toggle */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>空きコマにする</Text>
              <Switch
                value={formIsEmpty}
                onValueChange={setFormIsEmpty}
                trackColor={{ false: '#E0E0E0', true: 'rgba(63, 77, 103, 0.86)' }}
                thumbColor="#fff"
              />
            </View>

            {!formIsEmpty && (
              <>
                <Text style={styles.formLabel}>講義名</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="例: 情報工学概論"
                  placeholderTextColor="#999"
                  value={formLecture}
                  onChangeText={setFormLecture}
                  maxLength={50}
                />

                <Text style={styles.formLabel}>出席コード入力URL</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="https://..."
                  placeholderTextColor="#999"
                  value={formUrl}
                  onChangeText={setFormUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={500}
                />

                <Text style={styles.formLabel}>メモ</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="授業に関するメモ..."
                  placeholderTextColor="#999"
                  value={formMemo}
                  onChangeText={setFormMemo}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />

                <Text style={styles.formLabel}>通知タイミング</Text>
                <View style={styles.notifyOptions}>
                  {[0, 3, 5, 10, 15].map(min => (
                    <TouchableOpacity
                      key={min}
                      style={[
                        styles.notifyOption,
                        formNotifyBefore === min && styles.notifyOptionActive,
                      ]}
                      onPress={() => setFormNotifyBefore(min)}
                    >
                      <Text
                        style={[
                          styles.notifyOptionText,
                          formNotifyBefore === min && styles.notifyOptionTextActive,
                        ]}
                      >
                        {min === 0 ? '時間通り' : `${min}分前`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {editingEntry && entries.find(e => e.id === editingEntry.id) && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>この授業を削除</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F8',
    overflow: 'visible',
  },
  header: {
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
    letterSpacing: 0.3,
  },
  dayTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  dayTabActive: {
    backgroundColor: 'rgba(63, 77, 103, 0.86)',
    shadowColor: 'rgba(63, 77, 103, 0.86)',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dayTabText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#666',
  },
  dayTabTextActive: {
    color: '#fff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  // Empty slot card
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E8EAF0',
    borderStyle: 'dashed',
  },
  emptyCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  emptyCardText: {
    fontSize: 15,
    fontFamily: AppFonts.medium,
    color: '#AAB2C0',
    fontWeight: '600',
  },
  emptyTimeText: {
    fontSize: 12,
    fontFamily: AppFonts.regular,
    color: '#C8CDD8',
    marginTop: 2,
  },
  // Free period card
  freeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#D1D5E0',
  },
  freeCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  freeCardText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: AppFonts.medium,
    color: '#A0A8B8',
  },
  freeTimeText: {
    fontSize: 12,
    fontFamily: AppFonts.regular,
    color: '#C0C8D8',
    marginTop: 2,
  },
  freeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Lecture card
  lectureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 6,
    borderLeftColor: '#2F3D55',
    borderWidth: 1,
    borderColor: '#C8D3E3',
    shadowColor: '#2F3D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodBadge: {
    backgroundColor: 'rgba(63, 77, 103, 0.86)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodBadgeEmpty: {
    backgroundColor: '#D1D5E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodBadgeFree: {
    backgroundColor: '#C0C8D8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: AppFonts.bold,
    color: '#fff',
  },
  cardTimeText: {
    fontSize: 12,
    fontFamily: AppFonts.regular,
    color: '#888',
    marginLeft: 8,
    flex: 1,
  },
  notifyBadge: {
    fontSize: 14,
  },
  cardMemoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  lectureName: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
    marginBottom: 4,
  },
  cardMemo: {
    fontSize: 13,
    fontFamily: AppFonts.regular,
    color: '#7B8294',
    flex: 1,
    lineHeight: 18,
  },
  urlButton: {
    backgroundColor: '#EEF0FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  urlButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  urlButtonText: {
    color: 'rgba(63, 77, 103, 0.86)',
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    fontSize: 14,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F0F2F8',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAF0',
  },
  modalCancel: {
    fontSize: 16,
    fontFamily: AppFonts.regular,
    color: '#888',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: 'rgba(63, 77, 103, 0.86)',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: AppFonts.medium,
    color: '#2D3142',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#7B8294',
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    fontFamily: AppFonts.regular,
    color: '#2D3142',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  formTextArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  notifyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  notifyOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  notifyOptionActive: {
    backgroundColor: 'rgba(63, 77, 103, 0.86)',
    borderColor: 'rgba(63, 77, 103, 0.86)',
  },
  notifyOptionText: {
    fontSize: 14,
    fontFamily: AppFonts.medium,
    color: '#666',
    fontWeight: '600',
  },
  notifyOptionTextActive: {
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#E53935',
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    fontSize: 16,
  },
});
