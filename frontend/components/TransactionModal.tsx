// components/TransactionModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

const C = {
  brand: '#2E7D6E',
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
  transaction: any;
  onClose: () => void;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// Helper: Safely get YYYY-MM-DD in local time without UTC shifting
const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Parse YYYY-MM-DD into a local Date object safely
const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export default function TransactionModal({ visible, transaction, onClose, onUpdate, onDelete }: Props) {
  const [loadingType, setLoadingType] = useState<'update' | 'delete' | null>(null);
  const [amount, setAmount] = useState('');
  
  // BUG FIX: Store the max date in state so it doesn't recreate every render!
  const [maxDate] = useState(() => new Date());
  
  // Date states
  const [date, setDate] = useState('');
  const [dateValue, setDateValue] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount ? String(parseFloat(transaction.amount)) : '');
      const txDate = transaction.date ? parseLocalDate(transaction.date) : new Date();
      setDateValue(txDate);
      setDate(getLocalDateString(txDate));
      setShowPicker(false);
    }
  }, [transaction]);

  if (!transaction) return null;

  const isIncome = transaction.type === 'income';

const handleDateChange = (event: any, selectedDate?: Date) => {
    // 1. Save the newly selected date FIRST
    if (event.type === 'set' && selectedDate) {
      setDateValue(selectedDate);
      setDate(getLocalDateString(selectedDate));
    }
    
    // 2. Hide the picker SECOND
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
  };

  const handleUpdate = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return Alert.alert('Invalid Amount', 'Please enter a valid amount.');
    }

    setLoadingType('update');
    try {
      await onUpdate(transaction.id, { amount: Number(amount), date });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update transaction.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this transaction? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', style: 'destructive', 
        onPress: async () => {
          setLoadingType('delete');
          try {
            await onDelete(transaction.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to delete transaction.');
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
                <Ionicons name={transaction.categoryIcon as any || 'receipt-outline'} size={24} color={C.brand} />
              </View>
              <View>
                <Text style={styles.title}>{transaction.categoryName || 'Transaction'}</Text>
                <View style={styles.badge}>
                  <Text style={[styles.badgeText, { color: isIncome ? '#16A34A' : C.subtext }]}>
                    {isIncome ? 'Income' : 'Expense'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onClose(); }} style={styles.closeBtn}>
              <Feather name="x" size={20} color={C.subtext} />
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <Text style={styles.inputLabel}>Edit Amount</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} />
          </View>

          {/* Native Date Picker */}
          <Text style={styles.inputLabel}>Transaction Date</Text>
          <TouchableOpacity 
            style={[styles.inputWrap, { marginBottom: showPicker && Platform.OS === 'ios' ? 8 : 24 }]} 
            onPress={() => setShowPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={C.subtext} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: C.text }}>
              {dateValue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <Feather name="calendar" size={16} color={C.brand} />
          </TouchableOpacity>

          {showPicker && (
            <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : {}}>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                onChange={handleDateChange}
                maximumDate={maxDate} // <-- BUG FIX HERE
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.iosDoneBtn} onPress={() => setShowPicker(false)}>
                  <Text style={styles.iosDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnOutline} onPress={handleDelete} disabled={!!loadingType} activeOpacity={0.7}>
              {loadingType === 'delete' ? <ActivityIndicator color={C.red} size="small" /> : (
                <>
                  <Feather name="trash-2" size={18} color={C.red} />
                  <Text style={styles.btnTextOutline}>Delete</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPrimary} onPress={handleUpdate} disabled={!!loadingType} activeOpacity={0.8}>
              {loadingType === 'update' ? <ActivityIndicator color="#FFF" /> : (
                <Text style={styles.btnTextPrimary}>Update</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
  badge: { alignSelf: 'flex-start', backgroundColor: C.fill, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  closeBtn: { padding: 8, backgroundColor: C.bg, borderRadius: 18 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, height: 56, marginBottom: 16 },
  currencySymbol: { fontSize: 18, fontWeight: '600', color: C.subtext, marginRight: 8 },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: C.text, height: '100%' },
  
  iosPickerContainer: { backgroundColor: C.surface, borderRadius: 14, marginBottom: 24, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  iosDoneBtn: { backgroundColor: C.fill, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderColor: C.border },
  iosDoneText: { color: C.brand, fontWeight: '700', fontSize: 16 },

  actionRow: { flexDirection: 'row', gap: 12 },
  btnOutline: { flex: 0.4, height: 56, borderRadius: 16, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnTextOutline: { fontSize: 15, fontWeight: '700', color: C.red },
  btnPrimary: { flex: 1, backgroundColor: C.brand, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnTextPrimary: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});