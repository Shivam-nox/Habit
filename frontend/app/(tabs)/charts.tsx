// screens/ChartsScreen.tsx

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useApi } from '../../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── PALETTE ────────────────────────────────────────────────
const C = {
  ink: '#171717',
  accent: '#171717',      // single accent (text/ink) for neutral emphasis
  red: '#DC2626',
  green: '#16A34A',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  ink60: 'rgba(23,23,23,0.55)',
  ink30: 'rgba(23,23,23,0.28)',
  ink10: 'rgba(23,23,23,0.08)',
  border: '#E4E4E7',
};

// Single-hue tints used for category rank instead of a rainbow palette
const CAT_TINTS = ['#171717', '#3F3F46', '#71717A', '#A1A1AA', '#D4D4D8', '#E4E4E7'];

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000  ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${(n || 0).toFixed(0)}`;

// ─── TYPES ──────────────────────────────────────────────────
interface MonthPoint { month: string; expense: number; income: number; savings: number }
interface CategoryItem { categoryName: string; total: number; percentOfExpense: number }
interface BehaviorData {
  disciplineScore: number;
  impulseBuyingScore: number;
  emotionalSpendingScore: number;
  weekendOverspendRatio: number;
  lateNightSpendPercent: number;
}
interface GoalItem { name: string; targetAmount: number; currentAmount: number }

type ChartTab = 'Trends' | 'Categories' | 'Behavior' | 'Goals';
const TABS: ChartTab[] = ['Trends', 'Categories', 'Behavior', 'Goals'];

// ─── HELPER COMPONENTS ──────────────────────────────────────

const EmptyData = ({ message, icon = "bar-chart-2" }: { message: string, icon?: any }) => (
  <View style={styles.emptyState}>
    <Feather name={icon} size={28} color={C.ink30} style={{ marginBottom: 12 }} />
    <Text style={styles.emptyStateText}>{message}</Text>
  </View>
);

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.statPill}>
    <Text style={styles.statPillVal}>{value}</Text>
    <Text style={styles.statPillLabel}>{label}</Text>
  </View>
);

// ─── CHARTS ─────────────────────────────────────────────────
const BarChart = ({ data, maxVal, barColor = C.ink, barWidth = 26, height = 160, showValues = true }: any) => {
  const anims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!data.length) return;
    Animated.stagger(50, anims.map((anim: any) => Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: false }))).start();
  }, [data]);

  if (!data || data.length === 0) return <EmptyData message="No chart data available" />;

  return (
    <View style={{ height: height + 48 }}>
      {[0, 0.5, 1].map(pct => (
        <View key={pct} style={{ position: 'absolute', left: 0, right: 0, top: height * (1 - pct), height: 1, backgroundColor: C.ink10 }} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 6 }}>
        {data.map((item: any, i: number) => {
          const pct = maxVal > 0 ? item.value / maxVal : 0;
          const barH = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(4, height * pct)] });
          return (
            <View key={item.label} style={{ alignItems: 'center', flex: 1 }}>
              {showValues && <Text style={styles.barTopVal} numberOfLines={1}>{item.value > 0 ? fmt(item.value) : ''}</Text>}
              <Animated.View style={{ width: barWidth, height: barH, borderRadius: 6, backgroundColor: barColor }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {data.map((item: any) => <Text key={item.label} style={[styles.barLabel, { flex: 1 }]} numberOfLines={1}>{item.label}</Text>)}
      </View>
    </View>
  );
};

const GroupedBarChart = ({ data, height = 160 }: { data: MonthPoint[]; height?: number }) => {
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
  const anims = useRef(data.map(() => ({ inc: new Animated.Value(0), exp: new Animated.Value(0) }))).current;

  useEffect(() => {
    if (!data.length) return;
    const all = anims.flatMap((a, i) => [
      Animated.timing(a.inc, { toValue: 1, duration: 320, useNativeDriver: false, delay: i * 40 }),
      Animated.timing(a.exp, { toValue: 1, duration: 320, useNativeDriver: false, delay: i * 40 + 30 }),
    ]);
    Animated.parallel(all).start();
  }, [data]);

  if (!data || data.length === 0) return <EmptyData message="Not enough history" />;

  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        {data.map((item, i) => {
          const incH = anims[i].inc.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(4, height * (item.income / maxVal))] });
          const expH = anims[i].exp.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(4, height * (item.expense / maxVal))] });
          return (
            <View key={item.month} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }}>
                <Animated.View style={{ width: 12, height: incH, borderRadius: 3, backgroundColor: C.ink }} />
                <Animated.View style={{ width: 12, height: expH, borderRadius: 3, backgroundColor: C.ink30 }} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {data.map(item => <Text key={item.month} style={[styles.barLabel, { flex: 1, textAlign: 'center' }]}>{item.month}</Text>)}
      </View>
    </View>
  );
};

const CategoryStackedBars = ({ items }: { items: CategoryItem[] }) => {
  const anims = useRef(items.slice(0, 6).map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!items.length) return;
    Animated.stagger(60, anims.map(a => Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: false }))).start();
  }, [items]);

  if (!items || items.length === 0) return <EmptyData message="No categories logged" icon="pie-chart" />;

  return (
    <View style={styles.catBarsWrap}>
      {items.slice(0, 6).map((item, i) => {
        const fillW = anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.min(item.percentOfExpense, 100)}%`] });
        return (
          <View key={item.categoryName} style={styles.catBarItem}>
            <View style={styles.catBarHeader}>
              <View style={styles.catBarNameRow}>
                <View style={[styles.catBarDot, { backgroundColor: CAT_TINTS[i % CAT_TINTS.length] }]} />
                <Text style={styles.catBarName}>{item.categoryName}</Text>
              </View>
              <View style={styles.catBarRight}>
                <Text style={styles.catBarPct}>{(item.percentOfExpense || 0).toFixed(0)}%</Text>
                <Text style={styles.catBarAmt}>{fmt(item.total)}</Text>
              </View>
            </View>
            <View style={styles.catBarTrack}>
              <Animated.View style={[styles.catBarFill, { width: fillW, backgroundColor: CAT_TINTS[i % CAT_TINTS.length] }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const BehaviorBar = ({ label, score, maxScore = 100, index }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: false, delay: index * 60 }).start(); }, []);
  const fillW = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${((score || 0) / maxScore) * 100}%`] });
  
  return (
    <View style={styles.behavBarItem}>
      <View style={styles.behavBarTop}>
        <Text style={styles.behavBarLabel}>{label}</Text>
        <Text style={styles.behavBarScore}>{(score || 0).toFixed(0)}<Text style={styles.behavBarMax}>/{maxScore}</Text></Text>
      </View>
      <View style={styles.behavBarTrack}>
        <Animated.View style={[styles.behavBarFill, { width: fillW }]} />
      </View>
    </View>
  );
};

// ─── MAIN SCREEN ─────────────────────────────────────────────────
export default function ChartsScreen() {
  const api = useApi();
  const [tab, setTab] = useState<ChartTab>('Trends');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Real Data States
  const [monthlyData, setMonthlyData] = useState<MonthPoint[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [behavior, setBehavior] = useState<BehaviorData | null>(null);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const [dashData, goalsData] = await Promise.all([
        api.getDashboard(),
        api.getGoals?.() || Promise.resolve([]),
      ]);

      const d = dashData?.data;
      if (d) {
        setAnalytics(d);
        setCategories(d.categoryBreakdown || []);
        setBehavior(d.behavior || null);
        setMonthlyData(d.trends || []); // Maps to actual trends if backend returns it
      }

      if (goalsData && Array.isArray(goalsData)) {
        setGoals(
          goalsData.map((g: any) => ({
            name: g.name,
            targetAmount: parseFloat(g.targetAmount) || 0,
            currentAmount: parseFloat(g.currentAmount || g.savedAmount || '0'),
          }))
        );
      }
    } catch (e) {
      console.error('Charts load failed:', e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.ink} />
        <Text style={styles.loaderText}>Crunching numbers…</Text>
      </View>
    );
  }

  // Live Stats Calculations
  const totalExpenseThisMonth = analytics?.stats?.totalExpense ?? 0;
  const totalIncomeThisMonth = analytics?.stats?.totalIncome ?? 0;
  const savingsThisMonth = totalIncomeThisMonth - totalExpenseThisMonth;
  const avgSavings = monthlyData.length 
    ? monthlyData.reduce((s, m) => s + m.savings, 0) / monthlyData.length 
    : savingsThisMonth;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Analytics</Text>
        <Text style={styles.screenSub}>Your financial health</Text>
      </View>

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t} style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => { Haptics.selectionAsync(); setTab(t); }} activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.ink} />}
      >
        {/* ══════════════ TRENDS TAB ══════════════ */}
        {tab === 'Trends' && (
          <>
            <View style={styles.pillRow}>
              <StatPill label="Expense" value={fmt(totalExpenseThisMonth)} />
              <StatPill label="Income" value={fmt(totalIncomeThisMonth)} />
              <StatPill label="Saved" value={fmt(savingsThisMonth)} />
            </View>

            {monthlyData && monthlyData.length > 0 ? (
              <>
                {/* Standard Monthly Expense Bar Chart */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Expense Trends</Text>
                  <BarChart
                    data={monthlyData.map(m => ({ label: m.month, value: m.expense }))}
                    maxVal={Math.max(...monthlyData.map(m => m.expense), 1)}
                    barColor={C.ink}
                    height={140}
                  />
                </View>

                {/* Income vs Expense Grouped Bars */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Income vs Expense</Text>
                    <View style={styles.legend}>
                      <View style={[styles.legendDot, { backgroundColor: C.ink }]} /><Text style={styles.legendText}>Income</Text>
                      <View style={[styles.legendDot, { backgroundColor: C.ink30, marginLeft: 10 }]} /><Text style={styles.legendText}>Expense</Text>
                    </View>
                  </View>
                  <GroupedBarChart data={monthlyData} height={140} />
                </View>
              </>
            ) : (
              <EmptyData message="Not enough historical data to show trends yet." icon="bar-chart-2" />
            )}

            {/* Daily / Weekly averages (Only shows if dailyAverages exist) */}
            {analytics?.dailyAverages && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Spending Averages</Text>
                <View style={styles.avgGrid}>
                  <View style={styles.avgItem}>
                    <Text style={styles.avgVal}>{fmt(analytics.dailyAverages.daily)}</Text>
                    <Text style={styles.avgLabel}>Daily avg</Text>
                  </View>
                  <View style={styles.avgItem}>
                    <Text style={styles.avgVal}>{fmt(analytics.dailyAverages.weekly)}</Text>
                    <Text style={styles.avgLabel}>Weekly avg</Text>
                  </View>
               {analytics?.prediction?.projectedMonthlyExpense !== undefined && (
                    <View style={styles.avgItem}>
                      <Text style={styles.avgVal}>{fmt(analytics.prediction.projectedMonthlyExpense)}</Text>
                      <Text style={styles.avgLabel}>Monthly proj</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}
        
        {/* ══════════════ CATEGORIES TAB ══════════════ */}
        {tab === 'Categories' && (
          <>
            {categories.length > 0 ? (
              <>
                <View style={styles.pillRow}>
                  <StatPill label="Top category" value={categories[0]?.categoryName ?? '-'} />
                  <StatPill label="Its share" value={`${categories[0]?.percentOfExpense?.toFixed(0) ?? 0}%`} />
                  <StatPill label="Active Cats" value={`${categories.length}`} />
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Spending by Category</Text>
                  <CategoryStackedBars items={categories} />
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Spending Composition</Text>
                  <View style={styles.compositionBar}>
                    {categories.slice(0, 6).map((item, i) => (
                      <View key={item.categoryName} style={{ flex: item.percentOfExpense, backgroundColor: CAT_TINTS[i % CAT_TINTS.length], height: 16 }} />
                    ))}
                  </View>
                  <View style={styles.legendWrap}>
                    {categories.slice(0, 6).map((item, i) => (
                      <View key={item.categoryName} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: CAT_TINTS[i % CAT_TINTS.length] }]} />
                        <Text style={styles.legendName} numberOfLines={1}>{item.categoryName}</Text>
                        <Text style={styles.legendPct}>{(item.percentOfExpense || 0).toFixed(0)}%</Text>
                        <Text style={styles.legendAmt}>{fmt(item.total)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <EmptyData message="No categories logged this month" icon="pie-chart" />
            )}
          </>
        )}

        {/* ══════════════ BEHAVIOR TAB ══════════════ */}
        {tab === 'Behavior' && (
          <>
            {behavior ? (
              <>
                <View style={styles.disciplineHero}>
                  <Text style={styles.disciplineScore}>{behavior.disciplineScore || 0}</Text>
                  <Text style={styles.disciplineMax}>/100</Text>
                  <Text style={styles.disciplineLabel}>Discipline Score</Text>
                  <Text style={styles.disciplineSublabel}>
                    {(behavior.disciplineScore || 0) >= 80 ? 'Excellent — keep it up'
                    : (behavior.disciplineScore || 0) >= 60 ? 'Good — room to improve'
                    : 'Needs attention'}
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Behavior Scores <Text style={styles.cardSub2}>(lower = better)</Text></Text>
                  <BehaviorBar label="Impulse Buying" score={behavior.impulseBuyingScore} index={0} />
                  <BehaviorBar label="Emotional Spending" score={behavior.emotionalSpendingScore} index={1} />
                </View>
              </>
            ) : (
              <EmptyData message="Not enough behavior data yet" icon="activity" />
            )}

            {/* Peak spending times (If Available) */}
            {analytics?.peakSpendingTimes && analytics.peakSpendingTimes.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Peak Spending Times</Text>
                <BarChart
                  data={analytics.peakSpendingTimes.map((p: any) => ({ label: p.timeOfDay, value: p.total }))}
                  maxVal={Math.max(...analytics.peakSpendingTimes.map((p: any) => p.total))}
                  barColor={C.ink} height={120}
                />
              </View>
            )}
          </>
        )}

        {/* ══════════════ GOALS TAB ══════════════ */}
        {tab === 'Goals' && (
          <>
            {goals.length > 0 ? (
              <>
                <View style={styles.pillRow}>
                  <StatPill label="Active goals" value={`${goals.length}`} />
                  <StatPill label="Total target" value={fmt(goals.reduce((s, g) => s + g.targetAmount, 0))} />
                  <StatPill label="Total saved" value={fmt(goals.reduce((s, g) => s + g.currentAmount, 0))} />
                </View>

                {goals.map((g, i) => {
                  const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
                  return (
                    <View key={g.name} style={styles.goalCard}>
                      <View style={styles.goalCardTop}>
                        <View style={styles.goalIcon}>
                          <MaterialCommunityIcons name="star-shooting" size={18} color={C.ink} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.goalName}>{g.name}</Text>
                          <Text style={styles.goalSub}>Target: {fmt(g.targetAmount)}</Text>
                        </View>
                        <Text style={styles.goalPct}>{pct.toFixed(0)}%</Text>
                      </View>
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalFill, { width: `${pct}%` }]} />
                      </View>
                      <View style={styles.goalBottom}>
                        <Text style={styles.goalSaved}>Saved: {fmt(g.currentAmount)}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <EmptyData message="No active goals. Add some in the Records tab!" icon="target" />
            )}
          </>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 18, paddingBottom: 30 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  loaderText: { marginTop: 14, fontSize: 14, color: C.ink60, fontWeight: '500' },

  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 40, opacity: 0.7 },
  emptyStateText: { color: C.ink60, fontWeight: '500', fontSize: 14 },

  screenHeader: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  screenTitle: { fontSize: 24, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  screenSub: { fontSize: 13, color: C.ink60, fontWeight: '400', marginTop: 2 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 18, marginBottom: 16,
    backgroundColor: C.surface, borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: C.border,
  },
  tabItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabItemActive: { backgroundColor: C.ink },
  tabText: { fontSize: 12, fontWeight: '600', color: C.ink60 },
  tabTextActive: { color: 'white' },

  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 14 },
  cardSub: { fontSize: 11, color: C.ink60, fontWeight: '400' },
  cardSub2: { fontSize: 10, color: C.ink30, fontWeight: '400' },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statPill: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  statPillVal: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, color: C.ink },
  statPillLabel: { fontSize: 10, color: C.ink60, fontWeight: '500', marginTop: 3 },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, color: C.ink60, fontWeight: '500' },
  legendWrap: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendName: { flex: 1, fontSize: 13, color: C.ink, fontWeight: '500' },
  legendPct: { fontSize: 12, color: C.ink60, fontWeight: '600', width: 36, textAlign: 'right' },
  legendAmt: { fontSize: 12, color: C.ink60, fontWeight: '500', width: 54, textAlign: 'right' },

  barTopVal: { fontSize: 9, color: C.ink60, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  barLabel: { fontSize: 10, color: C.ink30, fontWeight: '500', textAlign: 'center' },

  catBarsWrap: { gap: 14 },
  catBarItem: {},
  catBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catBarNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  catBarDot: { width: 7, height: 7, borderRadius: 3.5 },
  catBarName: { fontSize: 13, fontWeight: '600', color: C.ink, flex: 1 },
  catBarRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  catBarPct: { fontSize: 12, fontWeight: '700', color: C.ink60 },
  catBarAmt: { fontSize: 12, fontWeight: '600', color: C.ink60, minWidth: 52, textAlign: 'right' },
  catBarTrack: { height: 6, backgroundColor: C.ink10, borderRadius: 999, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 999 },

  compositionBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 16 },

  behavBarItem: { marginBottom: 16 },
  behavBarTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  behavBarLabel: { fontSize: 13, fontWeight: '600', color: C.ink },
  behavBarScore: { fontSize: 14, fontWeight: '700', color: C.ink },
  behavBarMax: { fontSize: 11, color: C.ink30, fontWeight: '400' },
  behavBarTrack: { height: 6, backgroundColor: C.ink10, borderRadius: 999, overflow: 'hidden' },
  behavBarFill: { height: '100%', borderRadius: 999, backgroundColor: C.ink },

  disciplineHero: { borderRadius: 16, padding: 28, alignItems: 'center', marginBottom: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  disciplineScore: { fontSize: 56, fontWeight: '700', color: C.ink, letterSpacing: -1.5 },
  disciplineMax: { fontSize: 15, color: C.ink30, fontWeight: '500', marginTop: -8, marginBottom: 4 },
  disciplineLabel: { fontSize: 12, color: C.ink60, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  disciplineSublabel: { fontSize: 13, color: C.ink60, fontWeight: '400', marginTop: 8, textAlign: 'center' },

  avgGrid: { flexDirection: 'row', gap: 10 },
  avgItem: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  avgVal: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, color: C.ink },
  avgLabel: { fontSize: 10, color: C.ink60, fontWeight: '500', marginTop: 4, textAlign: 'center' },

  goalCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  goalCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  goalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  goalName: { fontSize: 15, fontWeight: '700', color: C.ink },
  goalSub: { fontSize: 12, color: C.ink60, fontWeight: '400', marginTop: 2 },
  goalPct: { fontSize: 17, fontWeight: '700', color: C.ink },
  goalTrack: { height: 6, backgroundColor: C.ink10, borderRadius: 999, overflow: 'hidden', marginBottom: 8 },
  goalFill: { height: '100%', borderRadius: 999, backgroundColor: C.ink },
  goalBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  goalSaved: { fontSize: 12, color: C.ink60, fontWeight: '500' },
  goalRemain: { fontSize: 12, color: C.ink, fontWeight: '600' },
});