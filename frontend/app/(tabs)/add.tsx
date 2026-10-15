// frontend/screens/AddTransactionScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, FlatList, 
  Modal, TextInput, KeyboardAvoidingView, Platform, 
  Alert, ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { useApi } from '../../services/api'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

import WishlistModal from '../../components/WishlistModal';
import RecurringPaymentModal from '../../components/RecurringPaymentModal';

const { width } = Dimensions.get('window');

type TabType = 'Expense' | 'Income';
type IntentType = 'need' | 'want';
type PaymentMode = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';

interface CategoryItem {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// --- Minimal Palette ---
const COLORS = {
  primary: '#171717',     // Ink (primary actions)
  accent: '#2E7D6E',      // Single accent color
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#171717',
  textMuted: '#71717A',
  white: '#FFFFFF',
  border: '#E4E4E7',
};

const PAYMENT_MODES: { label: string; value: PaymentMode; icon: any }[] = [
  { label: 'Cash', value: 'cash', icon: 'cash-outline' },
  { label: 'UPI', value: 'upi', icon: 'phone-portrait-outline' },
  { label: 'Card', value: 'card', icon: 'card-outline' },
  { label: 'Bank', value: 'bank_transfer', icon: 'business-outline' },
  { label: 'Other', value: 'other', icon: 'ellipsis-horizontal-outline' }, // Issue #13 FIX
];

export default function AddTransactionScreen() {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<TabType>('Expense');
  
  const [isTxModalVisible, setTxModalVisible] = useState(false); 
  const [isGoalModalVisible, setGoalModalVisible] = useState(false);
  const [isRegularPayModalVisible, setRegularPayModalVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [intent, setIntent] = useState<IntentType>('want'); 
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi');

  // Issue #14: Date state — defaults to today, user can back-date
  const [maxDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- CATEGORIES ---
  
  
   const expenseCategories: CategoryItem[] = [
    { id: '1', name: 'Shopping', icon: 'cart-outline' },
    { id: '2', name: 'Food', icon: 'fast-food-outline' },
    { id: '3', name: 'Phone', icon: 'phone-portrait-outline' },
    { id: '4', name: 'Entertainment', icon: 'musical-notes-outline' },
    { id: '5', name: 'Education', icon: 'school-outline' },
    { id: '6', name: 'Beauty', icon: 'sparkles-outline' },
    { id: '7', name: 'Sports', icon: 'fitness-outline' },
    { id: '8', name: 'Social', icon: 'people-outline' },
    { id: '9', name: 'Transportation', icon: 'bus-outline' },
    { id: '10', name: 'Clothing', icon: 'shirt-outline' },
    { id: '11', name: 'Car', icon: 'car-outline' },
    { id: '12', name: 'Alcohol', icon: 'wine-outline' },
    { id: '13', name: 'Cigarettes', icon: 'flame-outline' },
    { id: '14', name: 'Electronics', icon: 'tv-outline' },
    { id: '15', name: 'Travel', icon: 'airplane-outline' },
    { id: '16', name: 'Health', icon: 'medkit-outline' },
    { id: '17', name: 'Pets', icon: 'paw-outline' },
    { id: '18', name: 'Repairs', icon: 'construct-outline' },
    { id: '19', name: 'Housing', icon: 'home-outline' },
    { id: '20', name: 'Home', icon: 'bed-outline' },
    { id: '21', name: 'Gifts', icon: 'gift-outline' },
    { id: '22', name: 'Donations', icon: 'heart-outline' },
    { id: '23', name: 'Lottery', icon: 'ticket-outline' },
    { id: '24', name: 'Snacks', icon: 'cafe-outline' },
    { id: '25', name: 'Kids', icon: 'happy-outline' },
    { id: '26', name: 'Vegetables', icon: 'leaf-outline' },
    { id: '27', name: 'Fruits', icon: 'nutrition-outline' },
    { id: '99', name: 'Settings', icon: 'settings-outline' },
  ];
  
  const incomeCategories: CategoryItem[] = [
    { id: '28', name: 'Salary', icon: 'card-outline' },
    { id: '29', name: 'Investments', icon: 'trending-up-outline' },
    { id: '30', name: 'Part-Time', icon: 'time-outline' },
    { id: '31', name: 'Bonus', icon: 'gift-outline' },
    { id: '32', name: 'Others', icon: 'grid-outline' },
    { id: '199', name: 'Settings', icon: 'settings-outline' },
  ];
  

  const handleCategoryPress = async (category: CategoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (category.name === 'Settings') return; 
    setSelectedCategory(category);

    // Issue #12 FIX: Pre-fill intent from remembered preference for this category
    const INTENT_KEY = `intent_pref_${category.name}`;
    const savedIntent = await AsyncStorage.getItem(INTENT_KEY);
    setIntent((savedIntent as IntentType) || 'want');

    setSelectedDate(new Date()); // reset date to today on each new transaction
    setShowDatePicker(false);
    setTxModalVisible(true);
  };

 const handleTransactionSave = async () => {
    if (isLoading || showSuccess) return; 

    if (!amount || isNaN(Number(amount))) {
      return Alert.alert("Wait a sec", "Please enter a valid amount.");
    }

    // Issue #12 FIX: Remember intent choice for this category for next time
    if (selectedCategory && activeTab === 'Expense') {
      const INTENT_KEY = `intent_pref_${selectedCategory.name}`;
      await AsyncStorage.setItem(INTENT_KEY, intent);
    }

    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    const payload = {
      amount: parseFloat(amount),
      type: activeTab.toLowerCase(), 
      categoryId: selectedCategory?.id, 
      categoryName: selectedCategory?.name,
      paymentMode: paymentMode,
      intent: activeTab === 'Expense' ? intent : undefined, 
      note: note,
      date: dateStr, // Issue #14 FIX: Use user-selected date instead of always today
    };

    setIsLoading(true);

    try {
      const savedTx = await api.addTransaction(payload);
      if (savedTx) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setTxModalVisible(false);
          setAmount('');
          setNote('');
        }, 1200);
      } else {
        Alert.alert("Error", "Could not save transaction.");
      }
    } catch (error) {
      console.error("Transaction Save Error:", error);
      Alert.alert("Save Failed", "There was a problem saving. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

const renderGridItem = ({ item, index }: { item: CategoryItem, index: number }) => (
    <MotiView
      from={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      transition={{ 
        type: 'timing',
        duration: 250,
        delay: index * 15
      }}
      style={styles.gridItemContainer}
    >
      <TouchableOpacity 
        style={styles.gridItem} 
        onPress={() => handleCategoryPress(item)} 
        activeOpacity={0.6}
      >
        <View style={styles.iconBox}>
          <Ionicons name={item.icon} size={22} color={COLORS.text} />
        </View>
        <Text style={styles.gridLabel} numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
    </MotiView>
  );

  return (
   <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
           <Text style={styles.greetingTitle}>Track</Text>
           <Text style={styles.greetingSubtitle}>Where's it going?</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setRegularPayModalVisible(true)}>
            <Feather name="calendar" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setGoalModalVisible(true)}>
            <Feather name="target" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.tabWrapper}>
        <View style={styles.tabBackground}>
          {(['Expense', 'Income'] as TabType[]).map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && styles.activeTab]} 
              onPress={() => { 
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                setActiveTab(tab); 
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Grid Content */}
      <View style={styles.content}>
        <FlatList 
          data={activeTab === 'Expense' ? expenseCategories : incomeCategories} 
          renderItem={renderGridItem} 
          keyExtractor={item => item.id} 
          numColumns={4} 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.gridContainer} 
          columnWrapperStyle={styles.rowWrapper} 
        />
      </View>

      {/* Bottom Sheet Modal */}
      <Modal visible={isTxModalVisible} animationType="slide" transparent={true} onRequestClose={() => setTxModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContent}>
              
              <View style={styles.modalDragIndicator} />

              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <View style={styles.modalHeaderIcon}>
                    <Ionicons name={selectedCategory?.icon as any} size={20} color={COLORS.text} />
                  </View>
                  <Text style={styles.modalTitle}>{selectedCategory?.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setTxModalVisible(false)} disabled={isLoading || showSuccess} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput 
                  style={styles.amountInput} 
                  placeholder="0" 
                  placeholderTextColor={COLORS.border} 
                  keyboardType="numeric" 
                  value={amount} 
                  onChangeText={setAmount} 
                  autoFocus 
                />
              </View>

              <Text style={styles.sectionLabel}>Payment Mode</Text>
              <View style={styles.chipContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {PAYMENT_MODES.map(mode => (
                    <TouchableOpacity 
                      key={mode.value} 
                      style={[styles.chip, paymentMode === mode.value && styles.chipActive]}
                      onPress={() => { Haptics.selectionAsync(); setPaymentMode(mode.value); }}
                    >
                      <Ionicons 
                        name={mode.icon} 
                        size={16} 
                        color={paymentMode === mode.value ? COLORS.text : COLORS.textMuted} 
                        style={{marginRight: 6}}
                      />
                      <Text style={[styles.chipText, paymentMode === mode.value && styles.chipTextActive]}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {activeTab === 'Expense' && (
                <>
                  <Text style={styles.sectionLabel}>Classification</Text>
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity 
                      style={[styles.toggleBtn, intent === 'need' && styles.toggleBtnActive]} 
                      onPress={() => { Haptics.selectionAsync(); setIntent('need'); }}
                    >
                      <Text style={[styles.toggleText, intent === 'need' && styles.toggleTextActive]}>Need</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.toggleBtn, intent === 'want' && styles.toggleBtnActive]} 
                      onPress={() => { Haptics.selectionAsync(); setIntent('want'); }}
                    >
                      <Text style={[styles.toggleText, intent === 'want' && styles.toggleTextActive]}>Want</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.inputBox}>
                <Feather name="edit-2" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Add a note..." 
                  placeholderTextColor={COLORS.textMuted} 
                  value={note} 
                  onChangeText={setNote} 
                />
              </View>

              {/* Issue #14: Date picker row */}
              <TouchableOpacity
                style={[styles.inputBox, { marginTop: 10 }]}
                onPress={() => { Haptics.selectionAsync(); setShowDatePicker(true); }}
                activeOpacity={0.7}
              >
                <Feather name="calendar" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                <Text style={[styles.textInput, { color: selectedDate.toDateString() === new Date().toDateString() ? COLORS.textMuted : COLORS.text, paddingTop: Platform.OS === 'ios' ? 10 : 6 }]}>
                  {selectedDate.toDateString() === new Date().toDateString()
                    ? 'Today (tap to change date)'
                    : selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                  maximumDate={maxDate}
                  onChange={(event, date) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (event.type === 'set' && date) setSelectedDate(date);
                  }}
                />
              )}

              {/* Primary Button */}
              <TouchableOpacity 
                onPress={handleTransactionSave} 
                disabled={isLoading || showSuccess} 
                activeOpacity={0.8} 
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Save Transaction</Text>
              </TouchableOpacity>

              {/* Loading / Success State */}
              {(isLoading || showSuccess) && (
                <View style={styles.loadingOverlay}>
                  {isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.text} />
                  ) : (
                    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.successBadge}>
                      <Ionicons name="checkmark-circle" size={56} color={COLORS.text} />
                      <Text style={styles.successText}>Transaction logged</Text>
                    </MotiView>
                  )}
                </View>
              )}

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <WishlistModal visible={isGoalModalVisible} onClose={() => setGoalModalVisible(false)} />
      <RecurringPaymentModal visible={isRegularPayModalVisible} onClose={() => setRegularPayModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  
  // Header
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 24, 
    paddingTop: 10, 
    marginBottom: 20 
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.4
  },
  greetingSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '400',
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10
  },
  headerIconBtn: { 
    padding: 11, 
    backgroundColor: COLORS.surface, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border,
  },

  // Segmented Tabs
  tabWrapper: { 
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 24
  },
  tabBackground: { 
    flexDirection: 'row', 
    backgroundColor: '#EFEFEF', 
    padding: 3, 
    borderRadius: 12, 
    width: '100%' 
  },
  tab: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 9 
  },
  activeTab: { 
    backgroundColor: COLORS.white, 
  },
  tabText: { 
    color: COLORS.textMuted, 
    fontWeight: '600', 
    fontSize: 14 
  },
  activeTabText: { 
    color: COLORS.text, 
    fontWeight: '700' 
  },

  // Grid Categories
  content: { 
    flex: 1 
  },
  gridContainer: { 
    paddingBottom: 50, 
    paddingHorizontal: 16 
  },
  rowWrapper: { 
    justifyContent: 'space-between' 
  },
  gridItemContainer: { 
    width: '23%', 
    marginBottom: 22 
  },
  gridItem: { 
    alignItems: 'center' 
  },
  iconBox: { 
    width: width * 0.16, 
    height: width * 0.16, 
    borderRadius: 16, 
    backgroundColor: COLORS.surface, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridLabel: { 
    color: COLORS.text, 
    fontSize: 11, 
    textAlign: 'center', 
    fontWeight: '500',
    opacity: 0.8
  },

  // Modal Structure
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(15, 23, 30, 0.35)' 
  }, 
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: COLORS.white, 
    paddingHorizontal: 24, 
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
  }, 
  modalDragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20
  },
  
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 32 
  },
  modalTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  modalHeaderIcon: { 
    padding: 10, 
    borderRadius: 12, 
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  modalTitle: { 
    color: COLORS.text, 
    fontSize: 18, 
    fontWeight: '700' 
  },
  closeBtn: {
    backgroundColor: COLORS.background,
    padding: 9,
    borderRadius: 18
  },

  // Input
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 40 
  },
  currencySymbol: { 
    fontSize: 42, 
    color: COLORS.textMuted, 
    marginRight: 6, 
    fontWeight: '500' 
  },
  amountInput: { 
    fontSize: 60, 
    color: COLORS.text, 
    fontWeight: '700', 
    minWidth: 80, 
    textAlign: 'center',
    letterSpacing: -1.5
  },
  
  sectionLabel: { 
    color: COLORS.textMuted, 
    fontSize: 12, 
    fontWeight: '600', 
    marginBottom: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 1 
  },

  // Chips & Toggles
  chipContainer: { 
    marginBottom: 28 
  },
  chip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.background, 
    paddingVertical: 12, 
    paddingHorizontal: 18, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border
  },
  chipActive: { 
    backgroundColor: COLORS.surface, 
    borderColor: COLORS.text 
  },
  chipText: { 
    color: COLORS.textMuted, 
    fontSize: 14, 
    fontWeight: '500' 
  },
  chipTextActive: { 
    color: COLORS.text, 
    fontWeight: '700' 
  },

  toggleContainer: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 28 
  },
  toggleBtn: { 
    flex: 1, 
    paddingVertical: 14, 
    alignItems: 'center', 
    borderRadius: 12, 
    backgroundColor: COLORS.background, 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  toggleBtnActive: { 
    backgroundColor: COLORS.surface, 
    borderColor: COLORS.text 
  }, 
  toggleText: { 
    color: COLORS.textMuted, 
    fontSize: 14, 
    fontWeight: '500' 
  },
  toggleTextActive: { 
    color: COLORS.text, 
    fontWeight: '700' 
  }, 

  // Text Inputs
  inputBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.background, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    height: 54, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: COLORS.border
  },
  inputIcon: { 
    marginRight: 12 
  },
  textInput: { 
    flex: 1, 
    color: COLORS.text, 
    fontSize: 15, 
    height: '100%',
    fontWeight: '400'
  },

  // Primary Button
  primaryButton: { 
    height: 54, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: COLORS.text,
    marginTop: 6,
  },
  primaryButtonText: { 
    color: COLORS.white, 
    fontSize: 16, 
    fontWeight: '600',
    letterSpacing: 0.2
  },

  // Loading / Success
  loadingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(255, 255, 255, 0.97)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 10, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24 
  },
  successBadge: { 
    alignItems: 'center' 
  },
  successText: { 
    color: COLORS.text, 
    fontSize: 17, 
    fontWeight: '600', 
    marginTop: 14 
  }
});