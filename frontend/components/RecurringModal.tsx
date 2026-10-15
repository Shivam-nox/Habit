// components/RecurringModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

const C = {
  brand: '#2E7D6E',
  red: '#DC2626',
  success: '#16A34A',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#111827',
  subtext: '#9CA3AF',
  border: '#EEEEEE',
  fill: '#F5F5F5',
};

const fmt = (n: number) => n.toLocaleString('en-IN');

// Helper: Safely format local date
const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface Props {
  visible: boolean;
  recurring: any;
  onClose: () => void;
  onProcess: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onUpdateDate: (id: string, newDate: string) => Promise<void>;
}

export default function RecurringModal({ visible, recurring, onClose, onProcess, onCancel, onUpdateDate }: Props) {
  const [loadingType, setLoadingType] = useState<'process' | 'cancel' | 'date' | null>(null);

  // Use midnight today for minimum date to ensure consistent behavior across platforms
  const [minDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [dateValue, setDateValue] = useState(new Date());
  const [tempDate, setTempDate] = useState('');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (recurring) {
      const d = recurring.nextDate || recurring.nextBillingDate;
      let parsedDate = new Date();

      if (d) {
        // Parse raw string safely to avoid timezone shifting
        const [year, month, day] = d.split('T')[0].split('-');
        parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
      }

      // ANDROID CRASH PREVENTION:
      // Clamp to today if the subscription is overdue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsedDate.getTime() < today.getTime()) {
        parsedDate = new Date();
      }

      setDateValue(parsedDate);
      setTempDate(getLocalDateString(parsedDate));
      setIsEditingDate(false);
      setShowPicker(false);
    }
  }, [recurring]);

  if (!recurring) return null;

  const amount = parseFloat(recurring.amount || 0);

  const handleProcess = async () => {
    setLoadingType('process');
    try {
      await onProcess(recurring.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to process payment.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // 1. Hide the picker on Android
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    // 2. Only process if user confirmed a date
    if (event.type === 'set' && selectedDate) {
      // JS-LEVEL GUARD: Reject past dates (Android ignores minimumDate on many devices)
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      if (selectedDate.getTime() < todayMidnight.getTime()) {
        Alert.alert('Invalid Date', 'You cannot select a date before today.');
        return; // Don't update anything — keep the old dateValue
      }

      setDateValue(selectedDate);
      const newDateStr = getLocalDateString(selectedDate);
      setTempDate(newDateStr);

      const originalD = recurring.nextDate || recurring.nextBillingDate;
      let originalFormatted = '';
      if (originalD) {
        const [y, m, d] = originalD.split('T')[0].split('-');
        originalFormatted = `${y}-${m}-${d}`;
      }

      setIsEditingDate(newDateStr !== originalFormatted);
    }
  };

  const handleSaveDate = async () => {
    setLoadingType('date');
    try {
      await onUpdateDate(recurring.id, tempDate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditingDate(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update date.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleCancel = () => {
    Alert.alert('Stop Recurring', `Stop paying for ${recurring.name || recurring.categoryName}?`, [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Stop Payment', style: 'destructive',
        onPress: async () => {
          setLoadingType('cancel');
          try {
            await onCancel(recurring.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to cancel subscription.');
          } finally {
            setLoadingType(null);
          }
        }
      }
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalDragIndicator} />

          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="calendar-sync" size={24} color={C.brand} />
              </View>
              <View>
                <Text style={styles.title}>{recurring.name || recurring.categoryName || 'Subscription'}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{recurring.type === 'income' ? 'Income' : 'Expense'}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onClose(); }} style={styles.closeBtn}>
              <Feather name="x" size={20} color={C.subtext} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroSection}>
            <Text style={styles.heroLabel}>Payment Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.amountValue}>{fmt(amount)}</Text>
            </View>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="calendar-outline" size={18} color={C.subtext} />
                <Text style={styles.detailLabel}>Next Date</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailValue}>
                    {dateValue.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Feather name="calendar" size={16} color={C.brand} />
                </TouchableOpacity>

                {isEditingDate && (
                  loadingType === 'date' ? (
                    <ActivityIndicator size="small" color={C.brand} style={{ marginLeft: 4 }} />
                  ) : (
                    <TouchableOpacity onPress={handleSaveDate} style={styles.saveIcon}>
                      <Feather name="check" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            {/* NATIVE PICKER */}
            {showPicker && (
              <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : {}}>
                <DateTimePicker
                  value={dateValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                  onChange={handleDateChange}
                  minimumDate={minDate}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.iosDoneBtn} onPress={() => setShowPicker(false)}>
                    <Text style={styles.iosDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="repeat-outline" size={18} color={C.subtext} />
                <Text style={styles.detailLabel}>Frequency</Text>
              </View>
              <Text style={[styles.detailValue, { textTransform: 'capitalize' }]}>{recurring.frequency || recurring.interval}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnOutline} onPress={handleCancel} disabled={!!loadingType} activeOpacity={0.7}>
              {loadingType === 'cancel' ? <ActivityIndicator color={C.red} size="small" /> : (
                <>
                  <Feather name="slash" size={18} color={C.red} />
                  <Text style={styles.btnTextOutline}>Stop</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPrimary} onPress={handleProcess} disabled={!!loadingType} activeOpacity={0.8}>
              {loadingType === 'process' ? <ActivityIndicator color="#FFF" /> : (
                <Text style={styles.btnTextPrimary}>Pay & Update Date</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 30, 0.4)' },
  modalContent: { backgroundColor: C.surface, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalDragIndicator: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
  badge: { alignSelf: 'flex-start', backgroundColor: C.fill, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '600', color: C.subtext, textTransform: 'uppercase', letterSpacing: 0.5 },
  closeBtn: { padding: 8, backgroundColor: C.bg, borderRadius: 18 },
  heroSection: { alignItems: 'center', marginBottom: 32 },
  heroLabel: { fontSize: 13, color: C.subtext, fontWeight: '500', marginBottom: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-start' },
  currencySymbol: { fontSize: 24, fontWeight: '600', color: C.text, marginTop: 4, marginRight: 2 },
  amountValue: { fontSize: 44, fontWeight: '700', color: C.text, letterSpacing: -1 },
  detailsCard: { backgroundColor: C.fill, borderRadius: 16, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: C.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 14, color: C.subtext, fontWeight: '500' },
  detailValue: { fontSize: 15, color: C.text, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  iosPickerContainer: { backgroundColor: C.surface, borderRadius: 14, marginTop: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  iosDoneBtn: { backgroundColor: C.fill, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderColor: C.border },
  iosDoneText: { color: C.brand, fontWeight: '700', fontSize: 16 },
  saveIcon: { backgroundColor: C.success, padding: 6, borderRadius: 12, marginLeft: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  btnOutline: { flex: 0.4, height: 56, borderRadius: 16, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnTextOutline: { fontSize: 15, fontWeight: '700', color: C.red },
  btnPrimary: { flex: 1, backgroundColor: C.brand, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnTextPrimary: { color: '#FFF', fontSize: 16, fontWeight: '700' }
}); 