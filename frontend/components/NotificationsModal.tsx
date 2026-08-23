// components/NotificationsModal.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';

const C = {
  red: '#DC2626',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#111827',
  subtext: '#9CA3AF',
  border: '#EEEEEE',
  fill: '#F5F5F5',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  notifications: any[];
}

export default function NotificationsModal({ visible, onClose, notifications }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Handle bar */}
          <View style={styles.modalDragIndicator} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onClose(); }} style={styles.closeBtn}>
              <Feather name="x" size={20} color={C.subtext} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {notifications.length > 0 ? (
              notifications.map((item, index) => (
                <MotiView
                  key={item.id || index}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 250, delay: index * 40 }}
                  style={styles.recordCard}
                >
                  <View style={[styles.iconBox, !item.isRead && { backgroundColor: '#FEE2E2' }]}>
                    <MaterialCommunityIcons name="bell-outline" size={18} color={!item.isRead ? C.red : C.text} />
                  </View>
                  <View style={styles.recordContent}>
                    <Text style={[styles.recordTitle, !item.isRead && { fontWeight: '700' }]}>{item.title}</Text>
                    <Text style={styles.recordSubtext}>{item.message}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.miniLabel}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Today'}
                    </Text>
                  </View>
                </MotiView>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="bell-off" size={32} color={C.border} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>You're all caught up!</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 30, 0.35)' },
  modalContent: {
    backgroundColor: C.surface,
    paddingHorizontal: 24, paddingTop: 16,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '80%', // Takes up 80% of the screen
  },
  modalDragIndicator: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  closeBtn: { backgroundColor: C.bg, padding: 8, borderRadius: 18 },

  recordCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    padding: 14, borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: C.fill },
  recordContent: { flex: 1 },
  recordTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  recordSubtext: { fontSize: 12, color: C.subtext },
  miniLabel: { fontSize: 9, color: C.subtext, fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },

  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: C.subtext, fontWeight: '500' }
});