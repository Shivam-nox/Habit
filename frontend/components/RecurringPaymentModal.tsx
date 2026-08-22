// frontend/components/RecurringPaymentModal.tsx
import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Modal, SafeAreaView, ScrollView, Alert, Platform, ActivityIndicator, KeyboardAvoidingView 
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MotiView, AnimatePresence } from 'moti';
import { useApi } from '.././services/api'; 

type TabType = 'Expense' | 'Income';
type FrequencyType = 'Daily' | 'Weekly' | 'Monthly';

interface RecurringPaymentModalProps {
  visible: boolean;
  onClose: () => void;
}

// --- Minimal Palette ---
const COLORS = {
  primary: '#000000',
  background: '#FFFFFF',
  surface: '#F9F9F9',
  border: '#E5E5E5',
  text: '#111111',
  textMuted: '#888888',
  white: '#FFFFFF',
  success: '#000000',
};

const FormRow = ({ children, delay }: { children: React.ReactNode, delay: number }) => (
  <MotiView
    from={{ opacity: 0, translateY: 15 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ type: 'timing', duration: 400, delay }}
  >
    {children}
  </MotiView>
);

export default function RecurringPaymentModal({ visible, onClose }: RecurringPaymentModalProps) {
  const api = useApi();
  const [regName, setRegName] = useState('');
  const [regType, setRegType] = useState<TabType>('Expense');
  const [regFrequency, setRegFrequency] = useState<FrequencyType>('Monthly');
  const [regAmount, setRegAmount] = useState('');
  const [regNote, setRegNote] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const onStartChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  const handleSave = async () => {
    if (!regAmount || !startDate) return Alert.alert("Wait a sec", "Please enter an amount and start date.");

    const formattedStartDate = startDate.toISOString().split('T')[0];
    
    setIsLoading(true);

    try {
      const savedConfig = await api.addRecurring({
        amount: regAmount,
        type: regType.toLowerCase(), 
        interval: regFrequency.toLowerCase(),
        nextDate: formattedStartDate,
      });

      if (savedConfig) {
        setIsLoading(false);
        setIsSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setTimeout(() => {
          setIsSuccess(false);
          setRegAmount('');
          setRegName('');
          setEndDate(null);
          setStartDate(new Date());
          onClose();
        }, 1500);
      }
    } catch (error) {
      setIsLoading(false);
      Alert.alert("Error", "Could not schedule recurring payment.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.regModalContainer}>
        
        {/* Header */}
        <View style={styles.regHeader}>
          <Text style={styles.regHeaderTitle}>New Recurring</Text>
          <TouchableOpacity 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} 
            style={styles.closeBtn} 
            disabled={isLoading || isSuccess}
          >
            <Feather name="x" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.regFormScroll} showsVerticalScrollIndicator={false}>
            
            <FormRow delay={50}>
              <Text style={styles.label}>Payment Name</Text>
              <TextInput 
                style={styles.regInput} 
                placeholder="e.g. Netflix Subscription" 
                placeholderTextColor={COLORS.textMuted} 
                value={regName} 
                onChangeText={setRegName} 
              />
            </FormRow>

            <FormRow delay={100}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.segmentContainer}>
                {['Expense', 'Income'].map((t) => (
                  <TouchableOpacity 
                    key={t} 
                    style={[styles.segmentBtn, regType === t && styles.segmentBtnActive]} 
                    onPress={() => { Haptics.selectionAsync(); setRegType(t as TabType); }}
                  >
                    <Text style={[styles.segmentText, regType === t && styles.segmentTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormRow>

            <FormRow delay={150}>
              <Text style={styles.label}>Amount</Text>
              <View style={styles.regInputIconWrapper}>
                <Text style={styles.regCurrency}>₹</Text>
                <TextInput 
                  style={[styles.regInput, { paddingLeft: 36, width: '100%' }]} 
                  placeholder="0.00" 
                  placeholderTextColor={COLORS.textMuted} 
                  keyboardType="numeric" 
                  value={regAmount} 
                  onChangeText={setRegAmount} 
                />
              </View>
            </FormRow>

            <FormRow delay={200}>
              <Text style={styles.label}>Frequency</Text>
              <View style={styles.frequencyRow}>
                {['Daily', 'Weekly', 'Monthly'].map((f) => (
                  <TouchableOpacity 
                    key={f} 
                    style={[styles.freqChip, regFrequency === f && styles.freqChipActive]} 
                    onPress={() => { Haptics.selectionAsync(); setRegFrequency(f as FrequencyType); }}
                  >
                    <Text style={[styles.freqText, regFrequency === f && styles.freqTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormRow>

            <FormRow delay={250}>
              <View style={styles.rowSplit}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Start Date</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.dateText}>{startDate.toISOString().split('T')[0]}</Text>
                    <Feather name="calendar" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>End Date (Opt)</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEndPicker(true)}>
                    <Text style={[styles.dateText, !endDate && { color: COLORS.textMuted }]}>
                      {endDate ? endDate.toISOString().split('T')[0] : 'None'}
                    </Text>
                    <Feather name="calendar" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </FormRow>

            <FormRow delay={300}>
              <Text style={styles.label}>Note</Text>
              <TextInput 
                style={[styles.regInput, styles.textArea]} 
                multiline 
                placeholder="Add details..." 
                placeholderTextColor={COLORS.textMuted} 
                value={regNote} 
                onChangeText={setRegNote} 
              />
            </FormRow>

            <FormRow delay={350}>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleSave}
                disabled={isLoading || isSuccess}
                style={[styles.primaryButton, (isLoading || isSuccess) && { opacity: 0.5 }]}
              >
                <Text style={styles.primaryButtonText}>Schedule Payment</Text>
              </TouchableOpacity>
            </FormRow>

            {showStartPicker && <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartChange} />}
            {showEndPicker && <DateTimePicker value={endDate || new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onEndChange} />}
            
            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Animated Overlay */}
        <AnimatePresence>
          {(isLoading || isSuccess) && (
            <MotiView 
              from={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={styles.overlay}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
              ) : (
                <MotiView 
                  from={{ scale: 0.8, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  transition={{ type: 'spring', damping: 15 }}
                  style={styles.successContainer}
                >
                  <View style={styles.iconCircle}>
                    <Ionicons name="checkmark" size={40} color={COLORS.surface} />
                  </View>
                  <Text style={styles.successTitle}>Scheduled</Text>
                  <Text style={styles.successSub}>Your recurring payment is set.</Text>
                </MotiView>
              )}
            </MotiView>
          )}
        </AnimatePresence>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  regModalContainer: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  
  // Header
  regHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 32, 
    paddingBottom: 20, 
  },
  regHeaderTitle: { 
    color: COLORS.text, 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: -0.5
  },
  closeBtn: { 
    backgroundColor: COLORS.surface,
    padding: 10, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  regFormScroll: { 
    paddingHorizontal: 24 
  },
  
  // Typography
  label: { 
    color: COLORS.textMuted, 
    fontSize: 12, 
    fontWeight: '700', 
    marginBottom: 8, 
    marginTop: 24, 
    textTransform: 'uppercase', 
    letterSpacing: 1.2 
  },
  
  // Minimal Inputs
  regInput: { 
    backgroundColor: COLORS.surface, 
    color: COLORS.text, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    height: 56, 
    fontSize: 15, 
    fontWeight: '500',
    borderWidth: 1, 
    borderColor: COLORS.border,
  },
  textArea: { 
    height: 100, 
    paddingTop: 16, 
    textAlignVertical: 'top' 
  },
  
  regInputIconWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  regCurrency: { 
    position: 'absolute', 
    left: 16, 
    color: COLORS.primary, 
    fontSize: 18, 
    fontWeight: '700', 
    zIndex: 1 
  },
  
  datePickerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: COLORS.surface, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    height: 56, 
    borderWidth: 1, 
    borderColor: COLORS.border,
  },
  dateText: { 
    color: COLORS.text, 
    fontSize: 15,
    fontWeight: '500' 
  },
  
  // Minimal Segmented Control
  segmentContainer: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.surface, 
    borderRadius: 12, 
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  segmentBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center', 
    borderRadius: 8 
  },
  segmentBtnActive: { 
    backgroundColor: COLORS.primary, 
  },
  segmentText: { 
    color: COLORS.textMuted, 
    fontWeight: '600', 
    fontSize: 14 
  },
  segmentTextActive: { 
    color: COLORS.white, 
    fontWeight: '700' 
  },
  
  // Flat Frequency Chips
  frequencyRow: { 
    flexDirection: 'row', 
    gap: 10 
  },
  freqChip: { 
    flex: 1,
    paddingVertical: 14, 
    alignItems: 'center', 
    borderRadius: 12, 
    backgroundColor: COLORS.surface, 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  freqChipActive: { 
    backgroundColor: COLORS.primary, 
    borderColor: COLORS.primary 
  },
  freqText: { 
    color: COLORS.textMuted, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  freqTextActive: { 
    color: COLORS.white, 
    fontWeight: '700' 
  },
  
  rowSplit: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  
  // Primary Button
  primaryButton: { 
    height: 56, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginTop: 40,
  },
  primaryButtonText: { 
    color: COLORS.white, 
    fontSize: 16, 
    fontWeight: '700',
  },
  
  // Clean Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successContainer: {
    alignItems: 'center',
    padding: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5
  },
  successSub: { 
    fontSize: 15, 
    color: COLORS.textMuted, 
    textAlign: 'center', 
    marginTop: 10, 
    lineHeight: 22,
    fontWeight: '500'
  },
});