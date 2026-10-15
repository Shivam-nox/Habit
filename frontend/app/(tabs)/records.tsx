// screens/DashboardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useApi } from '../../services/api';
import { useRouter } from 'expo-router';

// Import modals
import NotificationsModal from '../../components/NotificationsModal';
import GoalModal from '../../components/GoalModal';
import RecurringModal from '../../components/RecurringModal'; 
import TransactionModal from '../../components/TransactionModal';

// ─── MINIMAL PALETTE ─────────────────────────────────
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

const ITEMS_PER_PAGE = 8;

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

// Helper: Safely parse local dates without timezone shifting
const formatRelativeDate = (dateString: string) => {
  if (!dateString) return 'Unknown Date';
  
  const [year, month, day] = dateString.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  const today = new Date();
  
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const AnimatedAmount = ({ value, style }: { value: number; style?: any }) => {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const steps = 18;
    const inc = value / steps;
    const timer = setInterval(() => {
      start += inc;
      if (start >= value) { setDisplayed(value); clearInterval(timer); }
      else setDisplayed(start);
    }, 18);
    return () => clearInterval(timer);
  }, [value]);
  return <Text style={style}>{fmt(displayed)}</Text>;
};

type ListTab = 'History' | 'Recurring' | 'Goals';

export default function DashboardScreen() {
  const api = useApi();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ListTab>('History');
  
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isNotifModalVisible, setNotifModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [selectedRecurring, setSelectedRecurring] = useState<any>(null); 
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null); 

  const [userName, setUserName] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const handleLogout = () => {
    Haptics.selectionAsync();
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await api.logout();
          router.replace('/sign-in');
        }
      }
    ]);
  };

  // BUG FIX: Removed 'api' from dependency array to stop the infinite loop!
  const load = useCallback(async (isRefresh = false) => {
    try {
      const [profileRes, dashRes, txRes, recRes, goalRes, notifRes] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getDashboard().catch(() => null),
        api.getTransactions().catch(() => []),
        api.getRecurringConfigs?.().catch(() => []) || [],
        api.getGoals?.().catch(() => []) || [],
        api.getNotifications?.().catch(() => []) || []
      ]);

      if (profileRes?.user?.name || profileRes?.name) {
        setUserName(profileRes.user?.name || profileRes.name);
      }
      if (dashRes?.data) setAnalytics(dashRes.data);
      setTransactions(txRes || []);
      setRecurring((recRes || []).filter((r: any) => r.isActive !== false));
      setGoals(goalRes || []);
      setNotifications(notifRes || []);
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []); // <-- Empty array is critical here

  useEffect(() => { load(); }, [load]);

  // Issue #9 FIX: Reload data every time this tab gains focus
  // (e.g., after adding a transaction in the Add tab)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  const a = analytics ?? { stats: { totalIncome: 0, totalExpense: 0 } };
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const spentPct = a.stats.totalIncome > 0 ? (a.stats.totalExpense / a.stats.totalIncome) * 100 : 0;
  const isOverBudget = spentPct > 100;

  const renderListItem = (item: any, index: number) => {
    let content;

    if (activeTab === 'Goals') {
      const target = parseFloat(item.targetAmount || 0);
      const current = parseFloat(item.currentAmount || item.savedAmount || 0);
      const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
      const isCompleted = target > 0 && current >= target;
      const dateText = item.desiredDate ? formatRelativeDate(item.desiredDate) : 'No target date';

      content = (
        <TouchableOpacity 
          style={[styles.recordCard, { flexDirection: 'column', alignItems: 'stretch' }]} 
          activeOpacity={0.7}
          onPress={() => { Haptics.selectionAsync(); setSelectedGoal(item); }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="flag-outline" size={18} color={C.text} />
            </View>
            <View style={styles.recordContent}>
              <Text style={styles.recordTitle}>{item.name}</Text>
              <Text style={styles.recordSubtext}>Target: {fmt(target)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.recordAmount}>{fmt(current)}</Text>
              <Text style={styles.miniLabel}>SAVED</Text>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isCompleted ? C.success : C.brand }}>
                  {progress.toFixed(0)}%
                </Text>
                {isCompleted && (
                  <View style={styles.successTag}>
                    <Text style={styles.successTagText}>COMPLETED</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 10, color: C.subtext, fontWeight: '500' }}>{dateText}</Text>
            </View>
            <View style={styles.goalProgressBarContainer}>
              <View style={[styles.goalProgressBar, { width: `${progress}%`, backgroundColor: isCompleted ? C.success : C.brand }]} />
            </View>
          </View>
        </TouchableOpacity>
      );
    } else if (activeTab === 'Recurring') {
      const nextDateText = item.nextDate ? formatRelativeDate(item.nextDate) : 'Unknown';

      content = (
        <TouchableOpacity 
          style={styles.recordCard}
          activeOpacity={0.7}
          onPress={() => { Haptics.selectionAsync(); setSelectedRecurring(item); }}
        >
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="calendar-sync" size={18} color={C.text} />
          </View>
          <View style={styles.recordContent}>
            <Text style={styles.recordTitle}>{item.name || item.categoryName || 'Subscription'}</Text>
            <Text style={styles.recordSubtext}>Due {nextDateText} • {item.frequency || item.interval}</Text>
          </View>
          <Text style={styles.recordAmount}>{fmt(parseFloat(item.amount))}</Text>
        </TouchableOpacity>
      );
    } else {
      const isIncome = item.type === 'income';
      const formattedDate = formatRelativeDate(item.date); 

      content = (
        <TouchableOpacity 
          style={styles.recordCard}
          activeOpacity={0.7}
          onPress={() => { Haptics.selectionAsync(); setSelectedTransaction(item); }}
        >
          <View style={styles.iconBox}>
            <Ionicons name={item.categoryIcon as any || 'receipt-outline'} size={18} color={C.text} />
          </View>
          <View style={styles.recordContent}>
            <Text style={styles.recordTitle}>{item.categoryName || 'Transaction'}</Text>
            <Text style={styles.recordSubtext}>{formattedDate}</Text>
          </View>
          <Text style={[styles.recordAmount, { color: isIncome ? C.success : C.text }]}>
            {isIncome ? '+' : ''}{fmt(parseFloat(item.amount))}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <MotiView
        key={item.id || index}
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 250, delay: index * 30 }}
      >
        {content}
      </MotiView>
    );
  };

  const handleAllocateGoal = async (goalId: string, amount: string) => {
    await api.allocateGoalProgress(goalId, Number(amount)); 
    await load(true); 
  };

  const handleProcessRecurring = async (recurringId: string) => {
    await api.processRecurring(recurringId);
    await load(true);
  };

  const handleCancelRecurring = async (recurringId: string) => {
    await api.cancelRecurring(recurringId);
    await load(true);
  };

  const handleUpdateRecurringDate = async (recurringId: string, newDate: string) => {
    await api.updateRecurringDate(recurringId, newDate);
    await load(true);
  };

  const handleUpdateTransaction = async (id: string, data: any) => {
    await api.updateTransaction(id, data);
    await load(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    await api.deleteTransaction(id);
    await load(true);
  };

  // Pagination Logic
  const currentListData = activeTab === 'History' ? transactions : activeTab === 'Recurring' ? recurring : goals;
  const totalPages = Math.ceil(currentListData.length / ITEMS_PER_PAGE);
  const paginatedData = currentListData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.brand} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi, {userName || 'there'}</Text>
            <Text style={styles.month}>{todayFormatted}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Open Notifications Modal */}
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={() => { Haptics.selectionAsync(); setNotifModalVisible(true); }} 
              activeOpacity={0.6}
            >
              <Ionicons name="notifications-outline" size={20} color={C.text} />
              {unreadCount > 0 && (
                <View style={styles.alertDot}>
                  <Text style={styles.alertDotText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={handleLogout} activeOpacity={0.6}>
              <Ionicons name="log-out-outline" size={20} color={C.red} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Overview */}
        <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }} style={styles.heroCard}>
          <Text style={styles.heroLabel}>Spent this month</Text>
          <AnimatedAmount value={a.stats.totalExpense} style={styles.heroAmount} />
          <View style={styles.heroProgressBarContainer}>
            <View style={[styles.heroProgressBar, { width: `${Math.min(spentPct, 100)}%`, backgroundColor: isOverBudget ? C.red : C.brand }]} />
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroSubtext}>of {fmt(a.stats.totalIncome)} income</Text>
            <Text style={[styles.heroSubtext, { color: isOverBudget ? C.red : C.subtext, fontWeight: '600' }]}>
              {spentPct.toFixed(0)}%
            </Text>
          </View>
        </MotiView>

        {/* List */}
        <Text style={styles.sectionTitle}>Your records</Text>
        <View style={styles.navToggle}>
          {(['History', 'Recurring', 'Goals'] as ListTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.6}
              style={[styles.navBtn, activeTab === tab && styles.navBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
            >
              <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.listContainer}>
          {paginatedData.length > 0 ? (
            paginatedData.map((item, index) => renderListItem(item, index))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={26} color={C.border} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No {activeTab.toLowerCase()} yet</Text>
            </View>
          )}
        </View>

        {/* Numeric Pagination Buttons */}
        {totalPages > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.paginationContainer}
          >
            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              const isActive = currentPage === pageNum;
              return (
                <TouchableOpacity
                  key={pageNum}
                  onPress={() => { Haptics.selectionAsync(); setCurrentPage(pageNum); }}
                  style={[styles.pageBtn, isActive && styles.pageBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageBtnText, isActive && styles.pageBtnTextActive]}>
                    {pageNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modals */}
      <NotificationsModal 
        visible={isNotifModalVisible} 
        onClose={() => setNotifModalVisible(false)} 
        notifications={notifications.slice(0, 5)} 
      />

      <GoalModal 
        visible={!!selectedGoal} 
        goal={selectedGoal} 
        onClose={() => setSelectedGoal(null)} 
        onAllocate={handleAllocateGoal} 
      />

      <RecurringModal
        visible={!!selectedRecurring}
        recurring={selectedRecurring}
        onClose={() => setSelectedRecurring(null)}
        onProcess={handleProcessRecurring}
        onCancel={handleCancelRecurring}
        onUpdateDate={handleUpdateRecurringDate} 
      />

      <TransactionModal
        visible={!!selectedTransaction}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onUpdate={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 20 },
  greeting: { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.4 },
  month: { fontSize: 13, color: C.subtext, marginTop: 3 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  alertDot: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: C.red, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  alertDotText: { fontSize: 9, fontWeight: '700', color: 'white' },

  heroCard: {
    backgroundColor: C.surface, borderRadius: 18, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  heroLabel: { fontSize: 12, fontWeight: '600', color: C.subtext, marginBottom: 6, letterSpacing: 0.3 },
  heroAmount: { fontSize: 40, fontWeight: '700', color: C.text, letterSpacing: -1, marginBottom: 16 },
  heroProgressBarContainer: { height: 6, backgroundColor: C.fill, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  heroProgressBar: { height: '100%', borderRadius: 3 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  heroSubtext: { fontSize: 12, color: C.subtext },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },

  navToggle: { flexDirection: 'row', backgroundColor: C.fill, borderRadius: 12, padding: 3, marginBottom: 14 },
  navBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  navBtnActive: { backgroundColor: C.surface },
  navText: { fontSize: 12, fontWeight: '500', color: C.subtext },
  navTextActive: { color: C.text, fontWeight: '700' },

  listContainer: { marginTop: 2 },
  recordCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    padding: 14, borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: C.fill },
  recordContent: { flex: 1 },
  recordTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  recordSubtext: { fontSize: 12, color: C.subtext, textTransform: 'capitalize' },
  recordAmount: { fontSize: 14, fontWeight: '700', color: C.text },
  miniLabel: { fontSize: 9, color: C.subtext, fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },

  goalProgressBarContainer: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  goalProgressBar: { height: '100%', backgroundColor: C.brand, borderRadius: 2 },
  successTag: { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  successTagText: { color: C.success, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  emptyState: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: C.subtext, fontWeight: '500' },
  
  paginationContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, minWidth: '100%' },
  pageBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pageBtnActive: { backgroundColor: C.text, borderColor: C.text },
  pageBtnText: { fontSize: 14, fontWeight: '600', color: C.subtext },
  pageBtnTextActive: { color: C.surface }
});