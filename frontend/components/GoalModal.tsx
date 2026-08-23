// components/GoalModal.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const C = {
  brand: '#2E7D6E',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#111827',
  subtext: '#9CA3AF',
  border: '#EEEEEE',
  fill: '#F5F5F5',
};

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

interface Props {
  visible: boolean;
  goal: any;
  onClose: () => void;
  onAllocate: (goalId: string, amount: string) => Promise<void>;
}

export default function GoalModal({ visible, goal, onClose, onAllocate }: Props) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!goal) return null;

  const target = parseFloat(goal.targetAmount || 0);
  const current = parseFloat(goal.currentAmount || goal.savedAmount || 0);
  const remaining = Math.max(0, target - current);
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  const handleSave = async () => {  
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return Alert.alert('Invalid Amount', 'Please enter a valid amount to allocate.');
    }

    setLoading(true);
    try {
      await onAllocate(goal.id, amount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount('');
      onClose();
    } catch (error: any) {
      console.log("FULL ERROR:", error);
      Alert.alert('Error Details', error.message || JSON.stringify(error));} finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalDragIndicator} />

          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="flag-outline" size={24} color={C.brand} />
              </View>
              <View>
                <Text style={styles.title}>{goal.name}</Text>
                {goal.desiredDate && (
                  <Text style={styles.subtext}>Target Date: {new Date(goal.desiredDate).toLocaleDateString()}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onClose(); }} style={styles.closeBtn}>
              <Feather name="x" size={20} color={C.subtext} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Current Saved</Text>
              <Text style={styles.statValueBrand}>{fmt(current)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Target Amount</Text>
              <Text style={styles.statValue}>{fmt(target)}</Text>
            </View>
            <View style={[styles.statRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.statLabel}>Remaining</Text>
              <Text style={styles.statValue}>{fmt(remaining)}</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
          </View>

          <Text style={styles.inputLabel}>Allocate Funds</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={C.subtext}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Add to Goal</Text>}
          </TouchableOpacity>
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
  title: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 2 },
  subtext: { fontSize: 12, color: C.subtext },
  closeBtn: { padding: 8, backgroundColor: C.bg, borderRadius: 18 },
  
  statsCard: { backgroundColor: C.fill, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  statLabel: { fontSize: 14, color: C.subtext, fontWeight: '500' },
  statValue: { fontSize: 14, color: C.text, fontWeight: '700' },
  statValueBrand: { fontSize: 14, color: C.brand, fontWeight: '700' },
  progressContainer: { height: 6, backgroundColor: C.border, borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: C.brand, borderRadius: 3 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, height: 56, marginBottom: 24 },
  currencySymbol: { fontSize: 18, fontWeight: '600', color: C.subtext, marginRight: 8 },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: C.text, height: '100%' },

  btn: { backgroundColor: C.brand, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});