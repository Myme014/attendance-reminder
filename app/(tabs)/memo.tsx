import { AppFonts } from '@/constants/theme';
import {
    Memo,
    deleteMemo,
    generateId,
    getMemos,
    upsertMemo,
} from '@/utils/storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function MemoScreen() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadMemos();
    }, [])
  );

  const loadMemos = async () => {
    const data = await getMemos();
    // Sort by updatedAt descending
    data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setMemos(data);
  };

  const openNew = () => {
    setEditingMemo(null);
    setFormTitle('');
    setFormContent('');
    setModalVisible(true);
  };

  const openEdit = (memo: Memo) => {
    setEditingMemo(memo);
    setFormTitle(memo.title);
    setFormContent(memo.content);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() && !formContent.trim()) {
      Alert.alert('エラー', 'タイトルまたは内容を入力してください。');
      return;
    }
    const now = new Date().toISOString();
    const memo: Memo = {
      id: editingMemo?.id || generateId(),
      title: formTitle.trim(),
      content: formContent.trim(),
      createdAt: editingMemo?.createdAt || now,
      updatedAt: now,
    };
    const updated = await upsertMemo(memo);
    updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setMemos(updated);
    setModalVisible(false);
  };

  const handleDelete = () => {
    if (!editingMemo) return;
    Alert.alert('削除確認', 'このメモを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteMemo(editingMemo.id);
          updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          setMemos(updated);
          setModalVisible(false);
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderMemo = ({ item }: { item: Memo }) => (
    <TouchableOpacity
      style={styles.memoCard}
      onPress={() => openEdit(item)}
      activeOpacity={0.7}
    >
      <View style={styles.memoCardHeader}>
        <Text style={styles.memoTitle} numberOfLines={1}>
          {item.title || '無題のメモ'}
        </Text>
        <Text style={styles.memoDate}>{formatDate(item.updatedAt)}</Text>
      </View>
      {item.content ? (
        <Text style={styles.memoPreview} numberOfLines={3}>
          {item.content}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: 'rgba(63, 78, 103, 0.92)' }]}>
        <Text style={styles.headerTitle}>メモ</Text>
        <Text style={styles.headerSubtitle}>
          {memos.length > 0 ? `${memos.length}件のメモ` : 'メモはまだありません'}
        </Text>
      </View>

      {/* Add button */}
      <View style={styles.addRow}>
        <TouchableOpacity style={styles.addButton} onPress={openNew}>
          <View style={[styles.addButtonGradient, { backgroundColor: 'rgba(63, 78, 103, 0.92)' }]}>
            <Text style={styles.addButtonText}>＋ 新しいメモ</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Memos list */}
      {memos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}></Text>
          <Text style={styles.emptyText}>メモがありません</Text>
          <Text style={styles.emptySubtext}>「＋ 新しいメモ」をタップして{'\n'}メモを作成しましょう</Text>
        </View>
      ) : (
        <FlatList
          data={memos}
          keyExtractor={item => item.id}
          renderItem={renderMemo}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>
              {editingMemo ? 'メモを編集' : '新しいメモ'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>保存</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <TextInput
              style={styles.titleInput}
              placeholder="タイトル"
              placeholderTextColor="#AAB2C0"
              value={formTitle}
              onChangeText={setFormTitle}
              autoFocus={!editingMemo}
            />
            <TextInput
              style={styles.contentInput}
              placeholder="メモの内容を入力..."
              placeholderTextColor="#AAB2C0"
              value={formContent}
              onChangeText={setFormContent}
              multiline
              textAlignVertical="top"
            />
          </View>

          {editingMemo && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <View style={styles.deleteButtonContent}>
                <MaterialIcons name="delete" size={18} color="#E53935" />
                <Text style={styles.deleteButtonText}>このメモを削除</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
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
  addRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addButton: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  memoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  memoTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
    flex: 1,
    marginRight: 8,
  },
  memoDate: {
    fontSize: 12,
    fontFamily: AppFonts.regular,
    color: '#AAB2C0',
  },
  memoPreview: {
    fontSize: 14,
    fontFamily: AppFonts.regular,
    color: '#7B8294',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#AAB2C0',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: AppFonts.regular,
    color: '#C8CDD8',
    textAlign: 'center',
    lineHeight: 20,
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
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
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
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#f5576c',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    color: '#2D3142',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAF0',
    marginBottom: 16,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: AppFonts.regular,
    color: '#2D3142',
    lineHeight: 24,
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteButtonText: {
    color: '#E53935',
    fontWeight: '700',
    fontFamily: AppFonts.bold,
    fontSize: 16,
  },
});
