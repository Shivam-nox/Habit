// screens/DashboardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
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

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

// ─── ANIMATED NUMBER ──────────────────────────────
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

// ─── QUICK ACTION ──────────────────────────────────
const QuickChip = ({ icon, label, onPress }: any) => (
  <TouchableOpacity style={styles.chip} onPress={() => { Haptics.selectionAsync(); onPress(); }} activeOpacity={0.6}>
    <View style={styles.chipIconWrap}>
      <MaterialCommunityIcons name={icon} size={20} color={C.brand} />
    </View>
    <Text style={styles.chipLabel}>{label}</Text>
  </TouchableOpacity>
);

type ListTab = 'History' | 'Recurring' | 'Goals' | 'Alerts';

export default function DashboardScreen() {
  const api = useApi();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ListTab>('History');
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
      setRecurring(recRes || []);
      setGoals(goalRes || []);
      setNotifications(notifRes || []);
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  const a = analytics ?? { stats: { totalIncome: 0, totalExpense: 0 }, alerts: [] };
  const redAlerts = (a.alerts || []).filter((x: any) => x.severity === 'red').length;
  const spentPct = a.stats.totalIncome > 0 ? (a.stats.totalExpense / a.stats.totalIncome) * 100 : 0;
  const isOverBudget = spentPct > 100;

  const renderListItem = (item: any, index: number) => {
    let content;

    if (activeTab === 'Goals') {
      content = (
        <View style={styles.recordCard}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="flag-outline" size={18} color={C.text} />
          </View>
          <View style={styles.recordContent}>
            <Text style={styles.recordTitle}>{item.name}</Text>
            <Text style={styles.recordSubtext}>Target: {fmt(parseFloat(item.targetAmount))}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.recordAmount}>{fmt(parseFloat(item.currentAmount || item.savedAmount || 0))}</Text>
            <Text style={styles.miniLabel}>SAVED</Text>
          </View>
        </View>
      );
    } else if (activeTab === 'Recurring') {
      content = (
        <View style={styles.recordCard}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="calendar-sync" size={18} color={C.text} />
          </View>
          <View style={styles.recordContent}>
            <Text style={styles.recordTitle}>{item.name || item.categoryName || 'Subscription'}</Text>
            <Text style={styles.recordSubtext}>Next: {item.nextDate || item.nextBillingDate}</Text>
          </View>
          <Text style={styles.recordAmount}>{fmt(parseFloat(item.amount))}</Text>
        </View>
      );
    } else if (activeTab === 'Alerts') {
      content = (
        <View style={styles.recordCard}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="bell-outline" size={18} color={C.text} />
          </View>
          <View style={styles.recordContent}>
            <Text style={styles.recordTitle}>{item.title}</Text>
            <Text style={styles.recordSubtext}>{item.message}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.miniLabel}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
      );
    } else {
      const isIncome = item.type === 'income';
      content = (
        <View style={styles.recordCard}>
          <View style={styles.iconBox}>
            <Ionicons name={item.categoryIcon as any || 'receipt-outline'} size={18} color={C.text} />
          </View>
          <View style={styles.recordContent}>
            <Text style={styles.recordTitle}>{item.categoryName || 'Transaction'}</Text>
            <Text style={styles.recordSubtext}>{item.date}</Text>
          </View>
          <Text style={[styles.recordAmount, { color: isIncome ? C.success : C.text }]}>
            {isIncome ? '+' : ''}{fmt(parseFloat(item.amount))}
          </Text>
        </View>
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

  const currentListData = activeTab === 'History' ? transactions : activeTab === 'Recurring' ? recurring : activeTab === 'Goals' ? goals : notifications;

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
            <TouchableOpacity style={styles.iconBtn} onPress={() => alert('Alerts screen coming soon!')} activeOpacity={0.6}>
              <Ionicons name="notifications-outline" size={20} color={C.text} />
              {redAlerts > 0 && (
                <View style={styles.alertDot}>
                  <Text style={styles.alertDotText}>{redAlerts}</Text>
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

        {/* Quick actions */}
        <View style={styles.chipsRow}>
          <QuickChip icon="robot-outline" label="Ask Duo" onPress={() => router.push('/coach')} />
          <QuickChip icon="chart-donut" label="Charts" onPress={() => router.push('/charts')} />
        </View>

        {/* List */}
        <Text style={styles.sectionTitle}>Your records</Text>
        <View style={styles.navToggle}>
          {(['History', 'Recurring', 'Goals', 'Alerts'] as ListTab[]).map((tab) => (
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
          {currentListData.length > 0 ? (
            currentListData.slice(0, 10).map((item, index) => renderListItem(item, index))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={26} color={C.border} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No {activeTab.toLowerCase()} yet</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
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

  chipsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  chip: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: C.surface, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  chipIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill },
  chipLabel: { fontSize: 12, fontWeight: '600', color: C.text },

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
  recordSubtext: { fontSize: 12, color: C.subtext },
  recordAmount: { fontSize: 14, fontWeight: '700', color: C.text },
  miniLabel: { fontSize: 9, color: C.subtext, fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },

  emptyState: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: C.subtext, fontWeight: '500' }
});